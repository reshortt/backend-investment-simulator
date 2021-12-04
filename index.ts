import express = require("express");
import cors = require("cors");
import { MongoClient } from "mongodb";
import { getEmailById, getUser } from "./mongo";
import { getPrice, lookupTicker, isValidSymbol } from "./stocks";
import { Asset, Lot, StockPrices, UserInfo } from "./types";

global.fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

const url: string = "mongodb://localhost:27017";
const client: MongoClient = new MongoClient(url);

const port: number = 3005;

const router: express.Router = express.Router();
router.post("/login", express.json(), async (req, res) => {
  //console.log(req.body);
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

  console.log("Found User is ", foundUser);

  console.log(" welcome to ", foundUser.email);
  console.log(" also, welcome to ", foundUser.name);
  const token = jwt.sign({ userId: foundUser._id }, process.env.JWT_SECRET, {
    expiresIn: 200000, // TODO: go back to 2s
  });
  const replyObject = {
    token,
    email: foundUser.email,
    userName: foundUser.name,
  };
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

// async function checkFavoriteStock(tickerSymbol: string) {
//   const data = await yahooHistory.getPriceHistory(tickerSymbol);
//   console.log(await data.dividendHistory);

//   const symbol = await yahooStockAPI.getSymbol(tickerSymbol);
//   console.log(symbol);
//   if (!symbol.error) {
//     console.log(tickerSymbol + ": valid");
//     return true;
//   } else {
//     console.log(tickerSymbol + ": invalid");
//     return false;
//   }
// }


// router.get("ail/API/getEmailById", async (req, res) => {
//   console.log("headers = ", req.headers);
//   const token = req.headers.authorization.split(" ")[1];
//   const payload = await jwt.verify(token, process.env.JWT_SECRET);
//   const email: string = await getEmailById(payload.userId);
//   if (!email) {
//     res.status(401).send("Invalid user id");
//   } else {
//     console.log("returned email: ", email);
//     res.status(200).json({ email: email });
//   }
// });

router.get("/API/lookupTicker", async (req, res) => {
  //console.log(" Lookup Ticker Called on ", req.query, " and req= ", req)

  const tickerSymbol = req.query.tickerSymbol.toString()


  const isValid: boolean = await isValidSymbol(tickerSymbol);
  if (!isValid) {
    console.log(`Invalid Symbol: ${tickerSymbol} - returning 400`);
    res.status(400).send(`Invalid Symbol: ${tickerSymbol}`);
    return;
  }
  const companyName:string = await lookupTicker(tickerSymbol)

  // Sending ans Asset
  console.log(" finishing /API/service lookup returning ", {symbol: tickerSymbol, name: companyName} )
  res.status(200).send({symbol: tickerSymbol, name: companyName})

});

router.get("/API/getStockPrice", async (req, res) => {
  //console.log(" Get Stock Price Called on ", req.query, " and req= ", req)

  const tickerSymbol = req.query.tickerSymbol.toString()

  const isValid: boolean = await isValidSymbol(tickerSymbol);
  if (!isValid) {
    console.log(`Invalid Symbol: ${tickerSymbol} - returning 400`);
    res.status(400).send(`Invalid Symbol: ${tickerSymbol}`);
    return
  }

  res.status(200).send(await getPrice(tickerSymbol));
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

router.get("/API/getUser", async (req, res) => {
  //console.log("headers = ", req.headers);
  const token = req.headers.authorization.split(" ")[1];
  const payload = await jwt.verify(token, process.env.JWT_SECRET);
  const foundUser = await getUser(payload.userId);
  if (!foundUser) {
    res.status(401).send("Invalid user id");
  } else {
    //console.log ("returned user: ", foundUser)
    const user:UserInfo = {name:foundUser.name, email: foundUser.emai}
    res.status(200).json(user);
  }
});

router.get("/API/getBalance", async (req, res) => {
  const yesterday:boolean = Boolean(req.query.yesterday);
  const token = req.headers.authorization.split(" ")[1];
  const payload = await jwt.verify(token, process.env.JWT_SECRET);
  const foundUser = await getUser(payload.userId);
  if (!foundUser) {
    res.status(401).send("Invalid user id");
    return;
  }

  // Promise.all waits for all promises in the passed in array to
  const userBalanceArray = await Promise.all(foundUser.positions.map(
    async (currentPosition) => {
      const currentStockPrice: StockPrices = await getPrice(currentPosition.symbol) // stocks.ts
      
      const currentBasesValue: number = currentPosition.basis.reduce((previousBasis, currentBasis) => {
        const price:number = yesterday? currentStockPrice.previousClose : currentStockPrice.bid
        return previousBasis + currentBasis.shares*price;
      }, 0);
      return currentBasesValue
    }
  ));
  const userBalance:number = userBalanceArray.reduce((prev:number, curr:number) => prev+curr) + foundUser.cash
  res.status(200).json({balance:userBalance})
});

// router.get("/API/getAssets", async (req, res) => {

//   //TODO: refactor from here...
//   const token = req.headers.authorization.split(" ")[1];
//   const payload = await jwt.verify(token, process.env.JWT_SECRET);
//   const foundUser = await getUser(payload.userId);
//   if (!foundUser) {
//     res.status(401).send("Invalid user id");
//     return;
//   }
//   //....n to here

//   // Promise.all waits for all promises in the passed in array to
//   const assetsArray:Asset[] = await Promise.all(foundUser.positions.map(
//     async (currentPosition) => {
//       const currentSymbol:string = currentPosition.symbol
//       const currentName:string = await lookupTicker(currentSymbol)

//       return {symbol:currentSymbol, name:currentName}
//     }
//   ));

//   res.status(200).json({assets:assetsArray})
// });


router.get("/API/getAssets", async (req, res) => {

  //TODO: refactor from here...
  const token = req.headers.authorization.split(" ")[1];
  const payload = await jwt.verify(token, process.env.JWT_SECRET);
  const foundUser = await getUser(payload.userId);
  if (!foundUser) {
    res.status(401).send("Invalid user id");
    return;
  }
  //....n to here

  // Promise.all waits for all promises in the passed in array to
  const assetsArray:Asset[] = await Promise.all(
    foundUser.positions.map(
    async (currentPosition) => {
      const currentSymbol:string = currentPosition.symbol
      const currentName:string = await lookupTicker(currentSymbol)
      const lotArray:Lot[] = currentPosition.basis.map(
        async (currentLot) => {
          const currentShares = currentLot.shares
          const currentCost = currentLot.cost
          return {shares:currentShares, cost:currentCost}    
        }
      ) 
      return {symbol:currentSymbol, name:currentName, lots: lotArray}
    }
  ));

  res.status(200).json({assets:assetsArray})
});


