const request = require('superagent');
const crypto = require('crypto');
const querystring = require('querystring');

const baseUrl = 'https://api.coinex.com'; // Use V2 API base URL

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36';
const createCoinexClient = (apiKey, apiSecret) => {
  // Function to generate the authorization signature
  const generateSignature = (method, requestPath, body, timestamp) => {
    const preparedStr = `${method.toUpperCase()}${requestPath}${body || ''}${timestamp}`;
    return crypto
      .createHmac('sha256', apiSecret)
      .update(preparedStr)
      .digest('hex')
      .toLowerCase(); // Convert to lowercase
  };

  // GET request
  const get = async (url, fields = {}) => {
    const timestamp = Date.now().toString(); // Current timestamp in milliseconds
    const completeUrl = baseUrl + url;

    // Query parameters
    const queryParams = {
      access_id: apiKey,
      ...fields,
    };

    // Generate the query string
    const queryString = querystring.stringify(queryParams);

    // Generate the signature
    const signature = generateSignature('GET', url + '?' + queryString, '', timestamp);

    // Make the GET request
    try {
      const response = await request
        .get(completeUrl + '?' + queryString)
        .set('X-COINEX-TIMESTAMP', timestamp)
        .set('X-COINEX-SIGNATURE', signature)
        .set('User-Agent', USER_AGENT);

      const { body } = response;
      if (body.code !== 0) {
        throw new Error(`CoinEx error code: ${body.code}, message: ${body.message}`);
      }
      return body;
    } catch (error) {
      if (error.response) {
        console.error('CoinEx request failed:', error.response.body);
      }
      throw error;
    }
  };

  // POST request
  const post = async (url, body = {}) => {
    const timestamp = Date.now().toString(); // Current timestamp in milliseconds
    const completeUrl = baseUrl + url;

    // Include access_id in the body
    body.access_id = apiKey;

    // Generate the signature
    const signature = generateSignature('POST', url, JSON.stringify(body), timestamp);

    // Make the POST request
    try {
      const response = await request
        .post(completeUrl)
        .send(body)
        .set('X-COINEX-TIMESTAMP', timestamp)
        .set('X-COINEX-SIGNATURE', signature)
        .set('Content-Type', 'application/json')
        .set('User-Agent', USER_AGENT);

      const { body: responseBody } = response;
      if (responseBody.code !== 0) {
        throw new Error(`CoinEx error code: ${responseBody.code}, message: ${responseBody.message}`);
      }
      return responseBody;
    } catch (error) {
      if (error.response) {
        console.error('CoinEx request failed:', error.response.body);
      }
      throw error;
    }
  };

  // Function to get the exchange rate between two assets
  const getExchangeRate = async (fromAsset, toAsset) => {
    const url = '/v1/market/ticker';
    const market = `${fromAsset}${toAsset}`; // Market pair, e.g., BTCUSDT
    return get(url, { market });
  };

  // Function to swap tokens (place a futures order)
  const swapTokens = async (fromAsset, toAsset, amount, side) => {
    const url = '/v2/futures/order';
    const market = `${fromAsset}${toAsset}`; // Market pair, e.g., BTCUSDT
    const body = {
      market,
      market_type: 'SPOT', // 'market' or 'limit'
      side: side, // 'buy' or 'sell'
	  type:'MARKET',
      amount: amount.toString(), // Order amount
    };
    return post(url, body);
  };

  // Function to withdraw tokens
  const withdrawToken = async (asset, amount, address) => {
    const url = '/v2/balance/withdraw';
    const body = {
      coin_type: asset,
      coin_address: address,
      actual_amount: amount.toString(),
    };
    return post(url, body);
  };

  // Function to get balance by asset
  const getBalanceByAsset = async (asset) => {
    const url = '/v2/balance/info';
    const response = await get(url);
    return response.data[asset.toLowerCase()]; // Return balance for the specified asset
  };

  return { get, post, getExchangeRate, swapTokens, withdrawToken, getBalanceByAsset };
};
module.exports = createCoinexClient;