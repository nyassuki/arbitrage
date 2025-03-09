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

//use only for RDNT-USDT / DGB-USDT ON HTX


async function getPrice(tokenA, tokenB) {
	 const [binance_rate, btse_rate, htx_rate, okx_rate, coinex_rate, bitfinex_rate] = await Promise.all([
            binance.getExchangeRate(tokenA, tokenB).catch(() => null),
            btse.getExchangeRate(tokenA, tokenB).catch(() => null),
            htx.getExchangeRate_all(tokenA, tokenB).catch(() => null),
            okx.getExchangeRate(tokenA, tokenB).catch(() => null),
            coinex.getExchangeRate(tokenA, tokenB).catch(() => null),
            bitfinex.getExchangeRate(tokenA, tokenB).catch(() => null),
        ]);

        // Create an array of rates, filtering out failed API calls
        const rates = [
            { exchange: 'binance', rate: binance_rate?.price },
            { exchange: 'btse', rate: btse_rate?.price },
            { exchange: 'htx', rate: htx_rate?.price },
            { exchange: 'okx', rate: okx_rate?.price },
            { exchange: 'bitfinex', rate: bitfinex_rate?.price },
            { exchange: 'coinex', rate: coinex_rate?.price },
        ].filter(rate => rate.rate !== undefined && rate.rate !== 0); // Filter out invalid rates
	rates.sort((a, b) => b.rate - a.rate);
    return rates;
}	



main("DGB","USDT",1000);

async function main(tokenA,tokenB,tradingAmount) {
 let rates = await getPrice(tokenA, tokenB);
 console.table(rates);
 const [buyExchange, sellExchange] = [rates[0], rates[rates.length - 1]]; // Highest and lowest price exchanges
 console.log(`\n✅ Trading opportunity: BUY on ${buyExchange.exchange.toUpperCase()} -> SELL on ${sellExchange.exchange.toUpperCase()} -> AMOUNT: ${tradingAmount} ${tokenA}`);
 
 //convert USDT to DGB
 
 //convert tokenA to tokenB (use reverse price) on buy exchange
 let tokenB_out = tradingAmount*(1/rates[0].rate);
 console.log(`✅ Buy ${tokenB} using ${tradingAmount} ${tokenA} get ${tokenB_out} ${tokenB} -> (${buyExchange.exchange.toUpperCase()})`);
 
 
 //convert tokenA_out to tokenB out in sell exchange
 let tokenA_out = tokenB_out*(1/rates[rates.length - 1].rate);
 console.log(`✅ Buy ${tokenA} using ${tokenB_out} ${tokenB} get ${tokenA_out} ${tokenA}-> (${sellExchange.exchange.toUpperCase()})`);

 //get margin on tokenA
 let profit = tokenB_out-tradingAmount;
 console.log(`✅ Token IN ${tradingAmount} ${tokenA} token out ${tokenA_out}, profit ${profit} ${tokenA}`);

}