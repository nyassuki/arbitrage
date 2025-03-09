const axios = require('axios');
require('dotenv').config(); // Load .env file

// Replace with your OKX API credentials
const API_KEY = process.env.OKX_API_KEY;
const API_SECRET = process.env.OKX_API_SECRET;
const PASSPHRASE = 'Sahabat1234!'; // Replace with your OKX API passphrase
const { RestClient } = require('okx-api');

// Initialize the OKX REST client
const client = new RestClient({
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    apiPass: PASSPHRASE,
});

/**
 * Fetches the balance of a specific asset.
 * @param {string} token - The token (e.g., USDT).
 * @returns {Promise<Object>} - The balance response containing free and locked amounts.
 */
async function getBalanceByAsset(token) {
    try {
        const response = await client.getBalance(token);
		
        if (response && response.length > 0) {
            return { free: parseFloat(response[0].totalEq), locked: parseFloat(response[0].isoEq) };
        } else {
            //console.error(`No balance data found for ${token}`);
            return { free: 0, locked: 0 };
        }
    } catch (error) {
        return { free: 0, locked: 0 };
    }
}

/**
 * Fetches the exchange rate for a trading pair.
 * @param {string} fromToken - The token to trade from (e.g., DGB).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @returns {Promise<Object>} - The exchange rate response containing price and reverse price.
 */
async function getExchangeRate(fromToken, toToken) {
    const params = `${fromToken}-${toToken}-SWAP`; // Format trading pair for OKX
    try {
		let swapable = await checkTradingPair(fromToken, toToken);
		if(swapable==true) {
			const response = await client.getTicker(params);
			if (response && response.length > 0) {
				return { price: parseFloat(response[0].last), reverse_price: 1 / response[0].last };
			} else {
				//console.error(`No exchange rate data found for ${fromToken}-${toToken}`);
				return { price: 0, reverse_price: 0 };
			}
		} else {
			return { price: 0, reverse_price: 0 };
		}
    } catch (error) {
        return { price: 0, reverse_price: 0 };
    }
}

/**
 * Withdraws a token from OKX.
 * @param {string} asset - The asset to withdraw (e.g., USDT).
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @returns {Promise<Object>} - The withdrawal response.
 */
async function withdrawToken(asset, amount, address) {
    const params = {
        ccy: asset, // Currency to withdraw
        amt: amount, // Amount to withdraw
        dest: 4, // Destination (4 for external wallet)
        toAddr: address, // Destination address
        chain: "USDT-X Layer" // Blockchain network
    };

    try {
        const response = await client.submitWithdraw(params);
        return response; // Return withdrawal response
    } catch (error) {
        return { code: -1, msg: error.message }; // Return error details
    }
}

/**
 * Swaps tokens on OKX.
 * @param {string} fromToken - The token to trade from (e.g., ETH).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @param {string} tradeType - The trade type (e.g., buy, sell).
 * @param {number} amount - The amount to trade.
 * @returns {Promise<Object>} - The swap response.
 */
async function swapTokens(fromToken, toToken, tradeType, amount) {
    const params = {
        baseCcy: fromToken, // Base currency
        quoteCcy: toToken, // Quote currency
        side: tradeType.toLowerCase(), // Trade type (buy/sell)
        sz: amount, // Amount to trade
        szCcy: fromToken, // Currency of the amount
        quoteId: `${fromToken}-${toToken}-${amount}` // Unique quote ID
    };

    try {
        const response = await client.convertTrade(params);
        return response; // Return swap response
    } catch (error) {
        return { code: -1, msg: error.code }; // Return error details
    }
}

/**
 * Fetches currency information for a specific asset.
 * @param {string} asset - The asset (e.g., USDT).
 * @returns {Promise<Array>} - An array of chain information for the asset.
 */
async function getCurrency(asset) {
    try {
        const response = await client.getCurrencies(asset);
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data.map(chain => ({
                chain: chain.chain, // Blockchain network
                minFee: chain.minFee, // Minimum withdrawal fee
                maxFee: chain.maxFee, // Maximum withdrawal fee
                canDeposit: chain.canDep, // Whether deposits are allowed
                canWithdraw: chain.canWd, // Whether withdrawals are allowed
            }));
        } else {
            //console.log(`⚠️ No chain data found for ${asset}`);
            return []; // Return empty array if no data found
        }
    } catch (error) {
        return []; // Return empty array on error
    }
}
async function getWalletAddress(currency, network) {
    try {
        const searchTerm = `${currency}-${network}`.toLowerCase(); // Convert to lowercase for case-insensitive matching

        // Fetch deposit addresses
        const response = await client.getDepositAddress(currency);

        // Find the address matching the search term
        const result = response.find(item =>
            item.chain.toLowerCase().includes(searchTerm)
        );

        if (result) {
            return { address: result.addr};
        } else {
             return { address: 0};
        }
    } catch (error) {
          return { address: 0};
    }
}
async function checkTradingPair(tokenA, tokenB) {
  const instFamily = `${tokenA}-${tokenB}`;

  try {
    // Fetch all SWAP instruments
    const response = await client.getInstruments("SWAP");

    // Filter instruments by instFamily
    const filteredInstruments = response.filter(
      (instrument) => instrument.instFamily === instFamily
    );

    // Return true if at least one instrument matches the instFamily
    return filteredInstruments.length > 0;
  } catch (error) {
    //console.error("Error fetching instruments:", error);
    return false; // Return false in case of an error
  }
}

//main()
async function main() {
	let address = await checkTradingPair("BTC", "USDT");
	console.log(address);
}
module.exports = {
    getExchangeRate,
    swapTokens,
    withdrawToken,
    getBalanceByAsset,
    getCurrency,
	getWalletAddress
};