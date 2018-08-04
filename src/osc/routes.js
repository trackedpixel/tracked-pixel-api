module.exports = function (app, checkJwt) {
  app.get('/osc-events', (req, res, next) => {
    const client = req.app.locals.client;

    client.db('trackedpixel').collection("osc-events")
      .find()
      .toArray()
      .then(items => res.json(items))
      .catch(next);
  });

  app.delete('/osc-events', (req, res, next) => {
    const client = req.app.locals.client;
    const collection = client.db('trackedpixel').collection("osc-events");

    collection.deleteMany()
      .then(() => res.status(200).end())
      .catch(next);
  });

  app.post('/osc-events', (req, res, next) => {
    const client = req.app.locals.client;

    let newItems = Array.isArray(req.body) ? req.body : [req.body];
    const createdTime = new Date();
    newItems.forEach(item => item.createdTime = createdTime);

    // todo: validate body of request.
    const collection = client.db('trackedpixel').collection("osc-events");

    const promises = newItems.map(item => {
      return collection.findOneAndUpdate(
        { "location": item.location, "startTime": item.startTime },
        { $set: item },
        { upsert: true, returnOriginal: false }
      ).then(resp => resp.value);
    });

    Promise.all(promises)
      .then(updatedDocs => res.send(updatedDocs).status(201).end())
      .catch(next);
  });
}
