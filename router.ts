import express = require("express");
import cors = require("cors");
import e = require("express");
import mongo = require ("./mongo");

const router: express.Router = express.Router();

router.post("/login", express.json(), async (req, res) => {

  //console.log(req.body);
  const foundUser = await mongo.login(req.body.userId, req.body.password)

  console.log("Logged in User: " + foundUser);

  res.send(foundUser);
});
  