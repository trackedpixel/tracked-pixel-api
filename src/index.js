const fs = require('fs');

import express from 'express';
import logger from 'morgan';
import bodyParser from 'body-parser';
import responseTime from 'response-time';
import cors from 'cors';

const debug = require('debug')('tracked-pixel-api');
const MongoClient = require('mongodb').MongoClient;
const DB_COLLECTION_NAME = 'tracked-pixel';

const app = express();

app.disable('x-powered-by');

app.use(cors());
app.use(responseTime());
app.use(logger('dev', {
  skip: () => app.get('env') === 'test'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Routes
app.get('/trackings', (req, res, next) => {
  const db = req.app.locals.db;

  // todo: add query parameters, max items returned

  db.collection(DB_COLLECTION_NAME)
    .find()
    .toArray()
    .then(items => res.json(items))
    .catch(next);
});

app.get('/trackings/:id', (req, res, next) => {
  const db = req.app.locals.db;

  // todo: add query parameters, max items returned
  return next();
});

app.post('/trackings', (req, res, next) => {
  const db = req.app.locals.db;

  debug('inserting new event', req.body);

  req.body = req.body || {};
  req.body.createdTime = new Date();

  // todo: validate body of event.

  const query = { name: req.body.name };

  db.collection(DB_COLLECTION_NAME)
    .insertOne(req.body)
    .then((doc) => {
      res.send(doc.ops[0]).status(201).end()
    })
    .catch(next);
});

app.get('/pixel/:id', (req, res, next) => {
  const db = req.app.locals.db;

  let options = {
    root: __dirname + '/public/',
    dotfiles: 'deny'
  };

  // todo: insert new 'viewed' record for this pixel if it exists
  console.log('ip address:', req.connection.remoteAddress);

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
    app.listen(8090, () => debug(`Listening on port 8090`));
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
