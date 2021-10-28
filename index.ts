import express = require("express");
import cors = require("cors");
import { MongoClient } from "mongodb";
const yahooStockAPI = require("yahoo-stock-api")
const yahooHistory = require("yahoo-finance-history")
import {getEmailById} from "./mongo"

global.fetch = require("node-fetch");
import bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

const url: string = "mongodb://localhost:27017";
const client: MongoClient = new MongoClient(url);

// const port:integer = 3005 - no integer type in TypeScript?
const port: number = 3005;

const router: express.Router = express.Router();
router.post("/login", express.json(), async (req, res) => {
  console.log(req.body);
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  const foundUser = await collection.findOne({
    email: req.body.email,
    password: req.body.password,
  });

  if (!foundUser) {
    console.log("never heard of user: ", req.body.email);
    return res.status(401).send("Invalid Credentials");
  }

  // // just for testing
  // console.log("checking MCK stock");
  // const isValid = checkFavoriteStock("MCK");


  console.log("Found User is ", foundUser)


  console.log(" welcome to ", foundUser.email);
  console.log(" also, welcome to ", foundUser.name);
  const token = jwt.sign({ userId: foundUser._id }, process.env.JWT_SECRET, {
    expiresIn: 2000000, // TODO: go back to 2s
  });
  const replyObject = { token, email:foundUser.email, userName: foundUser.name };
  res.status(200).send(replyObject);
});

const app = express();
app.use(cors());
app.options("*", cors());
app.use("/", router);
app.use(express.json());

const server = app.listen(port, () => {
  console.log("backend is running");
});

async function checkFavoriteStock(tickerSymbol: string) {
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

  // check for valid email string
  let doc = await collection.findOne({ email: email });
  if (doc) {
    res.status(400);
    res.json({
      message: "email already exists",
    });
    console.log("this email exists");
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
        cash: 1000000,
      },
    }
  );

  res.status(200);
  res.json({ message: "User " + email + " successfully added and given $1M" });
  return;
});

router.get("/API/getEmailById", async(req, res) => {

  console.log ("headers = " , req.headers);
  const token = req.headers.authorization.split(' ')[1]
  const payload = await jwt.verify(token, process.env.JWT_SECRET)
  const email:string = await getEmailById(payload.userId)
  if (!email) {
    res.status(401).send("Invalid user id")
  } else {
    console.log ("returned email: ", email)
    res.status(200).json({email: email})
  }
})

