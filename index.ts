import express = require("express");
import cors = require("cors");
import { MongoClient } from "mongodb";
import e = require("express");

const url: string = "mongodb://localhost:27017";
const client: MongoClient = new MongoClient(url);

// const port:integer = 3005 - no integer type in TypeScript?
const port: number = 3005;

const router: express.Router = express.Router();
router.get("/investors/fetch_all", async (req, res) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("assets");
  console.log("investors is " + collection);
  const findResult = await collection.find({}).toArray();
  console.log("req is " + req);

  res.send(findResult);
});

router.get("/assets/:tickerSymbol", async (req, res) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("assets");
  console.log("investors is " + collection);

  const findQuery = collection.find({
    symbol: req.params.tickerSymbol,
  });
  console.log("req is " + req);

  res.send(await findQuery.toArray());
});

const app = express();
app.use(cors());
app.options("*", cors());
app.use("/", router);
app.use(express.json());

const server = app.listen(port, () => {
  console.log("backend is running");
});

router.post("/signup", express.json(), async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const name = req.body.name;

  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  if (!email || !password) {
    res.status(400);
    res.json({
      message: "invalid email or password",
    });
    return;
  }

  // todo: check for valid email string

  const doc = await collection.findOne({ email: email });
  if (doc) {
    res.status(400);
    res.json({
      message: "email already exists",
    });
    //res.send()
    return;
  }

  // add to the collection
  await collection.insertOne({
    email,
    password,
    name,
    created: new Date(),
    cash: 1000000,
    transactions: [],
    positions: []
  });
  res.status(200);
  res.json({ message: "User " + email + " successfully added" })
  return
});
