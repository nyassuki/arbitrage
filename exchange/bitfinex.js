const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Base URL for Bitfinex API
const BASE_URL = 'https://api.bitfinex.com/v2';

// API credentials from environment variables
const API_KEY = process.env.BITFINEX_API_KEY;
const API_SECRET = process.env.BITFINEX_API_SECRET;

// Validate API credentials
if (!API_KEY || !API_SECRET) {
    throw new Error('BITFINEX_API_KEY and BITFINEX_API_SECRET must be set in the environment variables');
}

/**
 * Generates the headers required for authenticated Bitfinex API requests.
 * @param {string} path - The API endpoint path (e.g., /v2/auth/r/wallets).
 * @param {Object} body - The request body (for POST requests).
 * @returns {Object} - The headers including the signature, nonce, and API key.
 */
function generateHeaders(path, body = {}) {
    const nonce = Date.now().toString(); // Unique nonce for each request
    const payload = `/api${path}${nonce}${JSON.stringify(body)}`; // Payload for signature
    const signature = crypto
        .createHmac('sha384', API_SECRET) // HMAC-SHA384 signature
        .update(payload)
        .digest('hex');

    return {
        'bfx-nonce': nonce, // Nonce for request
        'bfx-apikey': API_KEY, // API key
        'bfx-signature': signature, // Generated signature
        'Content-Type': 'application/json' // Content type
    };
}

/**
 * Fetches the exchange rate for a trading pair.
 * @param {string} fromToken - The token to trade from (e.g., BTC).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @returns {Promise<Object>} - The exchange rate and reverse price.
 */
async function getExchangeRate(fromToken, toToken) {
    const pair = `t${fromToken}${toToken}`; // Format trading pair (e.g., tBTCUSD)
    const endpoint = `/ticker/${pair}`; // API endpoint
    const url = BASE_URL + endpoint;

    try {
		let exchang=await checkTradingPairExists(fromToken, toToken);
		if(exchang==true) {
			const response = await axios.get(url);
			if (response.data && response.data.length > 0) {
				return { price: response.data[6], reserve_price: (1 / response.data[6]) }; // Return price and reverse price
			}
			return { price: 0, reserve_price: 0 }; // Return 0 if no data
		} else {
			return { price: 0, reserve_price: 0 };
		}
    } catch (error) {
        return { price: 0, reserve_price: 0, pair: pair, error: error.response?.data }; // Return error details
    }
}

/**
 * Swaps tokens (if supported by Bitfinex).
 * @param {string} from - The asset to swap from (e.g., BTC).
 * @param {string} to - The asset to swap to (e.g., USD).
 * @param {number} amount - The amount to swap.
 * @returns {Promise<Object>} - The swap response.
 */
async function swapTokens(from, to, amount) {
    const endpoint = '/auth/w/transfer'; // API endpoint for transfers
    const url = BASE_URL + endpoint;

    const body = {
        from: 'exchange', // Source wallet
        to: 'margin', // Destination wallet
        currency: from, // Currency to swap from
        currencyTo: to, // Currency to swap to
        amount: amount.toString() // Amount to swap
    };

    const headers = generateHeaders(endpoint, body); // Generate headers

    try {
        const response = await axios.post(url, body, { headers });
        return response.data; // Return swap response
    } catch (error) {
        console.error('Error swapping tokens:', error.response ? error.response.data : error.message);
        throw error; // Throw error for handling
    }
}

/**
 * Withdraws a token from Bitfinex.
 * @param {string} asset - The asset to withdraw (e.g., BTC).
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @param {string} network - The blockchain network (e.g., Bitcoin).
 * @returns {Promise<Object>} - The withdrawal response.
 */
async function withdrawToken(asset, amount, address, network) {
    const endpoint = '/auth/w/withdraw'; // API endpoint for withdrawals
    const url = BASE_URL + endpoint;

    const body = {
        wallet: 'exchange', // Source wallet
        method: asset, // Asset to withdraw
        amount: amount.toString(), // Amount to withdraw
        address, // Destination address
        network // Blockchain network
    };

    const headers = generateHeaders(endpoint, body); // Generate headers

    try {
        const response = await axios.post(url, body, { headers });
        return response.data; // Return withdrawal response
    } catch (error) {
        console.error('Error withdrawing token:', error.response ? error.response.data : error.message);
        throw error; // Throw error for handling
    }
}

/**
 * Fetches the balance of a specific asset.
 * @param {string} asset - The asset (e.g., BTC).
 * @returns {Promise<Object>} - The balance response.
 */
async function getBalanceByAsset(asset) {
    const endpoint = '/auth/r/wallets'; // API endpoint for wallets
    const url = BASE_URL + endpoint;

    const headers = generateHeaders(endpoint); // Generate headers

    try {
        const response = await axios.post(url, {}, { headers });
        if (response.data && Array.isArray(response.data)) {
            const wallet = response.data.find(w => w[0] === 'exchange' && w[1] === asset); // Find wallet for the asset
            if (wallet) {
                return { asset, balance: wallet[2] }; // Return asset balance
            }
        }
        throw new Error('Balance not found for the specified asset'); // Throw error if balance not found
    } catch (error) {
        throw error; // Throw error for handling
    }
}

/**
 * Checks if a trading pair exists on Bitfinex.
 * @param {string} tokenA - The first token in the pair (e.g., BTC).
 * @param {string} tokenB - The second token in the pair (e.g., USDT).
 * @returns {Promise<boolean>} - True if the trading pair exists, false otherwise.
 */
async function checkTradingPairExists(tokenA, tokenB) {
    try {
        const response = await axios.get("https://api-pub.bitfinex.com/v2/conf/pub:list:pair:exchange"); // Fetch trading pairs
        if (response.data && response.data.length > 0) {
            const tradingPairs = response.data[0]; // Bitfinex returns an array inside an array
            const tradingPair = `${tokenA}${tokenB}`.toUpperCase(); // Convert to uppercase (Bitfinex format)

            if (tradingPairs.includes(tradingPair)) {
                //console.log(`✅ Trading pair available: ${tokenA}/${tokenB}`);
                return true; // Return true if pair exists
            } else {
                //console.log(`❌ Trading pair NOT available: ${tokenA}/${tokenB}`);
                return false; // Return false if pair does not exist
            }
        } else {
            console.log("⚠️ No trading symbols found.");
            return false; // Return false if no symbols found
        }
    } catch (error) {
        return false; // Return false on error
    }
}

/**
 * Main function for testing the Bitfinex API functions.
 */
// Export functions for external use
module.exports = {
    getExchangeRate,
    swapTokens,
    withdrawToken,
    getBalanceByAsset,
    checkTradingPairExists
};

// Run the main function if this script is executed directly
if (require.main === module) {
    main();
}

async function main() {
	let exch = await checkTradingPairExists("BTC", "USD");
	console.log(exch);
}