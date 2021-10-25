const yahooStockAPI = require("yahoo-stock-api");
const yahooHistory = require("yahoo-finance-history") 


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