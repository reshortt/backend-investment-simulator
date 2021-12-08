import { MongoClient, ObjectId, Document } from "mongodb";
import { getPrice, lookupTicker } from "./stocks";
import {
  Asset,
  COMMISSION,
  Lot,
  StockPrices,
  Transaction,
  TransactionType,
} from "./types";

const url: string = "mongodb://localhost:27017";
const client: MongoClient = new MongoClient(url);

export const login = async (
  email: string,
  password: string
): Promise<Document> => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  const foundUser = await collection.findOne({
    email: email,
    password: password,
  });
  if (foundUser == null || foundUser === undefined) return null;
  return foundUser;
};

// export const getEmailById = async (userId:string): Promise<string> => {
//   await client.connect();
//   console.log("getting email from user id ", userId)
//   const db = client.db("investments");
//   const collection = db.collection("investors");
//   const foundUser = await collection.findOne({
//     _id: new ObjectId(userId),
//   });
//   if (!foundUser) {
//     return "";
//   }
//   return foundUser.email;
// }

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

export const getUserById = async (userId: string): Promise<Document> => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  const foundUser = await collection.findOne({
    _id: new ObjectId(userId),
  });
  if (!foundUser) {
    return null;
  }
  return foundUser;
};

export const getUserByEmail = async (email: string): Promise<Document> => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  const foundUser = await collection.findOne({ email: email });
  return foundUser;
  //return foundUser != undefined && foundUser != null;
};

export const createUser = async (
  email: string,
  name: string,
  password: string
): Promise<Document> => {
  // add to the collection
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  await collection.insertOne({
    email,
    password,
    name,
    created: new Date(),
    transactions: [],
    positions: [],
    cash: 0,
  });

  return getUserByEmail(email);
};

export const makeGift = async (user: Document, amount: number) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  await collection.updateOne(user, {
    $push: {
      transactions: { date: new Date(), type: "gift", proceeds: amount },
    },
  });

  await collection.updateOne(user, {
    $set: {
      cash: amount,
    },
  });
};

// export const makePurchase = async (user:Document,  asset:Asset,
//   shares:number, prices:StockPrices) => {

// }

export const getCash = async (user: Document): Promise<number> => {
  return user.cash;
};

export const getAssets = async (user: Document): Promise<Asset[]> => {
  // Promise.all waits for all promises in the passed in array to
  const assetsArray: Asset[] = await Promise.all(
    user.positions.map(async (currentPosition) => {
      const currentSymbol: string = currentPosition.symbol;
      const currentName: string = await lookupTicker(currentSymbol);
      const lotArray: Lot[] = currentPosition.lots.map(async (currentLot) => {
        const currentShares = currentLot.shares;
        const currentCost = currentLot.cost;
        return { shares: currentShares, cost: currentCost };
      });
      return { symbol: currentSymbol, name: currentName, lots: lotArray };
    })
  );

  return assetsArray;
};

export const getTransactions = async (
  foundUser: Document
): Promise<Transaction[]> => {
  // Promise.all waits for all promises in the passed in array to
  const transactionsArray: Transaction[] = await Promise.all(
    foundUser.transactions.map(async (currentTransaction) => {
      const currentDate: Date = currentTransaction.date;
      const currentSymbol: string = currentTransaction.symbol;
      const currentType: TransactionType = currentTransaction.type;
      const currentAmount: number = currentTransaction.amount;
      const currentShares: number = currentTransaction.shares;

      return {
        symbol: currentSymbol,
        date: currentDate,
        type: currentType,
        amout: currentAmount,
        shares: currentShares,
      };
    })
  );

  return transactionsArray;
};

export const buyAsset = async (
  user: Document,
  tickerSymbol: string,
  shares: number
) => {
  const sharePrice: number = (await getPrice(tickerSymbol)).ask;
  const totalPrice: number = sharePrice * shares + COMMISSION;
  const transactions: Document = user.transactions;
  const position: Document = getPosition(user, tickerSymbol);
  await createLot(user, position, tickerSymbol, shares);

  const cash = user.cash - totalPrice;
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  await collection.updateOne(user, {
    $set: {
      cash: cash,
    },
  });
};

export const createLot = async (
  user: Document,
  position: Document,
  tickerSymbol: string,
  shares: number
) => {
  const stockPrices: StockPrices = await getPrice(tickerSymbol);

  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  // Find the user's position's element we need to update
  collection.update
  collection.updateOne(user,
    {positions: {
      
      $push: {
        symbol: tickerSymbol,
        lots: { shares:shares, basis:(stockPrices.ask * shares + COMMISSION)/shares},
      }
    }})
};

// get or create a position
export const getPosition = async (
  user: Document,
  tickerSymbol: string
): Promise<Document> => {
  const positions: Document[] = user.positions;

  let foundPosition: Document = null;

  positions.forEach((position) => {
    if (position.symbol == tickerSymbol) {
      foundPosition = position;
    }
  });

  if (foundPosition != null) return foundPosition;

  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  await collection.updateOne(user, {
    $push: {
      positions: { symbol: tickerSymbol, lots: []},
    }
  });
  return getPosition(user, tickerSymbol);
};
