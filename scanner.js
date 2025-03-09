require('dotenv').config(); // Load .env file
const fs = require('fs');

const binance = require("./exchange/binance.js");
const btse = require("./exchange/btse.js");
const htx = require("./exchange/htx.js");
const okx = require("./exchange/okx.js");
const bitfinex = require("./exchange/bitfinex.js");
const coinex = require("./exchange/coinex.js");

const coinsName = require("./libs/coins.js");
const wallet_config = require("./libs/wallet_config.js");
const GasFee = require("./libs/gasfee.js");

const wallet_address = wallet_config.wallet_production;
const filePath = 'profitable_arbitrage.txt';
const USDT_IDR = 16433;
const PRICE_TOLERANCE = 98;
const tokens = ["NEAR","DOT", "XMR","TRX","ADA", "LTC","AAVE","ACH", "WOO"]
/**
 * Fetch exchange rates from all supported exchanges.
 * @param {string} fromToken - The token to trade from (e.g., ZEC).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @returns {Promise<Array>} - Sorted array of exchange rates.
 */
async function getPrice(fromToken, toToken) {
    try {
        // Fetch rates from all exchanges in parallel
        const [btse_rate, htx_rate, okx_rate, coinex_rate, bitfinex_rate] = await Promise.all([
             btse.getExchangeRate(fromToken, toToken).catch(() => null),
            htx.getExchangeRate(fromToken, toToken).catch(() => null),
            okx.getExchangeRate(fromToken, toToken).catch(() => null),
            coinex.getExchangeRate(fromToken, toToken).catch(() => null),
            bitfinex.getExchangeRate(fromToken, toToken).catch(() => null),
        ]);

        // Create an array of rates, filtering out failed API calls
        const rates = [
             { exchange: 'btse', rate: btse_rate?.price },
            { exchange: 'htx', rate: htx_rate?.price },
            { exchange: 'okx', rate: okx_rate?.price },
            { exchange: 'bitfinex', rate: bitfinex_rate?.price },
            { exchange: 'coinex', rate: coinex_rate?.price },
        ].filter(rate => rate.rate !== undefined && rate.rate !== 0); // Filter out invalid rates

        // Sort by rate in descending order
        rates.sort((a, b) => b.rate - a.rate);
        return rates;
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        throw error;
    }
}

/**
 * Find the wallet address and network for a specific exchange and token.
 * @param {string} exchange - The exchange name.
 * @param {string} token - The token symbol.
 * @returns {Object|null} - The address and network, or null if not found.
 */
function findAddressAndNetwork(exchange, token) {
    const result = wallet_config.wallet_production.find(
        wallet => wallet.exchange === exchange && wallet.token === token
    );
    return result ? { address: result.address, network: result.network } : null;
}

/**
 * Execute a buy order on the specified exchange.
 * @param {string} exchange - The exchange name.
 * @param {string} fromToken - The token to buy.
 * @param {string} toToken - The token to sell.
 * @param {number} amount - The amount to buy.
 * @returns {Promise<Object>} - The response from the buy order.
 */
async function executeBuyOrder(exchange, fromToken, toToken, amount) {
    const buyFunction = require(`./exchange/${exchange}.js`);
    return await buyFunction.swapTokens(fromToken, toToken, "BUY",amount);
}

/**
 * Execute a sell order on the specified exchange.
 * @param {string} exchange - The exchange name.
 * @param {string} fromToken - The token to sell.
 * @param {string} toToken - The token to buy.
 * @param {number} amount - The amount to sell.
 * @returns {Promise<Object>} - The response from the sell order.
 */
async function executeSellOrder(exchange, fromToken, toToken, amount) {
    const sellFunction = require(`./exchange/${exchange}.js`);
    return await sellFunction.swapTokens(fromToken, toToken, 'SELL', amount);
}

/**
 * Withdraw tokens from one exchange to another.
 * @param {string} exchange - The exchange to withdraw from.
 * @param {string} token - The token to withdraw.
 * @param {number} amount - The amount to withdraw.
 * @param {string} address - The destination address.
 * @param {string} network - The network for the withdrawal.
 * @returns {Promise<Object>} - The response from the withdrawal.
 */
