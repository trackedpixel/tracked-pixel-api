const DB_COLLECTION_NAME = 'tracked-pixel';

function getPixelUrl(id) {
  return process.env.TRACKER_URI + '/pixel/' + id + '.png';
}

function getIpAddress(req) {
  let ip = req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  return ip;
}

module.exports = function (app, checkJwt) {
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

  app.delete('/trackings/:id', checkJwt, (req, res, next) => {
    const db = req.app.locals.db;

    db.collection(DB_COLLECTION_NAME)
      .remove({ _id: ObjectID(req.params.id), sub: req.user.sub })
      .then(() => res.status(204).end())
      .catch(next);
  });

  app.post('/trackings', checkJwt, (req, res, next) => {
    const db = req.app.locals.db;

    let newTracking = {
      sub: req.user.sub,
      ip: getIpAddress(req),
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
    const options = {
      root: __dirname + '/public/',
      dotfiles: 'deny'
    };

    try {
      id = ObjectID(req.params.id)
    } catch (e) {
      // not a valid id, call next()
      return res.sendFile('000000.png', options);
    }

    let ip = getIpAddress(req);

    iplocation(ip, (error, res) => {
      const trackingView = {
        viewDate: new Date(),
        ip: ip,
        geo: res,
        userAgent: req.headers['user-agent']
      };

      db.collection(DB_COLLECTION_NAME)
        .findOneAndUpdate(
        { _id: id },
        { $push: { trackingViews: trackingView } },
        { returnOriginal: false })
        .then((doc) => {
          const updatedTracking = JSON.stringify({ id: id, description: doc.value.description });
          const channelName = 'private-' + doc.value.sub.replace('|', '_');
          pusher.trigger(channelName, 'tracking-pixel-update', updatedTracking);
        })
        .catch((err) => console.log('error updating tracking...', err));
    });

    res.sendFile('000000.png', options);
  });

};
