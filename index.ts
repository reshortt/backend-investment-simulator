import express = require("express");
import cors = require("cors");
import { Document } from "mongodb";
import {
  buyAsset,
  createUser,
  getAssets,
  getCash,
  getTransactions,
  getUserByEmail,
  getUserById,
  login,
  makeGift,
  sellAsset,
} from "./mongo";
import { getPrice, lookupTicker, isValidSymbol } from "./stocks";
import { Asset, StockPrices, Transaction, User, UserInfo } from "./types";

global.fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

const port: number = 3005;

const router: express.Router = express.Router();

router.post("/login", express.json(), async (req, res) => {
  const password: string = req.body.password;
  const email: string = req.body.email;

  if (!getUserByEmail(email)) {
    console.log("never heard of user: ", req.body.email);
    return res.status(401).send("Invalid Email");
  }

  const foundUser: Document = await login(email, password);
  if (!foundUser) {
    const msg: string = "Invalid password for " + email;
    console.log(msg);
    return res.status(401).send(msg);
  }

  console.log("Welcome to ", foundUser.name);
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

router.get("/API/lookupTicker", async (req, res) => {
  //console.log(" Lookup Ticker Called on ", req.query, " and req= ", req)

  const tickerSymbol = req.query.tickerSymbol.toString();

  const isValid: boolean = tickerSymbol && (await isValidSymbol(tickerSymbol));
  if (!isValid) {
    console.log(`Invalid Symbol: ${tickerSymbol} - returning 400`);
    res.status(400).send(`Invalid Symbol: ${tickerSymbol}`);
    return;
  }
  const companyName: string = await lookupTicker(tickerSymbol);

  res.status(200).send(companyName);
});

router.get("/API/getHistoricalPrices", async (req, res) => {});

router.get("/API/getStockPrice", async (req, res) => {
  //console.log(" Get Stock Price Called on ", req.query, " and req= ", req)

  const tickerSymbol = req.query.tickerSymbol.toString();

  const isValid: boolean = await isValidSymbol(tickerSymbol);
  if (!isValid) {
    console.log(
      `Invalid Symbol sent to get stock price: ${tickerSymbol} - returning 400`
    );
    res.status(400).send(`Invalid Symbol: ${tickerSymbol}`);
    return;
  }

  res.status(200).send(await getPrice(tickerSymbol));
});

router.post("/signup", express.json(), async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const name = req.body.name;

  if (!email || !password) {
    res.status(400);
    res.json({
      message: "invalid email or password",
    });
    return;
  }

  if (await getUserByEmail(email)) {
    res.status(400);
    res.json({
      message: "email already exists",
    });
    return;
  }

  const user = await createUser(email, name, password);
  makeGift(user, 1000000);

  res.status(200);
  res.json({ message: "User " + email + " successfully added and given $1M" });
  return;
});

router.get("/API/getUserInfo", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;
  const userInfo: UserInfo = {
    name: foundUser.name,
    email: foundUser.emai,
    cash: foundUser.cash,
    created: foundUser.created,
  };
  res.status(200).json(userInfo);
});

router.get("/API/getUser", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;
  const user: User = {
    info: {
      name: foundUser.name,
      email: foundUser.emai,
      cash: foundUser.cash,
      created: foundUser.created,
    },
    transactions: await getTransactions(foundUser),
    assets: await getAssets(foundUser),
  };
  res.status(200).json(user);
});

router.get("/API/getBalance", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;

  const yesterday: boolean = Boolean(req.query.yesterday);

  // Promise.all waits for all promises in the passed in array to
  const userBalanceArray = await Promise.all(
    foundUser.positions.map(async (currentPosition) => {
      const currentStockPrice: StockPrices = await getPrice(
        currentPosition.symbol
      ); // stocks.ts

      const currentLotValue: number = currentPosition.lots.reduce(
        (previousLot, currentLot) => {
          const price: number = yesterday
            ? currentStockPrice.previousClose
            : currentStockPrice.bid;
          return previousLot + currentLot.shares * price;
        },
        0
      );
      return currentLotValue;
    })
  );
  const userBalance: number =
    userBalanceArray.reduce((prev: number, curr: number) => prev + curr) +
    foundUser.cash;
  res.status(200).json({ balance: userBalance });
});

const verifyUser = async (req, res): Promise<Document> => {
  const token = req.headers.authorization.split(" ")[1];
  const payload = await jwt.verify(token, process.env.JWT_SECRET);
  const foundUser = await getUserById(payload.userId);
  if (!foundUser) res.status(401).send("Invalid user ID");
  return foundUser;
};

router.get("/API/getAssets", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;

  const assetsArray: Asset[] = await getAssets(foundUser);
  res.status(200).json({ assets: assetsArray });
});

router.get("/API/getTransactions", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;

  const transactionsArray: Transaction[] = await getTransactions(foundUser);
  res.status(200).json({ transactions: transactionsArray });
});

router.get("/API/getCash", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;

  const cash: number = await getCash(foundUser);
  res.status(200).json({ cash: cash });
});

router.get("/API/buyAsset", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;

  const tickerSymbol: string = req.query.tickerSymbol.toString().toUpperCase();
  const shares = Number(req.query.shares.toString());
  const price = Number(req.query.price.toString());
  const purchaseResult = await buyAsset(foundUser, tickerSymbol, shares, price);
  if (purchaseResult) {
    getCash(foundUser).then((cash)=>{
      res.status(200).send({cash});
    },(rejection)=>{
      res.status(500).send({rejected: rejection})
    }
    )
  } else {
    res.status(500).send("");
  }
});

router.get("/API/sellAsset", async (req, res) => {
  const foundUser = await verifyUser(req, res);
  if (!foundUser) return;

  const tickerSymbol: string = req.query.tickerSymbol.toString().toUpperCase();
  const shares = Number(req.query.shares.toString());
  const price = Number(req.query.price.toString());
  const saleResult = await sellAsset(foundUser, tickerSymbol, shares, price);
  if (saleResult) {
    res.status(200).json({
      cash: await getCash(foundUser),
    });
  } else {
    res.status(500).send("");
  }
});