async function withdrawTokens(exchange, token, amount, address, network) {
    const withdrawFunction = require(`./exchange/${exchange}.js`);
    return await withdrawFunction.withdrawToken(token, amount, address, network);
}

/**
 * Start arbitrage trading.
 * @param {string} fromToken - The token to trade from (e.g., ZEC).
 * @param {string} toToken - The token to trade to (e.g., USDT).
 * @param {number} tradingAmount - The amount to trade.
 * @returns {Promise<Object>} - The result of the arbitrage trading.
 */
async function startArbitrageTrading(fromToken, toToken, tradingAmount) {
    console.clear();
    console.log("\n🚀 Start searching . . . ");

    // Fetch gas fees and calculate margin threshold
    const { gasP } = await GasFee.getGasCost();
	const gasPricesUSDT = "0";
    console.log("⛽ Possible gas fee (ERC20 network): " + gasPricesUSDT + " USDT");

    const marginPercentageMIN = process.env.PROFIT_THRESHOLD / 100;
    const marginThreshold = parseFloat(gasPricesUSDT) + marginPercentageMIN * tradingAmount;
    console.log(`🔍 Searching for trading opportunity for ${fromToken}-${toToken} (profit threshold: ${marginThreshold} ${toToken}, initial amount: ${tradingAmount} or ${tradingAmount*USDT_IDR} IDR)`);

   
    try {
        const rates = await getPrice(fromToken, toToken);
        if (rates.length < 2) return logAndReturn("🛑 Not enough exchange rates to perform arbitrage.");

        console.log("\n📊 Price table:");
        console.table(rates);

        const [buyExchange, sellExchange] = [rates[rates.length - 1], rates[0]]; // Highest and lowest price exchanges
        const buyPrice = buyExchange.rate*(PRICE_TOLERANCE/100);
        const sellPrice = sellExchange.rate*(PRICE_TOLERANCE/100);

        console.log(`\n✅ Trading opportunity: BUY on ${buyExchange.exchange.toUpperCase()} -> SELL on ${sellExchange.exchange.toUpperCase()} -> AMOUNT: ${tradingAmount} ${toToken}`);

        const [getBuyExchange, getSellExchange] = await Promise.all([
            require(`./exchange/${buyExchange.exchange}.js`).getExchangeRate(fromToken, toToken),
            require(`./exchange/${sellExchange.exchange}.js`).getExchangeRate(fromToken, toToken),
        ]);

        const fromTokenOut = tradingAmount / getBuyExchange.price*(parseInt(PRICE_TOLERANCE)/100);
        const toTokenOut = fromTokenOut * getSellExchange.price*(parseInt(PRICE_TOLERANCE)/100);
        const tradingMargin = toTokenOut - tradingAmount;

        console.log(`   - Buy ${fromToken} with ${tradingAmount} ${toToken} and get ${fromTokenOut} ${fromToken}`);
        console.log(`   - Sell ${fromTokenOut} ${fromToken} and get ${toTokenOut} ${toToken} -> (${tradingMargin} ${toToken} or ${tradingMargin*USDT_IDR} IDR)`);

        if (tradingMargin > marginThreshold) {
            console.log(`✅ Potential profit: ${tradingMargin} ${toToken}, margin threshold: ${marginThreshold} ${toToken}\n🚀 Executing trading...`);
			const trading_return = { profitable: true, buy_e: buyExchange.exchange, sell_e: sellExchange.exchange, profit: tradingMargin, fromToken: fromToken, toToken:toToken};
			fs.appendFileSync(filePath, JSON.stringify(trading_return) + "\n", 'utf8');
            // Execute buy order
            const buyResponse = await executeBuyOrder(buyExchange.exchange, fromToken, toToken, tradingAmount);
            if (buyResponse.code < 1) return logAndReturn(`❌ Buy error (${buyExchange.exchange}): ${buyResponse.msg}`);

            console.log(" 🔥 Buy success! Moving asset to: " + sellExchange.exchange);
            const rAddress = findAddressAndNetwork(sellExchange.exchange, fromToken);
            if (!rAddress) return logAndReturn(`❌ No wallet address found for ${sellExchange.exchange} and ${fromToken}`);

            // Withdraw tokens
            const withdrawResponse = await withdrawTokens(buyExchange.exchange, fromToken, fromTokenOut, rAddress.address, rAddress.network);
            if (withdrawResponse.code < 1) return logAndReturn(`❌ Withdraw error: ${withdrawResponse.msg}`);

            console.log(" 🎉 Withdraw success!");

            // Execute sell order
            const sellResponse = await executeSellOrder(sellExchange.exchange, fromToken, toToken, fromTokenOut);
            if (sellResponse.code < 1) return logAndReturn(`❌ Sell error: ${sellResponse.msg}`);

            console.log(" 🔥 Sell success!");

            // Withdraw back to original exchange
            const kAddress = findAddressAndNetwork(buyExchange.exchange, toToken);
            if (!kAddress) return logAndReturn(`❌ No wallet address found for ${buyExchange.exchange} and ${toToken}`);

            const withdrawBackResponse = await withdrawTokens(sellExchange.exchange, toToken, toTokenOut, kAddress.address, kAddress.network);
            if (withdrawBackResponse.code < 1) return logAndReturn(`❌ Withdraw back error: ${withdrawBackResponse.msg}`);

            console.log("🎉 Withdraw back success!");
            console.log("✅ Arbitrage completed!");

            return { profitable: true, buy_e: buyExchange.exchange, sell_e: sellExchange.exchange, profit: tradingMargin, fromToken: fromToken, toToken:toToken};
        } else {
            console.log("🛑 No profitable arbitrage found!");
            return { profitable: false, buy_e: buyExchange.exchange, sell_e: sellExchange.exchange, profit: tradingMargin, fromToken: fromToken };
        }
    } catch (error) {
        console.error(`❌ Error during trading execution: ${error.message || error}\n`);
        throw error;
    }
}
/**
 * Log a message and return an object.
 * @param {string} message - The message to log.
 * @returns {Object} - The result object.
 */
