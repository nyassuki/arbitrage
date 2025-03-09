const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const BASE_URL = 'https://www.okx.com';
const API_KEY = process.env.OKX_API_KEY;
const SECRET_KEY = process.env.OKX_API_SECRET;
const ENVIRONMENT = process.env.ENVIRONMENT
const PASSPHRASE = 'Sahabat1234!';

 
if (!API_KEY || !SECRET_KEY) {
    throw new Error('API_KEY and SECRET_KEY must be set in the environment variables');
}

/**
 * Generate the OK-ACCESS-SIGN header using HMAC-SHA256.
 * @param {string} timestamp - The current timestamp in milliseconds.
 * @param {string} method - The HTTP method (e.g., GET, POST).
 * @param {string} requestPath - The API endpoint path (e.g., /api/v5/account/balance).
 * @param {string} body - The request body (for POST requests) or query string (for GET requests).
 * @param {string} secretKey - The API secret key
 * @returns {string} - The Base64-encoded signature.
 */
function generateSignature(timestamp, method, requestPath, body, secretKey) {
    const message = timestamp + method + requestPath + (body || '');
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);
    return hmac.digest('base64');
}

/**
 * Fetch the server time from OKX and return it in milliseconds.
 * @returns {Promise<number>} - The server time in milliseconds.
 */
