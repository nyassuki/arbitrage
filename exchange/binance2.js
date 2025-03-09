const { Spot, Wallet } = require('@binance/connector'); // Import Binance connector
require('dotenv').config(); // Load environment variables from .env file

// Binance API credentials from environment variables
const API_KEY = process.env.BINANCE_API_KEY; // Binance API key
const API_SECRET = process.env.BINANCE_SECRET_KEY; // Binance API secret key

// Initialize Binance Spot and Wallet clients
const spotClient = new Spot(API_KEY, API_SECRET); // Spot trading client
const walletClient = new Wallet(API_KEY, API_SECRET); // Wallet management client

/**
 * Fetches the exchange rate for a trading pair using the Binance Swap API.
 *
 * @param {string} fromAsset - The base currency (e.g., 'BTC').
 * @param {string} toAsset - The quote currency (e.g., 'USDT').
 * @returns {Promise<Object>} - The exchange rate response containing price and reverse price.
 */
async function getExchangeRate(fromAsset, toAsset) {
    try {
        const symbol = `${fromAsset}${toAsset}`; // Trading pair symbol (e.g., BTCUSDT)
        const response = await spotClient.tickerPrice(symbol); // Fetch ticker price

        if (response.data && response.data.price) {
            const price = parseFloat(response.data.price); // Extract price
            const reversePrice = 1 / price; // Calculate reverse price
            return { price, reverse_price: reversePrice }; // Return price and reverse price
        } else {
            throw new Error('Exchange rate data not found in response'); // Throw error if data is missing
        }
    } catch (error) {
        console.error('Error fetching exchange rate:', error.response ? error.response.data : error.message);
        return { price: 0, reverse_price: 0 }; // Return 0 on error
    }
}

/**
 * Swaps tokens using the Binance Swap API.
 *
 * @param {string} fromAsset - The asset to swap from (e.g., 'BTC').
 * @param {string} toAsset - The asset to swap to (e.g., 'USDT').
 * @param {number} amount - The amount to swap.
 * @returns {Promise<Object>} - The swap response.
 */
async function swapTokens(fromAsset, toAsset, amount) {
    try {
        const symbol = `${fromAsset}${toAsset}`; // Trading pair symbol (e.g., BTCUSDT)
        const response = await spotClient.newOrder(symbol, 'MARKET', 'BUY', { quantity: amount }); // Place a market buy order

        if (response.data && response.data.orderId) {
            return response.data; // Return the order response
        } else {
            throw new Error('Swap order failed'); // Throw error if order failed
        }
    } catch (error) {
        console.error('Error swapping tokens:', error.response ? error.response.data : error.message);
        throw error; // Throw error for handling
    }
}

/**
 * Withdraws tokens from Binance.
 *
 * @param {string} asset - The asset to withdraw (e.g., 'BTC').
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @param {string} network - The blockchain network (e.g., 'ERC20').
 * @returns {Promise<Object>} - The withdrawal response.
 */
async function withdrawToken(asset, amount, address, network) {
    try {
        const response = await walletClient.withdraw(asset, address, amount, { network }); // Initiate withdrawal

        if (response.data && response.data.id) {
            return response.data; // Return the withdrawal response
        } else {
            throw new Error('Withdrawal failed'); // Throw error if withdrawal failed
        }
    } catch (error) {
        console.error('Error withdrawing token:', error.response ? error.response.data : error.message);
        throw error; // Throw error for handling
    }
}

/**
 * Fetches the balance of a specific asset from Binance.
 *
 * @param {string} asset - The asset (e.g., 'BTC').
 * @returns {Promise<Object>} - The balance response containing free and locked amounts.
 */
async function getBalanceByAsset(asset) {
    try {
        const response = await walletClient.userAsset(); // Fetch user assets

        if (response.data && Array.isArray(response.data)) {
            const balance = response.data.find((b) => b.asset === asset); // Find the specific asset balance

            if (balance) {
                return {
                    free: parseFloat(balance.free), // Free balance
                    locked: parseFloat(balance.locked), // Locked balance
                };
            } else {
                throw new Error('Asset balance not found'); // Throw error if asset not found
            }
        } else {
            throw new Error('Invalid balance data'); // Throw error if data is invalid
        }
    } catch (error) {
        console.error('Error fetching balance:', error.response ? error.response.data : error.message);
        throw error; // Throw error for handling
    }
}

// Export functions for external use
module.exports = {
    getExchangeRate,
    swapTokens,
    withdrawToken,
    getBalanceByAsset,
};