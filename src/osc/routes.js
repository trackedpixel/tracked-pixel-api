module.exports = function (app, checkJwt) {
  app.get('/osc-events', (req, res, next) => {
    const client = req.app.locals.client;

    client.db('trackedpixel').collection("osc-events")
      .find()
      .toArray()
      .then(items => res.json(items))
      .catch(next);
  });

  app.post('/osc-events', (req, res, next) => {
    const client = req.app.locals.client;

    let newItems = Array.isArray(req.body) ? req.body : [req.body];
    const createdTime = new Date();
    newItems.forEach(item => item.createdTime = createdTime);

    // todo: validate body of request.

    client.db('trackedpixel').collection("osc-events")
      .insertMany(newItems)
      .then((resp) => {
        let docs = resp.ops;

        res.send(docs).status(201).end();
      })
      .catch(next);
  });
}