function logAndReturn(message) {
    console.log(message);
    return { profitable: false, message };
}

/**
 * Main function to process all coins.
 * @returns {Promise<Array>} - Array of profitable trades.
 */
async function main() {
    const coins = coinsName.commonQuotes; // Ensure coinsName is defined
    let allProfitable = [];
    const totalCoins = coins.length;
    console.log(`Total coins: ${totalCoins}`);
	
    for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        const remainingCoins = totalCoins - i - 1; // Calculate remaining coins

        try {
            console.log(`🔍 Starting arbitrage trading for ${coin}-USDT... (${remainingCoins} coins remaining)`);
            const profit_response = await startArbitrageTrading(coin, "USDT", 10);

            if (profit_response.profitable === true) {
                // Add all profitable trading
                allProfitable.push(profit_response);
				fs.appendFileSync(filePath, profit_response, 'utf8');  
                console.log(`✅ Profitable arbitrage found for ${coin}-USDT:`, profit_response);
            } else {
                console.log(`🛑 No profitable arbitrage for ${coin}-USDT.`);
            }
        } catch (error) {
            console.error(`❌ Error during arbitrage trading for ${coin}-USDT:`, error.message || error);
        }
    }

    console.log(`Total coins processed: ${totalCoins}`);
    return allProfitable;
}
 
async function search() {
   	const start = process.hrtime();
	const args = process.argv.slice(2);  // Get command-line arguments
	const args2 = process.argv.slice(3);  // Get command-line arguments
	const fromToken = args.length > 0 ? args[0] : "GLMR";
	const toToken = args2.length > 0 ? args[1] : "USDT";
 	const tradingAmount = "100"; // Default trading amount

	await startArbitrageTrading(fromToken.toUpperCase(), toToken.toUpperCase(), tradingAmount);

	const end = process.hrtime(start);
	let seconds = end[0] + end[1] / 1e9;
	console.log(`\n⏰ Script execution time ${seconds} s \n`); 
};

async function autosearch() {
    for (const token of tokens) {
        await startArbitrageTrading(token.toUpperCase(), "USDT", "100");
    }
}


if (require.main === module) {
    //autosearch();
	search();
}

module.exports = { startArbitrageTrading};