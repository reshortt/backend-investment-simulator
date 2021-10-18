import express = require("express");
import cors = require("cors");
import { MongoClient } from "mongodb";
import e = require("express");
import yahooStockAPI = require("yahoo-stock-api");
import yahooHistory = require("yahoo-finance-history");
global.fetch = require("node-fetch");

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

async function isTickerSymbolValid(tickerSymbol: string) {
  const data = await yahooHistory.getPriceHistory(tickerSymbol);
  console.log(await data.dividendHistory);

  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);
  console.log(symbol);
  if (!symbol.error) {
    console.log(tickerSymbol + ": valid");
    return true;
  } else {
    console.log(tickerSymbol + ": invalid");
    return false;
  }
}

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

  const isValid = await isTickerSymbolValid(password);

  // check for valid email string
  let doc = await collection.findOne({ email: email });
  if (doc) {
    res.status(400);
    res.json({
      message: "email already exists",
    });
    return;
  }

  // add to the collection
  doc = await collection.insertOne({
    email,
    password,
    name,
    created: new Date(),
    transactions: [],
    positions: [],
  });

  // give em their million bucks
  await collection.updateOne(
    { email: email },
    {
      $push: {
        transactions: { date: new Date(), type: "gift", proceeds: 1000000 },
      },
    }
  );

  await collection.updateOne(
    { email: email },
    {
      $set: {
        cash: 100000,
      },
    },
  );

  res.status(200);
  res.json({ message: "User " + email + " successfully added and given $1M" });
  return;
});