async function getServerTime() {
    try {
        const response = await axios.get(`${BASE_URL}/api/v5/public/time`);
        //return parseInt(response.data.data[0].ts, 10); // Server time in milliseconds
		return new Date().toISOString();
    } catch (error) {
        console.error('Error fetching server time:', error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Compare the server time with the local time to check for synchronization issues.
 */
async function compareT() {
	const clientTimeReqStart = Date.now();
    const serverT = await getServerTime();
    const serverTime = await getServerTime();
	const clientTimeReqEnd = Date.now();
	const serverTimeMs = serverTime;
	const roundTripTime = clientTimeReqEnd - clientTimeReqStart;
	const estimatedOneWayLatency = Math.floor(roundTripTime / 2);
	// Adjust server time by adding estimated one-way latency
	const adjustedServerTime = serverTimeMs + estimatedOneWayLatency;
	// Calculate time difference between adjusted server time and local time
	const timeDifference = adjustedServerTime - clientTimeReqEnd; 
	const result = {
		localTime: clientTimeReqEnd,
		serverTime: serverTimeMs,
		roundTripTime,
		estimatedOneWayLatency,
		adjustedServerTime,
		timeDifference,
	};
	console.log('Time synchronization results:');
    console.log(result);
    console.log(`Your approximate latency to exchange server: One way: ${estimatedOneWayLatency}ms. Round trip: ${roundTripTime}ms.`)
    if (serverT === null) return;
    const localT = Date.now();
    console.log("Server Time:", serverT);
    console.log("Local Time:", localT);
    console.log("Time Difference (ms):", serverT - localT);
	return result;
}

/**
 * Place an order on OKX.
 * @param {string} instId - The instrument ID (e.g., BTC-USDT).
 * @param {string} side - The order side (e.g., buy, sell).
 * @param {string} size - The order size.
 * @returns {Promise<Object>} - The order response.
 */
async function placeOrder(instId, side, size) {
    const endpoint = '/api/v5/trade/order';
    const url = BASE_URL + endpoint;
    const method = 'POST';

    const body = JSON.stringify({
        instId,
        tdMode: 'cash',  // 'cash' for spot trading
        side,
        ordType: 'market',
        sz: size
    });

    const timestamp = await getServerTime();
    if (timestamp === null) return null; // Handle null timestamp

    const signature = generateSignature(timestamp.toString(), method, endpoint, body, SECRET_KEY);

    try {
        const response = await axios.post(url, body, {
            headers: {
                'OK-ACCESS-KEY': API_KEY,
                'OK-ACCESS-SIGN': signature,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': PASSPHRASE,
                'Content-Type': 'application/json'
            }
        });
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.error('Error placing order:', error.response ? error.response.data : error.message);
        return null; // Handle error and return null
    }
}

/**
 * Withdraw a token from OKX.
 * @param {string} ccy - The currency (e.g., BTC).
 * @param {string} amt - The amount to withdraw.
 * @param {string} dest - The destination address type (e.g., 2 for on-chain, 3 for internal transfer).
 * @param {string} toAddr - The destination address.
 * @param {string} fee - The withdrawal fee.
 * @param {string} chain - The blockchain network (e.g., BTC-Bitcoin).
 * @returns {Promise<Object>} - The withdrawal response.
 */
async function withdrawToken(ccy, amt, dest, toAddr, fee = '0.0005', chain = 'BTC-Bitcoin') {
    const endpoint = '/api/v5/asset/withdrawal';
    const url = BASE_URL + endpoint;
    const method = 'POST';

    const body = JSON.stringify({
        ccy,
        amt,
        dest,
        toAddr,
        fee,
        chain
    });

    const timestamp = await getServerTime();
    if (timestamp === null) return null;

    const signature = generateSignature(timestamp.toString(), method, endpoint, body, SECRET_KEY);

    try {
        const response = await axios.post(url, body, {
            headers: {
                'OK-ACCESS-KEY': API_KEY,
                'OK-ACCESS-SIGN': signature,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': PASSPHRASE,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error withdrawing token:', error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Fetch the balance of a specific asset.
 * @param {string} ccy - The currency (e.g., BTC).
 * @returns {Promise<Object>} - The balance response.
 */
async function getBalanceByAsset(ccy) {
    const endpoint = '/api/v5/account/balance';
    const url = BASE_URL + endpoint;
    const method = 'GET';
    const queryString = `?ccy=${ccy}`;

    const timestamp = await getServerTime();
    if (timestamp === null) return null;

    const signature = generateSignature(timestamp.toString(), method, endpoint + queryString, '', SECRET_KEY);

    try {
        const response = await axios.get(url, {
            params: { ccy },
            headers: {
                'OK-ACCESS-KEY': API_KEY,
                'OK-ACCESS-SIGN': signature,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': PASSPHRASE
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching balance:', error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Fetch the exchange rate for a trading pair.
 * @param {string} instId - The instrument ID (e.g., BTC-USDT).
 * @returns {Promise<string>} - The last traded price.
 */
async function getExchangeRate(instId) {
    try {
        const response = await axios.get(`${BASE_URL}/api/v5/market/ticker`, {
            params: { instId }
        });

        if (response.data && response.data.data) {
            return response.data.data[0].last;
        }
        return null;
    } catch (error) {
        console.error('Error fetching exchange rate:', error.response ? error.response.data : error.message);
        return null;
    }
}

/**
 * Fetch withdrawal fees for a specific currency.
 * @param {string} currency - The currency (e.g., BTC, ETH).
 */
async function getWithdrawFee(currency) {
    try {
        const endpoint = "/api/v5/asset/currencies";
        const method = "GET";
        const timestamp = new Date().toISOString();
		const signature = generateSignature(timestamp.toString(), method, endpoint + `ccy=${currency}`, '', SECRET_KEY);

        const response = await axios.get(BASE_URL + endpoint, {
            headers: {
                "OK-ACCESS-KEY": API_KEY,
                "OK-ACCESS-SIGN": signature,
                "OK-ACCESS-TIMESTAMP": timestamp,
                "OK-ACCESS-PASSPHRASE": PASSPHRASE,
            },
            params: {
                ccy: currency,
            },
        });

        if (response.data && response.data.data.length > 0) {
            console.log(`📋 Withdrawal fees for ${currency}:`);
            response.data.data.forEach((entry) => {
                console.log(
                    `  🔹 Chain: ${entry.chain}, Fee: ${entry.minFee} ${currency}`
                );
            });
        } else {
            console.log(`⚠️ No withdrawal fee data found for ${currency}`);
        }
    } catch (error) {
        console.error(`📋 Error fetching withdrawal fee: ${error.message}`);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
    }
}

// Example usage
(async () => {
    try {
        await compareT(); // Check time synchronization
		
		const fee = await getWithdrawFee('BTC');
        console.log(`withdrawal fee : ${fee}`);
		
        const rate = await getExchangeRate('BTC-USDT');
        console.log(`BTC-USDT Exchange Rate: ${rate}`);

        const order = await placeOrder('BTC-USDT', 'buy', '0.01');
        console.log('Order Response:', order);

        const withdrawal = await withdrawToken('BTC', '0.001', '4', 'your_btc_address_here');
        console.log('Withdrawal Response:', withdrawal);

        const balance = await getBalanceByAsset('BTC');
        console.log('BTC Balance:', balance);
    } catch (error) {
        console.error('Error in example usage:', error);
    }
})();