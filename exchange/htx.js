require('dotenv').config(); // Load environment variables from .env file
const axios = require('axios'); // HTTP client for making API requests
const crypto = require('crypto'); // Crypto module for generating HMAC signatures

// Base URLs for HTX API
const BASE_URL = 'https://api.htx.com'; // HTX API base URL
const MARKET_URL = `${BASE_URL}/market/tickers`; // Endpoint for market tickers
const ORDER_URL = `${BASE_URL}/v1/order/orders/place`; // Endpoint for placing orders
const BALANCE_URL = `${BASE_URL}/v1/account/accounts`; // Endpoint for account balances
const HTX_WITHDRAW_URL = `${BASE_URL}/v1/dw/withdraw/api/create`; // Endpoint for withdrawals

// API credentials from environment variables
const ACCESS_KEY = process.env.HTX_ACCESS_KEY; // HTX API access key
const SECRET_KEY = process.env.HTX_SECRET_KEY; // HTX API secret key

/**
 * Generates the HMAC-SHA256 signature for HTX API requests.
 *
 * @param {string} method - HTTP method (e.g., 'GET', 'POST').
 * @param {string} endpoint - API endpoint (e.g., '/v1/order/orders/place').
 * @param {object} params - Query parameters for the request.
 * @returns {string} - Base64-encoded signature.
 */
function generateSignature(method, endpoint, params) {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
    const payload = `${method}\napi.htx.com\n${endpoint}\n${sortedParams}`;
    return crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('base64');
}

/**
 * Retrieves the account ID associated with the API key.
 *
 * @returns {string|null} - Account ID if successful, otherwise null.
 */
async function getAccountID() {
    try {
        const endpoint = '/v1/account/accounts';
        const timestamp = new Date().toISOString().replace(/\.\d+Z$/, '');

        const params = {
            AccessKeyId: ACCESS_KEY,
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            Timestamp: timestamp,
        };

        params.Signature = generateSignature('GET', endpoint, params);

        const url = `${BASE_URL}${endpoint}?${new URLSearchParams(params)}`;
        const response = await axios.get(url);

        if (response.data.status === 'ok') {
            return response.data.data[0].id;
        } else {
            //console.error('Failed to get account ID:', response.data);
            return null;
        }
    } catch (error) {
        //console.error('Error in getAccountID:', error.message);
        return null;
    }
}

/**
 * Places an order on HTX (market or limit order).
 *
 * @param {string} fromToken - The base currency (e.g., 'BTC').
 * @param {string} toToken - The quote currency (e.g., 'USDT').
 * @param {string} oType - Order type ('BUY' or 'SELL').
 * @param {number} amount - The amount of the base currency to trade.
 * @param {number|null} price - The price for limit orders (required for limit orders).
 * @returns {object} - Response object with status code and message.
 */

async function swapTokens(fromToken, toToken, oType, amount, price = null) {
    try {
        let type = '';
        if (oType === 'BUY') {
            type = 'buy-market';
        } else if (oType === 'SELL') {
            type = 'sell-market';
        }

        const validTypes = ['buy-market', 'sell-market', 'buy-limit', 'sell-limit'];
        if (!validTypes.includes(type.toLowerCase())) {
            throw new Error(`Invalid order type. Type must be one of: ${validTypes.join(', ')}`);
        }

        const endpoint = '/v1/order/orders/place';
        const timestamp = new Date().toISOString().replace(/\.\d+Z$/, '');

        const params = {
            AccessKeyId: ACCESS_KEY,
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            Timestamp: timestamp,
        };

        params.Signature = generateSignature('POST', endpoint, params);

        const orderData = {
            'account-id': await getAccountID(),
            symbol: `${fromToken}${toToken}`.toLowerCase(),
            type: type.toLowerCase(),
            amount: amount.toString(),
        };

        if (type.includes('limit') && price) {
            orderData.price = price.toString();
            orderData.timeInForce = 'GTC';
        } else if (type.includes('limit') && !price) {
            throw new Error('Price is required for limit orders.');
        }

        const response = await axios.post(`${ORDER_URL}?${new URLSearchParams(params)}`, orderData, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.data.status === 'error') {
            return { code: -1, msg: response.data['err-msg'] };
        } else {
            return { code: 1, msg: response.data['data'] };
        }
    } catch (error) {
        //console.error('Error in swapTokens:', error.message);
        return { code: -1, msg: error.message };
    }
}

