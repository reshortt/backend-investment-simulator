const yahooStockAPI = require("yahoo-stock-api");
const yahooHistory = require("yahoo-finance-history");
const ticker = require('stock-ticker-symbol');

export async function checkFavoriteStock(tickerSymbol: string) {
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

export const getPrice = async (tickerSymbol: string): Promise<number> => {
  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);
  console.log("stock info for ", tickerSymbol, " is ", symbol);
  const data = await yahooHistory.getPriceHistory(tickerSymbol);
  console.log(await data.dividendHistory);
  let bid: string = symbol.response.bid.split(" x ")[0];
  bid = bid.replace(",", "");
  console.log("bid = ", bid, " and ", Number(bid));
  if (Number(bid) > 0) {
    return Number(bid);
  }
  return Number(symbol.response.previousClose);
};

export const isValidSymbol = async (tickerSymbol: string): Promise<boolean> => {

  const name:string = await ticker.lookup(tickerSymbol)
  if (!name) {
    return false;
  }

  console.log(`${tickerSymbol} is ${name}`)

  const symbol = await yahooStockAPI.getSymbol(tickerSymbol);
  
  const isError: boolean = Boolean(symbol.error);
  if (isError) return false;
  if (symbol.response.previousClose == null) return false;
  return true;
};
