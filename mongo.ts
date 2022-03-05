import { MongoClient, ObjectId, Document, UpdateResult, FindCursor } from "mongodb";
import { getPrice, lookupTicker } from "./stocks";
import {
  Asset,
  COMMISSION,
  Lot,
  SpotPrice,
  Transaction,
  TransactionType,
} from "./types";

//const url = "mongodb://localhost:27017";

const url = process.env.MONGO_URL
const client: MongoClient = new MongoClient(url);

const getInvestors = async () => {
  await client.connect();
  const db = client.db("investments");
  return db.collection("investors");
};

export const login = async (
  email: string,
  password: string
): Promise<Document> => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  const findObj = {email, password}
  const foundUser = await collection.findOne(findObj);
  if (foundUser == null || foundUser === undefined) return null;
  return foundUser;
};

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

export const  getAllSymbols = async():Promise<Set<string>> => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  const symbols:Set<string> = new Set()

  // get all users
  const cursor:FindCursor<Document> = collection.find({}) 
  await cursor.forEach((user:Document) => {
    for (let transaction of user.transactions) {
      if (transaction.symbol) {
        symbols.add(transaction.symbol)
      }
    }
  })  

  return symbols
}

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

export const getLots = async (
  user: Document,
  symbol: string
): Promise<Lot[]> => {
  
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  user = await collection.findOne({_id: user._id})

  return user.positions.filter((position: { symbol: string }) => {
    return position.symbol.toUpperCase() === symbol.toUpperCase();
  })[0].lots;
};



export const insertSplit = async (
  user: Document,
  symbol: string,
  date: Date,
  from: number,
  to: number
) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  const newDate = new Date(date);
  const newCash = await getCash(user);

  await collection.updateOne(
    { _id: user._id },
    {
      $push: {
        transactions: {
          date: newDate,
          type: TransactionType.SPLIT,
          cash: newCash,
          symbol,
          from,
          to,
        },
      },
    }
  );


  const originalLots: Lot[] = (await getUserById(user._id)).positions.filter(
    (position: { symbol: string }) => {
      return position.symbol.toUpperCase() === symbol.toUpperCase();
    }
  )[0].lots;

  console.log("Original lots before split: ", JSON.stringify(originalLots))

  const newLots: Lot[] = [];
  for (let lot of originalLots) {
    console.log("splitting ", symbol, " from ", lot.shares, " to ", lot.shares * (to / from))
    const newLot: Lot = {
      shares: Math.floor(lot.shares * (to / from)),
      basis: lot.basis * (from / to)
    };
    newLots.push(newLot);
  }

  //console.log("pushing new lots ", JSON.stringify(newLots))

  

  const results:UpdateResult = await collection.updateOne(
    { _id: user._id },
    {
      $set: {
        "positions.$[p].lots": newLots,
      },
    },
    {
      arrayFilters: [
        {
          "p.symbol": symbol.toUpperCase(),
        },
      ],
    }
  );

  //console.log("Results of Update: ", JSON.stringify(results))

  const updatedLots: Lot[] = await (await getUserById(user._id)).positions.filter(
    (position: { symbol: string }) => {
      return position.symbol.toUpperCase() === symbol.toUpperCase();
    }
  )[0].lots;

  //console.log("New lots after split: ", JSON.stringify(updatedLots))

};

export const insertDividend = async (
  user: Document,
  symbol: string,
  date: Date,
  amount: number,
  shares: number
) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  const totalDividend = amount * shares;
  const newCash = (await getCash(user)) + totalDividend;
  const newDate = new Date(date);

  await collection.updateOne(
    { _id: user._id },
    {
      $push: {
        transactions: {
          date: newDate,
          type: TransactionType.DIVIDEND,
          amount: totalDividend,
          cash: newCash,
          symbol,
          shares,
        },
      },
    }
  );

  await collection.updateOne(
    { _id: user._id },
    {
      $set: {
        cash: newCash,
      },
    }
  );
};

export const makeGift = async (user: Document, amount: number) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");
  await collection.updateOne(
    { _id: user._id },
    {
      $push: {
        transactions: {
          date: new Date(),
          type: TransactionType.GIFT,
          amount: amount,
          cash: amount,
        },
      },
    }
  );

  await collection.updateOne(
    { _id: user._id },
    {
      $set: {
        cash: amount,
      },
    }
  );
};

// export const makePurchase = async (user:Document,  asset:Asset,
//   shares:number, prices:StockPrices) => {

// }

export const getCash = async (user: Document): Promise<number> => {
  return (await getUserById(user._id)).cash;
};

