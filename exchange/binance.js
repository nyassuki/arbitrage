const Binance = require('node-binance-api');
require('dotenv').config();

// Initialize Binance API
const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY, // Replace with your Binance API key
  APISECRET: process.env.BINANCE_SECRET_KEY // Replace with your Binance API secret
});

// Validate API credentials
if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_SECRET_KEY) {
  throw new Error('API key or secret key is missing. Please check your .env file.');
}

/**
 * Fetches the balance of a specific asset from Binance.
 * @param {string} asset - The asset to fetch the balance for (e.g., BTC).
 * @returns {Promise<Object>} - The balance response containing free and locked amounts.
 */
async function getBalanceByAsset(asset) {
  try {
    const accountInfo = await binance.balance(); // Fetch account balance
    const assetBalance = accountInfo[asset.toUpperCase()]; // Get balance for the specific asset

    if (assetBalance) {
      return { free: parseFloat(assetBalance.available), locked: parseFloat(assetBalance.onOrder) };
    } else {
      return { free: 0, locked: 0 }; // Return 0 if asset not found
    }
  } catch (error) {
    //console.error('Error fetching balance:', error);
    return { free: 0, locked: 0 }; // Return 0 on error
  }
}

/**
 * Places an order to swap tokens on Binance.
 * @param {string} fromToken - The token to trade from (e.g., BTC).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @param {string} side - The side of the trade (e.g., BUY or SELL).
 * @param {number} quantity - The quantity of the token to trade.
 * @param {number|null} price - The price for limit orders (optional).
 * @returns {Promise<Object>} - The order response.
 */
async function swapTokens(fromToken, toToken, side, quantity, price = null) {
  try {
    const symbol = `${fromToken}${toToken}`.toUpperCase(); // Trading pair symbol (e.g., BTCUSDT)

    // Place the order
    const order = await binance.order(side.toUpperCase(), symbol, quantity, price, {
      type: price ? 'LIMIT' : 'MARKET', // LIMIT or MARKET order
      timeInForce: price ? 'GTC' : undefined, // Good 'til canceled for limit orders
    });

    return order; // Return order response
  } catch (error) {
    return { code: -1, msg: error.message }; // Return error details
  }
}

/**
 * Withdraws tokens from Binance.
 * @param {string} asset - The asset to withdraw (e.g., BTC).
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @param {string|null} network - The blockchain network (optional).
 * @param {string|null} addressTag - The address tag (optional).
 * @returns {Promise<Object>} - The withdrawal response.
 */
async function withdrawToken(asset, amount, address, network = null, addressTag = null) {
  try {
    const withdrawal = await binance.withdraw(asset.toUpperCase(), amount.toString(), address, {
      network, // Optional: Specify the network
      addressTag, // Optional: Specify the address tag
    });

    return withdrawal; // Return withdrawal response
  } catch (error) {
    return { code: -1, msg: error.message }; // Return error details
  }
}

/**
 * Fetches the exchange rate for a specific trading pair.
 * @param {string} fromToken - The token to trade from (e.g., BTC).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @returns {Promise<Object>} - The exchange rate response containing price and reverse price.
 */
async function getExchangeRate(fromToken, toToken) {

  try {
	let exchangeAble = await checkTradingPair(fromToken, toToken);
	if(exchangeAble==true) {
		const symbol = `${fromToken}${toToken}`.toUpperCase(); // Trading pair symbol (e.g., BTCUSDT)

		// Fetch ticker price
		const ticker = await binance.prices(symbol);
		const price = parseFloat(ticker[symbol]); // Extract price from response
		const reversePrice = 1 / price; // Calculate reverse price

		return { price, reverse_price: reversePrice }; // Return price and reverse price
	} else {
		 return { price: 0, reverse_price: 0 };
	}
  } catch (error) {
    return { price: 0, reverse_price: 0 }; // Return 0 on error
  }
}

/**
 * Fetches the deposit address for a specific asset and network.
 * @param {string} coin - The asset (e.g., 'BTC', 'USDT').
 * @param {string} network - The network (e.g., 'ERC20', 'TRC20').
 * @returns {Promise<Object>} - Response object with status code, message, and data.
 */
async function getWalletAddress(coin, network = '') {
  try {
    const depositAddress = await binance.depositAddress({ asset: coin.toUpperCase(), network: network.toUpperCase() });
    return { address: depositAddress.address }; // Return deposit address
  } catch (error) {
		return { address: 0 }; // Return null on error
  }
}

/**
 * Checks if a trading pair exists between two tokens.
 * @param {string} tokenA - The first token (e.g., BTC).
 * @param {string} tokenB - The second token (e.g., USDT).
 * @returns {Promise<void>} - Logs the result to the console.
 */
async function checkTradingPair(tokenA, tokenB) {
  try {
    const exchangeInfo = await binance.exchangeInfo(); // Fetch all trading pairs
    const symbols = exchangeInfo.symbols;

    // Check if the direct pair (TOKENA/TOKENB) exists
    const directPair = `${tokenA}${tokenB}`.toUpperCase();
    const directPairExists = symbols.find(symbol => symbol.symbol === directPair);
	//console.log(directPairExists);
    if (directPairExists) {
      // Check if the pair is currently trading
      if (directPairExists.status === "TRADING") {
        return true; // Pair exists and is trading
      } else {
        return false; // Pair exists but is not trading
      }
    } else {
      return false; // Pair does not exist
    }
  } catch (error) {
    //console.error('Error fetching trading pairs:', error);
    return false; // Return false on error
  }
}

// Example usage
async function main() {
  const balance = await getBalanceByAsset('BTC');
  console.log('BTC Balance:', balance);

  const exchangeRate = await getExchangeRate('BTC', 'USDT');
  console.log('BTC/USDT Exchange Rate:', exchangeRate);

  const walletAddress = await getWalletAddress('BTC', '');
  console.log('BTC Wallet Address:', walletAddress);
  
  const xxx= await checkTradingPair('XMR', 'USDT');
  console.log(xxx);
}

//main();

// Export functions for external use
module.exports = {
  getExchangeRate,
  swapTokens,
  withdrawToken,
  getBalanceByAsset,
  getWalletAddress,
  checkTradingPair,
};