/**
 * Fetches the balance of a specific asset in the HTX account.
 *
 * @param {string} asset - The asset to fetch the balance for (e.g., 'BTC').
 * @returns {object} - Object containing free and locked balances.
 */
async function getBalanceByAsset(asset) {
    try {
        const endpoint = '/v1/account/accounts';
        const timestamp = new Date().toISOString().replace(/\.\d+Z$/, '');

        const params = {
            AccessKeyId: ACCESS_KEY,
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            Timestamp: timestamp,
        };

        params.Signature = generateSignature('GET', endpoint, params);

        const response = await axios.get(`${BALANCE_URL}?${new URLSearchParams(params)}`);

        if (response.data.status === 'ok') {
            const accounts = response.data.data;
            for (const account of accounts) {
                if (account.list) {
                    const assetBalance = account.list.find(balance => balance.currency === asset.toUpperCase());
                    if (assetBalance) {
                        return { free: parseFloat(assetBalance.balance), locked: parseFloat(assetBalance.frozen) };
                    }
                }
            }
            return { free: 0.0, locked: 0.0 };
        } else {
            //console.error('Failed to fetch account balance:', response.data);
            return { free: 0.0, locked: 0.0 };
        }
    } catch (error) {
        //console.error('Error in getBalanceByAsset:', error.message);
        return { free: 0.0, locked: 0.0 };
    }
}

/**
 * Withdraws a specified amount of a token from HTX to a given address.
 *
 * @param {string} currency - The currency to withdraw (e.g., 'BTC').
 * @param {string} address - The destination wallet address.
 * @param {number} amount - The amount to withdraw.
 * @param {string} chain - The blockchain network (e.g., 'ERC20').
 * @returns {object} - Response object with status code and message.
 */
async function withdrawToken(currency, address, amount, chain = 'ERC20') {
    try {
        const endpoint = '/v1/dw/withdraw/api/create';
        const timestamp = new Date().toISOString().replace(/\.\d+Z$/, '');

        const params = {
            AccessKeyId: ACCESS_KEY,
            SignatureMethod: 'HmacSHA256',
            SignatureVersion: '2',
            Timestamp: timestamp,
            currency: currency.toLowerCase(),
            address: address,
            amount: amount,
            chain: chain,
        };

        params.Signature = generateSignature('POST', endpoint, params);

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
        };
        const response = await axios.post(`${BASE_URL}${endpoint}`, params, { headers });

        if (response.data.status === 'ok') {
            return { code: 1, msg: response.data.data };
        } else {
            return { code: -1, msg: response.data['err-msg'] };
        }
    } catch (error) {
        //console.error('Error in withdrawToken:', error.message);
        return { code: -1, msg: error.message };
    }
}

/**
 * Fetches the exchange rate for a specific trading pair.
 *
 * @param {string} fromToken - The base currency (e.g., 'BTC').
 * @param {string} toToken - The quote currency (e.g., 'USDT').
 * @returns {object} - Object containing the price and reverse price.
 */
async function getExchangeRate(fromToken, toToken) {
    try {
        const symbol = `${fromToken}${toToken}`.toLowerCase();
        const rsy = await getSupportingTradingSymbol(symbol);

        if (rsy.state_cross === 'online') {
            const response = await axios.get(MARKET_URL);
            const tickers = response.data.data;
            const ticker = tickers.find(t => t.symbol === symbol.toLowerCase());

            if (ticker) {
                return {
                    price: ticker.close,
                    reverse_price: 1 / ticker.close,
                };
            } else {
                //console.log(`No data found for symbol: ${symbol}`);
                return { price: 0, reverse_price: 0 };
            }
        } else {
            return { price: 0, reverse_price: 0 };
        }
    } catch (error) {
        //console.error('Error in getExchangeRate:', error.message);
        return { price: 0, reverse_price: 0 };
    }
}

