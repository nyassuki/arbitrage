const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Todobit API base URL
const BASE_URL = 'https://api.todobit.com'; // Replace with the actual Todobit API base URL

// API credentials from environment variables
const API_KEY = process.env.TODOBIT_API_KEY;
const SECRET_KEY = process.env.TODOBIT_SECRET_KEY;
const PASSPHRASE = process.env.TODOBIT_PASSPHRASE || ''; // Optional, if required by Todobit

// Validate API credentials
if (!API_KEY || !SECRET_KEY) {
    throw new Error('TODOBIT_API_KEY and TODOBIT_SECRET_KEY must be set in the environment variables');
}

/**
 * Generates the HMAC-SHA256 signature for Todobit API requests.
 * @param {string} timestamp - The current timestamp in milliseconds.
 * @param {string} method - The HTTP method (e.g., GET, POST).
 * @param {string} endpoint - The API endpoint (e.g., /api/v1/exchange-rate).
 * @param {string} body - The request body (for POST requests) or query string (for GET requests).
 * @returns {string} - The HMAC-SHA256 signature in Base64.
 */
function generateSignature(timestamp, method, endpoint, body = '') {
    const message = timestamp + method + endpoint + body; // Combine timestamp, method, endpoint, and body
    const hmac = crypto.createHmac('sha256', SECRET_KEY); // Create HMAC-SHA256 instance
    hmac.update(message); // Update HMAC with the message
    return hmac.digest('base64'); // Generate and return the signature in Base64
}

/**
 * Fetches the exchange rate for a trading pair.
 * @param {string} fromToken - The token to trade from (e.g., BTC).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @returns {Promise<Object>} - The exchange rate response containing price and reverse price.
 */
async function getExchangeRate(fromToken, toToken) {
    const pair = `${fromToken}-${toToken}`; // Format trading pair (e.g., BTC-USDT)
    const endpoint = `/api/v1/exchange-rate?pair=${pair}`; // API endpoint
    const url = BASE_URL + endpoint; // Full API URL
    const method = 'GET'; // HTTP method

    const timestamp = Date.now().toString(); // Current timestamp
    const signature = generateSignature(timestamp, method, endpoint); // Generate signature

    try {
        const response = await axios.get(url, {
            headers: {
                'X-API-KEY': API_KEY, // API key
                'X-SIGNATURE': signature, // Generated signature
                'X-TIMESTAMP': timestamp, // Timestamp
                'X-PASSPHRASE': PASSPHRASE, // Optional passphrase
            },
        });

        if (response.data && response.data.rate) {
            const price = parseFloat(response.data.rate); // Extract price
            const reversePrice = 1 / price; // Calculate reverse price
            return { price, reverse_price: reversePrice }; // Return price and reverse price
        } else {
            throw new Error('Exchange rate not found in response'); // Throw error if rate is missing
        }
    } catch (error) {
        return { price: 0, reverse_price: 0 }; // Return 0 on error
    }
}

/**
 * Swaps tokens (if supported by Todobit).
 * @param {string} fromToken - The token to trade from (e.g., BTC).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @param {number} amount - The amount to swap.
 * @returns {Promise<Object>} - The swap response.
 */
async function swapTokens(fromToken, toToken, amount) {
    const endpoint = '/api/v1/swap'; // API endpoint for swaps
    const url = BASE_URL + endpoint; // Full API URL
    const method = 'POST'; // HTTP method

    const body = JSON.stringify({
        from: fromToken, // Token to swap from
        to: toToken, // Token to swap to
        amount: amount.toString(), // Amount to swap
    });

    const timestamp = Date.now().toString(); // Current timestamp
    const signature = generateSignature(timestamp, method, endpoint, body); // Generate signature

    try {
        const response = await axios.post(url, body, {
            headers: {
                'X-API-KEY': API_KEY, // API key
                'X-SIGNATURE': signature, // Generated signature
                'X-TIMESTAMP': timestamp, // Timestamp
                'X-PASSPHRASE': PASSPHRASE, // Optional passphrase
                'Content-Type': 'application/json', // Content type
            },
        });

        return response.data; // Return swap response
    } catch (error) {
        return { code: -1, msg: error.message }; // Return error details
    }
}

/**
 * Withdraws a token from Todobit.
 * @param {string} asset - The asset to withdraw (e.g., BTC).
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @param {string} network - The blockchain network (e.g., Bitcoin).
 * @returns {Promise<Object>} - The withdrawal response.
 */
async function withdrawToken(asset, amount, address, network) {
    const endpoint = '/api/v1/withdraw'; // API endpoint for withdrawals
    const url = BASE_URL + endpoint; // Full API URL
    const method = 'POST'; // HTTP method

    const body = JSON.stringify({
        asset: asset.toUpperCase(), // Asset to withdraw
        amount: amount.toString(), // Amount to withdraw
        address, // Destination address
        network, // Blockchain network
    });

    const timestamp = Date.now().toString(); // Current timestamp
    const signature = generateSignature(timestamp, method, endpoint, body); // Generate signature

    try {
        const response = await axios.post(url, body, {
            headers: {
                'X-API-KEY': API_KEY, // API key
                'X-SIGNATURE': signature, // Generated signature
                'X-TIMESTAMP': timestamp, // Timestamp
                'X-PASSPHRASE': PASSPHRASE, // Optional passphrase
                'Content-Type': 'application/json', // Content type
            },
        });

        return response.data; // Return withdrawal response
    } catch (error) {
        return { code: -1, msg: error.message }; // Return error details
    }
}

/**
 * Fetches the balance of a specific asset.
 * @param {string} asset - The asset (e.g., BTC).
 * @returns {Promise<Object>} - The balance response containing free and locked amounts.
 */
async function getBalanceByAsset(asset) {
    const endpoint = `/api/v1/balance?asset=${asset.toUpperCase()}`; // API endpoint for balance
    const url = BASE_URL + endpoint; // Full API URL
    const method = 'GET'; // HTTP method

    const timestamp = Date.now().toString(); // Current timestamp
    const signature = generateSignature(timestamp, method, endpoint); // Generate signature

    try {
        const response = await axios.get(url, {
            headers: {
                'X-API-KEY': API_KEY, // API key
                'X-SIGNATURE': signature, // Generated signature
                'X-TIMESTAMP': timestamp, // Timestamp
                'X-PASSPHRASE': PASSPHRASE, // Optional passphrase
            },
        });

        if (response.data && response.data.balance) {
            return { free: parseFloat(response.data.balance.free), locked: parseFloat(response.data.balance.locked) }; // Return free and locked balances
        } else {
            throw new Error('Balance not found in response'); // Throw error if balance is missing
        }
    } catch (error) {
        return { free: 0, locked: 0 }; // Return 0 on error
    }
}

// Export functions for external use
module.exports = {
    getExchangeRate,
    swapTokens,
    withdrawToken,
    getBalanceByAsset,
};