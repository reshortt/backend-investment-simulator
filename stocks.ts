import { HistoricalPrice, StockPrices } from "./types";

const yahooStockAPI = require("yahoo-stock-api");
const yahooHistory = require("yahoo-finance-history");
const ticker = require("stock-ticker-symbol");

export const getHistoricalPrices = async (
  tickerSymbol: string
): Promise<HistoricalPrice[]> => {
  const prices: HistoricalPrice[] = [];

  const data = await yahooHistory.getPriceHistory(tickerSymbol);
  const priceHistory = await data.priceHistory;
  const priceHistoryRows: string[] = priceHistory.toString().split("\n");

  for (var row = 1; row < priceHistoryRows.length; ++row) {
    const rowString = priceHistoryRows[row];
    //console.log(rowString);
    const columns: string[] = rowString.split(",");
    const price: HistoricalPrice = {
      date: new Date(columns[0]),
      price: Number(columns[3]),
    };
    prices.push(price);
  }
  return prices;
};

export const getPrice = async (tickerSymbol: string): Promise<StockPrices|undefined> => {
  if (!tickerSymbol)
    return undefined
  const stockInfo = await yahooStockAPI.getSymbol(tickerSymbol);
  //console.log("stock info for ", tickerSymbol, " is ", companyName);
  if (!stockInfo) {
    console.log("No stock info for ", tickerSymbol, " : ", stockInfo)
    return undefined
  }

  const previousClose: number = stockInfo.response.previousClose;

  // bid
  const bidString: string = stockInfo.response.bid
    .split(" x ")[0]
    .replace(",", "");
  const bid: number =
    Number(bidString) > 0 && Number(bidString) != NaN
      ? Number(bidString)
      : previousClose;

  // ask
  const askString: string = stockInfo.response.ask
    .split(" x ")[0]
    .replace(",", "");
  const ask: number =
    Number(askString) > 0 && Number(askString) != NaN
      ? Number(askString)
      : previousClose;

  const prices: StockPrices = {
    bid: bid,
    ask: ask,
    previousClose: previousClose,
  };

  //console.log("Returning new StockPrices Object: ", JSON.stringify(prices))
  return prices
};

export const isValidSymbol = async (tickerSymbol: string): Promise<boolean> => {
  const name: string = await ticker.lookup(tickerSymbol);
  if (!name) {
    return false;
  }

  //console.log(`${tickerSymbol} is ${name}`)

  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);

  const isError: boolean = Boolean(symbol.error);
  if (isError) return false;
  if (symbol.response.previousClose == null) return false;
  return true;
};

export const lookupTicker = async (tickerSymbol: string): Promise<string> => {
  if (!tickerSymbol)
    return "";
  const tickerName: string = await ticker.lookup(tickerSymbol);
  //console.log("TICKER LOOOKUP: ", tickerSymbol, "->", tickerName);
  return tickerName;
};

const priceMap = new Map<string, HistoricalPrice[]>();


export const getStockPriceOnDate = async (symbol:string, date:Date):Promise<number> => {
  let prices = priceMap.get(symbol);
  if (!prices || prices === undefined) {
    console.log ("Getting Price History for " + symbol + "...")
    prices = await getHistoricalPrices(symbol);
    priceMap.set(symbol, prices);
    console.log ("Finished getting Price History for ", symbol , ". Entries: ", prices.length)
  }

  let lastPrice: number = 0;
  let thisDate:Date = new Date(date)

  // brute force march from beginning to end
  for (let price of prices) {
    let priceDate:Date = new Date(price.date)

    if (priceDate > thisDate) {
        break
    } 
    lastPrice = price.price;
  }

  return lastPrice;
}

