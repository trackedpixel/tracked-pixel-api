const fs = require('fs');

import express from 'express';
import logger from 'morgan';
import bodyParser from 'body-parser';
import responseTime from 'response-time';
import cors from 'cors';

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const debug = require('debug')('tracked-pixel-api');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const DB_COLLECTION_NAME = 'tracked-pixel';

const app = express();

// Authentication middleware. When used, the
// access token must exist and be verified against
// the Auth0 JSON Web Key Set
const checkJwt = jwt({
  // Dynamically provide a signing key
  // based on the kid in the header and
  // the singing keys provided by the JWKS endpoint.
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://trackedpixel.auth0.com/.well-known/jwks.json`
  }),

  // Validate the audience and the issuer.
  audience: 'https://serene-garden-72300.herokuapp.com',
  issuer: `https://trackedpixel.auth0.com/`,
  algorithms: ['RS256']
});

app.disable('x-powered-by');

app.use(cors());
app.use(responseTime());
app.use(logger('dev', {
  skip: () => app.get('env') === 'test'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

function getPixelUrl(id) {
  return process.env.TRACKER_URI + '/pixel/' + id + '.png';
}

// Routes
app.get('/trackings', checkJwt, (req, res, next) => {
  const db = req.app.locals.db;

  // todo: add query parameters, max items returned

  db.collection(DB_COLLECTION_NAME)
    .find({ sub: req.user.sub })
    .toArray()
    .then(items => res.json(items))
    .catch(next);
});

app.get('/trackings/:id', checkJwt, (req, res, next) => {
  const db = req.app.locals.db;

  db.collection(DB_COLLECTION_NAME)
    .findOne({ _id: ObjectID(req.params.id), sub: req.user.sub })
    .then(trackingPixel => {
      if (trackingPixel) {
        trackingPixel.pixelUrl = getPixelUrl(trackingPixel._id);
        return res.send(trackingPixel);
      } else {
        return next();
      }
    })
    .catch(next);
});

app.post('/trackings', checkJwt, (req, res, next) => {
  const db = req.app.locals.db;

  let newTracking = {
    sub: req.user.sub,
    ip: req.connection.remoteAddress,
    description: req.body.description,
    createdTime: new Date(),
    trackingViews: []
  };

  // todo: validate body of request.

  db.collection(DB_COLLECTION_NAME)
    .insertOne(newTracking)
    .then((resp) => {
      let doc = resp.ops[0];
      doc.pixelUrl = getPixelUrl(doc._id);

      res.send(doc).status(201).end();
    })
    .catch(next);
});

app.get('/pixel/:id.png', (req, res, next) => {
  const db = req.app.locals.db;
  let id;

  try {
    id = ObjectID(req.params.id)
  } catch (e) {
    // not a valid id, call next()
    return next();
  }

  const trackingView = {
    viewDate: new Date(),
    ip: req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  }

  db.collection(DB_COLLECTION_NAME)
    .findOneAndUpdate(
    { _id: id },
    { $push: { trackingViews: trackingView } },
    { returnOriginal: false })
    .catch((err) => console.log('error updating tracking...', err));

  let options = {
    root: __dirname + '/public/',
    dotfiles: 'deny'
  };

  res.sendFile('000000.png', options);
});

app.get('/health', (req, res, next) => {
  fs.stat(__filename, (err, stats) => {
    if (err) return next(err);

    res.json({ lastUpdated: stats.mtime.toISOString() });
  });
});

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res
    .status(err.status || 500)
    .json({
      message: err.message
    });
});

debug('connecting to database: ' + process.env.MONGO_DB_URI);

MongoClient.connect(process.env.MONGO_DB_URI)
  .then((db) => {
    debug('connected to database: ' + process.env.MONGO_DB_URI);
    app.locals.db = db;

    // don't start the server until database connection is active and we are ready to accept connections
    app.listen(process.env.PORT, () => debug(`Listening on port ${process.env.PORT}`));
  });

// handle shutting down express and closing database
let isShuttingDown = false;

let cleanup = function () {
  if (!isShuttingDown) {

    isShuttingDown = true;

    if (app.locals.db) {
      debug('closing database!');
      app.locals.db.close(() => {
        app.locals.db = null;
        debug('shutting down process');
        process.exit(0);
      });

    } else {
      debug('shutting down process');
      process.exit(0);

    }
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
