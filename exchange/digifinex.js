const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const API_KEY = process.env.DIGIFINEX_API_KEY;
const API_SECRET = process.env.DIGIFINEX_API_SECRET;
const BASE_URL = 'https://openapi.digifinex.com';

function generateSignature(method, requestPath, timestamp, body = '') {
    method = method.toUpperCase();
    const prehashString = `${timestamp}${method}${requestPath}${body}`;
    const signature = crypto
        .createHmac('sha256', API_SECRET)
        .update(prehashString)
        .digest('hex')
        .toLowerCase();
    return signature;
}

async function getExchangeRate(fromAsset, toAsset) {
    const endpoint = '/swap/v2/public/ticker';
    const params = {
        instrument_id: `${fromAsset}${toAsset}PERP`,
    };

    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { params });
        return { price: parseFloat(response.data.data.last), reserve_price: parseFloat(1 / response.data.data.last) };
    } catch (error) {
        console.error('Error fetching exchange rate:', error.response ? error.response.data : error.message);
        
    }
}

async function swapTokens(fromAsset, toAsset, amount) {
    const endpoint = '/swap/v3/trade/open_orders';
    const timestamp = Date.now();
    const body = JSON.stringify({
        from_asset: fromAsset,
        to_asset: toAsset,
        amount: amount,
    });

    const signature = generateSignature('POST', endpoint, timestamp, body);

    const headers = {
        'ACCESS-KEY': API_KEY,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
        return response.data;
    } catch (error) {
        console.error('Error swapping tokens:', error.response ? error.response.data : error.message);
        
    }
}

async function withdrawToken(asset, amount, address) {
    const endpoint = '/withdraw';
    const timestamp = Date.now();
    const body = JSON.stringify({
        asset: asset,
        amount: amount,
        address: address,
    });

    const signature = generateSignature('POST', endpoint, timestamp, body);
    const headers = {
        'ACCESS-KEY': API_KEY,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
        return response.data;
    } catch (error) {
        console.error('Error withdrawing token:', error.response ? error.response.data : error.message);
        
    }
}

async function getBalanceByAsset(asset) {
    const endpoint = '/swap/v2/account/balance?currency=' +asset;
    const timestamp = Date.now();
    const body = JSON.stringify({
        asset: asset,
    });

    const signature = generateSignature('GET', endpoint, timestamp, body);

    const headers = {
        'ACCESS-KEY': API_KEY,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
        return response.data.balance[asset];
    } catch (error) {
        console.error('Error fetching balance:', error.response ? error.response.data : error.message);
        
    }
}

async function InstrumentLIst() {
    const endpoint = '/swap/v2/public/instrument?instrument_id=BTCUSDT2PERP';
    const timestamp = Date.now();
    const signature = generateSignature('GET', endpoint, timestamp);

    const headers = {
        'ACCESS-KEY': API_KEY,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'Content-Type': 'application/json',
    };

    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { headers });
        return response.data;
    } catch (error) {
        console.error('Error fetching instrument:', error.response ? error.response.data : error.message);
        
    }
}

async function getSystemTime() {
    try {
        const endpoint = '/swap/v2/public/time';
        const response = await axios.get(`${BASE_URL}${endpoint}`);
        return response.data.data;
    } catch (error) {
        console.error('Error fetching system time:', error.response ? error.response.data : error.message);
        throw new Error('Failed to fetch system time');
    }
}

(async () => {
    try {
        // const serverTime = await getSystemTime();
        // console.log('Server Time:', serverTime);

        // const Instruments = await InstrumentLIst();
        // console.log('Instruments:', Instruments);

        // const exchangeRate = await getExchangeRate('BTC', 'USDT');
        // console.log('Exchange Rate:', exchangeRate);

        const swapResult = await swapTokens('BTC', 'USDT', 0.01);
        console.log('Swap Result:', swapResult);

        // const withdrawResult = await withdrawToken('USDT', 100, 'your_wallet_address');
        // console.log('Withdraw Result:', withdrawResult);

        // const balance = await getBalanceByAsset('BTC');
        // console.log('Balance:', balance);
    } catch (error) {
        console.error('Error:', error);
    }
})();