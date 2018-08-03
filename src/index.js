const fs = require('fs');

import express from 'express';
import logger from 'morgan';
import bodyParser from 'body-parser';
import responseTime from 'response-time';
import cors from 'cors';
import * as db from 'mongodb';

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const debug = require('debug')('tracked-pixel-api');
const MongoClient = db.MongoClient;
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APPID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER
});

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

// Routes
require('./trackings/routes')(app, checkJwt, pusher);

require('./names/routes')(app, checkJwt);

require('./osc/routes')(app, checkJwt);

app.get('/health', (req, res, next) => {
  fs.stat(__filename, (err, stats) => {
    if (err) return next(err);

    res.json({ lastUpdated: stats.mtime.toISOString() });
  });
});

app.post('/pusher/auth', (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  const auth = pusher.authenticate(socketId, channel);
  res.send(auth);
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
  .then((client) => {
    debug('connected to database: ' + process.env.MONGO_DB_URI);
    app.locals.client = client;

    // don't start the server until database connection is active and we are ready to accept connections
    app.listen(process.env.PORT, () => debug(`Listening on port ${process.env.PORT}`));
  });

// handle shutting down express and closing database
let isShuttingDown = false;

let cleanup = function () {
  if (!isShuttingDown) {

    isShuttingDown = true;

    if (app.locals.client) {
      debug('closing database!');
      app.locals.client.close(() => {
        app.locals.client = null;
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