/**
 * Fetches the exchange rate for all trading pairs.
 *
 * @param {string} fromToken - The base currency (e.g., 'BTC').
 * @param {string} toToken - The quote currency (e.g., 'USDT').
 * @returns {object} - Object containing the price and reverse price.
 */
async function getExchangeRate_all(fromToken, toToken) {
    try {
        const symbol = `${fromToken}${toToken}`.toLowerCase();
        const response = await axios.get(MARKET_URL);
        const tickers = response.data.data;
        const ticker = tickers.find(t => t.symbol === symbol.toLowerCase());

        if (ticker) {
            return {
                price: ticker.close,
                reverse_price: 1 / ticker.close,
            };
        } else {
            //console.log(`No data found for symbol: ${symbol}`);
            return { price: 0, reverse_price: 0 };
        }
    } catch (error) {
        //console.error('Error in getExchangeRate_all:', error.message);
        return { price: 0, reverse_price: 0 };
    }
}

/**
 * Fetches details of a specific trading symbol.
 *
 * @param {string} value - The trading symbol (e.g., 'btcusdt').
 * @returns {object} - Object containing symbol details.
 */
async function getSupportingTradingSymbol(value) {
    try {
        const response = await axios.get(`${BASE_URL}/v2/settings/common/symbols`);
        const pairs = response.data.data;
        const search_result = pairs.filter(item => item["sc"] === value)[0];
        return {
            bcdn: search_result.bcdn,
            qcdn: search_result.qcdn,
            pair: search_result.dn,
            base_curr: search_result.bc,
            state_cross: search_result.scr,
            state: search_result.state,
            state_isolated: search_result.si,
            trade_enable: search_result.te,
            suspend_desc: search_result.suspend_desc,
        };
    } catch (error) {
        //console.error('Error in getSupportingTradingSymbol:', error.message);
        return { error: true };
    }
}
async function getWalletAddress(currency, chain) {
    try {
        const endpoint = `/v2/account/deposit/address`; // API endpoint for fetching deposit address
        const timestamp = new Date().toISOString().replace(/\.\d+Z$/, ''); // ISO 8601 timestamp

        // Request parameters
        const params = {
            AccessKeyId: ACCESS_KEY, // API access key
            SignatureMethod: 'HmacSHA256', // Signature method
            SignatureVersion: '2', // Signature version
            Timestamp: timestamp, // Timestamp
            currency: currency.toLowerCase(), // Currency (e.g., 'usdt')
        };

        // Generate the signature
        params.Signature = generateSignature('GET', endpoint, params);

        // Make the API request
        const headers = {
            'Content-Type': 'application/json', // Set content type
            'User-Agent': 'Mozilla/5.0', // Set user agent
        };

        // Construct the full URL with query parameters
        const url = `${BASE_URL}${endpoint}?${new URLSearchParams(params)}`;
        const response = await axios.get(url, { headers });
		  
        if (response.data.code === 200) {
            const addresses = response.data.data;

            // Filter the address by the specified chain (LIKE '%chain%')
            const addressInfo = addresses.find(addr =>
                addr.chain.toLowerCase().includes(chain.toLowerCase())
            );
            if (addressInfo) {
                return { address: addressInfo.address};
            } else {
                return { address: 0};
            }
        } else {
           return { address: 0};
        }
    } catch (error) {
        return { address: 0};
    }
}

//main();

 async function main() {
	let address = await getWalletAddress("USDT", "btc");
	console.log(address);
}

module.exports = {
    getExchangeRate,
    getExchangeRate_all,
    getAccountID,
    swapTokens,
    withdrawToken,
    getBalanceByAsset,
};