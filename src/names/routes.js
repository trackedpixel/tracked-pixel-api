import * as db from 'mongodb';
const ObjectID = db.ObjectID;

module.exports = function (app) {
  app.get('/names', (req, res, next) => {
    const client = req.app.locals.client;

    client.db('trackedpixel').collection("names")
      .find()
      .toArray()
      .then(items => res.json(items))
      .catch(next);
  });

  app.post('/names', (req, res, next) => {
    const client = req.app.locals.client;

    let newName = {
      name: req.body.name,
      votes: 1,
      createdTime: new Date()
    };

    // todo: validate body of request.

    client.db('trackedpixel').collection("names")
      .insertOne(newName)
      .then((resp) => {
        let doc = resp.ops[0];

        res.send(doc).status(201).end();
      })
      .catch(next);
  });

  app.put('/names/:id/up-vote', (req, res, next) => {
    const client = req.app.locals.client;

    client.db('trackedpixel').collection("names")
      .findOneAndUpdate(
      { _id: ObjectID(req.params.id) },
      { $inc: { "votes": 1 } },
      { returnOriginal: false })
      .then((doc) => {
        return res.send(doc.value);
      })
      .catch((err) => console.log('error updating votes...', err));
  });

  app.put('/names/:id/down-vote', (req, res, next) => {
    const client = req.app.locals.client;

    client.db('trackedpixel').collection("names")
      .findOneAndUpdate(
      { _id: ObjectID(req.params.id) },
      { $inc: { "votes": -1 } },
      { returnOriginal: false })
      .then((doc) => {
        return res.send(doc.value);
      })
      .catch((err) => console.log('error updating votes...', err));
  });
}