export const getAssets = async (user: Document): Promise<Asset[]> => {
  // Promise.all waits for all promises in the passed in array to
  const assetsArray: Asset[] = await Promise.all(
    user.positions.map(async (currentPosition: Position) => {
      const currentSymbol: string = currentPosition.symbol;
      const currentName: string = await lookupTicker(currentSymbol);
      const currentPrice: SpotPrice = await getPrice(currentSymbol);
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
    foundUser.transactions.map(async (currentTransaction: Transaction) => {
      const currentDate: Date = currentTransaction.date;
      const currentSymbol: string = currentTransaction.symbol;
      const currentName: string = await lookupTicker(currentSymbol);
      const currentType: TransactionType = currentTransaction.type;
      const currentAmount: number = currentTransaction.amount;
      const currentShares: number = currentTransaction.shares;
      const currentCash: number = currentTransaction.cash;

      const currentCommission: number = currentTransaction.commission;
      const currentFrom: number = currentTransaction.from;
      const currentTo: number = currentTransaction.to;

      const transaction = {
        symbol: currentSymbol,
        name: currentName,
        date: currentDate,
        type: currentType,
        amount: currentAmount,
        shares: currentShares,
        cash: currentCash,
        commission: currentCommission,
        from: currentFrom,
        to: currentTo,
      };

      return transaction;
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
    const lot: Lot = { shares: shares, basis: totalPrice / shares };
    await createPosition(user, tickerSymbol, lot);

    const cash = user.cash - totalPrice;
    await client.connect();
    const db = client.db("investments");
    const collection = db.collection("investors");
    await createTransaction(
      user,
      TransactionType.BUY,
      tickerSymbol,
      shares,
      totalPrice,
      cash,
      COMMISSION
    );

    await collection.updateOne(
      { email: user.email },
      {
        $set: {
          cash: cash,
        },
      }
    );
    return true;
  } catch (ex) {
    console.error(ex);
    return false;
  }
};

export const sellAsset = async (
  user: Document,
  tickerSymbol: string,
  shares: number,
  bidPrice: number,
  date:Date = new Date (Date.now())
) => {
  try {
    const totalProceeds: number = bidPrice * shares - COMMISSION;
    await sellPosition(user, tickerSymbol, shares);

    const cash = user.cash + totalProceeds;
    await client.connect();
    const db = client.db("investments");
    const collection = db.collection("investors");
    await createTransaction(
      user,
      TransactionType.SELL,
      tickerSymbol,
      shares,
      totalProceeds,
      cash,
      COMMISSION,
      date
    );

    await collection.updateOne(
      { email: user.email },
      {
        $set: {
          cash: cash,
        },
      }
    );
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
  symbol: string,
  shares: number,
  amount: number,
  cash: number,
  commission: number,
  date: Date = new Date (Date.now())
) => {
  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  await collection.updateOne(
    { email: user.email },
    {
      $push: {
        transactions: {
          date,
          type,
          amount,
          shares,
          symbol,
          cash,
          commission,
        },
      },
    }
  );
};

export const sellPosition = async (
  user: Document,
  tickerSymbol: string,
  sharesToSell: number
) => {
  const positions = user.positions;
  // Find the specific position from a ticker, grab the lots, and reverse them.
  const reversedLotsByTicker: Lot[] = positions
    .filter((position: { symbol: string }) => {
      return position.symbol.toUpperCase() === tickerSymbol.toUpperCase();
    })[0]
    .lots.reverse();

  // TODO: move this validation one level higher

  // const validateSale = (lots:Lot[], amountToAttemptToSell): boolean =>{
  //   const totalAvailableSharesToSell:number = lots.reduce((prevLot, nextLot)=>{return prevLot + nextLot.shares},0)
  //   return totalAvailableSharesToSell >= amountToAttemptToSell;
  // }

  // if(validateSale(reversedLotsByTicker, sharesToSell)){
  //   console.log(`Sale is valid, you have ${reversedLotsByTicker} lots`)
  //   console.log("Proceeding to sale...")
  // } else {
  //   console.log(`Sale is invalid!, you have ${reversedLotsByTicker} lots`)
  // }
  let saleQuota: number = sharesToSell;
  while (saleQuota !== 0) {
    const someSoldLot = reversedLotsByTicker.pop();
    console.log(
      `Selling lot... {shares: ${someSoldLot.shares} basis: ${someSoldLot.basis}}`
    );
    const proposedSharesToBeSold = someSoldLot.shares;
    if (proposedSharesToBeSold >= saleQuota) {
      // We just sold off the remaining shares with this lot.
      const remainder = proposedSharesToBeSold - saleQuota;
      if (remainder > 0) {
        // If we sold the exact amount, don't push a lot with zero shares.
        reversedLotsByTicker.push({
          shares: remainder,
          basis: someSoldLot.basis,
        });
      }
      // Set the saleQuota to 0 to break the while loop.
      saleQuota = 0;
    } else {
      saleQuota = saleQuota - proposedSharesToBeSold;
    }
  }

  const newLotsInOriginalOrder = reversedLotsByTicker.reverse();

  await client.connect();
  const db = client.db("investments");
  const collection = db.collection("investors");

  if (newLotsInOriginalOrder.length > 0) {
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          "positions.$[p].lots": newLotsInOriginalOrder,
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
  }

  // oops! we sold every last one - axe the entire position
  else {
    await collection.updateOne(
      { _id: user._id },
      {
        $pull: {
          positions: { symbol: tickerSymbol },
        },
      }
    );
  }
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
  //console.log("pushing new position ", JSON.stringify(newPosition));
  const result: UpdateResult = await collection.updateOne(user, {
    $push: {
      positions: newPosition,
    },
  });
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
    { _id: user._id },
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
