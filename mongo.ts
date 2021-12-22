import { MongoClient, ObjectId, Document, UpdateResult, Collection } from "mongodb";
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

const getInvestorsCollection = async () => {
  await client.connect();
  const db = client.db("investments");
  return db.collection("investors");
}

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
      transactions: {
        date: new Date(),
        type: TransactionType.GIFT,
        amount: amount,
      },
    },
  });

  // await collection.updateOne(user, {
  //   $set: {
  //     cash: amount,
  //   },
  // });
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
      const currentPrice: StockPrices = await getPrice(currentSymbol);
      const lotArray: Lot[] = currentPosition.lots.map((currentLot) => {
        const currentShares = currentLot.shares;
        const currentBasis = currentLot.basis;
        return { shares: currentShares, basis: currentBasis };
      });
      return {
        stock: {
          symbol: currentSymbol,
          name: currentName,
          price: currentPrice,
        },
        lots: lotArray,
      };
    })
  );

  //console.log("Get Assets Called, returning: ", assetsArray)
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
      const currentName: string = await lookupTicker(currentSymbol);
      const currentType: TransactionType = currentTransaction.type;
      const currentAmount: number = currentTransaction.amount;
      const currentShares: number = currentTransaction.shares;

      const transaction = {
        symbol: currentSymbol,
        name: currentName,
        date: currentDate,
        type: currentType,
        amount: currentAmount,
        shares: currentShares,
      };

      return transaction;
      //transactionsArray.push(transaction)
    })
  );

  return transactionsArray;
};

// export const getPositions = async (
//   foundUser: Document
// ): Promise<Position[]> => {
//   // Promise.all waits for all promises in the passed in array to
//   const transactionsArray: Transaction[] = await Promise.all(
//     foundUser.transactions.map(async (currentTransaction) => {
//       const currentDate: Date = currentTransaction.date;
//       const currentSymbol: string = currentTransaction.symbol;
//       const currentType: TransactionType = currentTransaction.type;
//       const currentAmount: number = currentTransaction.amount;
//       const currentShares: number = currentTransaction.shares;

//       return {
//         symbol: currentSymbol,
//         date: currentDate,
//         type: currentType,
//         amount: currentAmount,
//         shares: currentShares,
//       };
//     })
//   );

//   return transactionsArray;
// };

type Position = {
  symbol: string;
  lots: Lot[];
};

export const buyAsset = async (
  user: Document,
  tickerSymbol: string,
  shares: number,
  askPrice: number
) => {
  try {
    const totalPrice: number = askPrice * shares + COMMISSION;
    const lot = { shares: shares, basis: totalPrice / shares };
    await createPosition(user, tickerSymbol, lot);

    await createTransaction(
      user,
      TransactionType.BUY,
      tickerSymbol,
      shares,
      totalPrice
    );

    const cash = user.cash - totalPrice;
    await client.connect();
    const db = client.db("investments");
    const collection = db.collection("investors");
    console.log("Decreasing cash from ", user.cash, " to ", cash);
    await collection.updateOne(user, {
      $set: {
        cash: cash,
      },
    });
    return true;
  } catch (ex) {
    console.error(ex);
    return false;
  }
};

// create a transaction
export const createTransaction = async (
  user: Document,
  type: TransactionType,
  tickerSymbol: string,
  shares: number,
  amount: number
) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  await collection.updateOne(
    { email: user.email },
    {
      $push: {
        transactions: {
          date: new Date(),
          type: type,
          amount: amount,
          shares: shares,
          symbol: tickerSymbol,
        },
      },
    }
  );
};

// get or create a position
export const createPosition = async (
  user: Document,
  tickerSymbol: string,
  lot: Lot
) => {
  const positions: Position[] = user.positions;

  positions.forEach((position) => {
    if (position.symbol.toUpperCase() === tickerSymbol.toUpperCase()) {
      return createLot(user, lot, tickerSymbol);
    }
  });

  // Create a new position for the ticker symbol
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  const newPosition = { symbol: tickerSymbol, lots: [lot] };
  console.log("pushing new position ", JSON.stringify(newPosition));
  const result: UpdateResult = await collection.updateOne(user, {
    $push: {
      positions: newPosition,
    },
  });

  console.log("Result of adding position in ", tickerSymbol, ": ", result);
};

export const createLot = async (
  user: Document,
  lot: Lot,
  tickerSymbol: string
) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  // Find the user's position's element we need to update

  return collection.updateOne(
    user,
    {
      $push: {
        "positions.$[p].lots": lot,
      },
    },
    {
      arrayFilters: [
        {
          "p.symbol": tickerSymbol.toUpperCase(),
        },
      ],
    }
  );
};
