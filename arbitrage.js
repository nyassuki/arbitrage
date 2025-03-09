const exchange = require("./libs/exchange.js");
const coinsName = require("./libs/coins.js");
const scanner = require("./scanner.js");
const readline = require('readline-sync');
const MaxFdata = 30;
const MarginProcentageMIN = 0.2;

async function main() {
	 let data = await fetchAndSelectData();
	 //console.log(data);
	 await scanner.startArbitrageTrading(data.fromToken, data.toToken, 1000);
}
async function fetchAndSelectData(autoMode = false) {
	try {
		
		let FetchDataCount;
		if (autoMode) {
			FetchDataCount = 1;
		} else {
			do {
				FetchDataCount = readline.question(`\nEnter the amount of data (MAX ${MaxFdata}): `).trim();
			} while (isNaN(FetchDataCount) || FetchDataCount < 1 || FetchDataCount > MaxFdata);
		}
		
		let data = await exchange.getExchange(parseInt(FetchDataCount));
		if (autoMode) {
			return { data, dataIndex: 0 }; // Use the first entry in auto mode
		} 
		// Add an index starting from 1
		let indexedData = data.map((item, index) => ({ data_no: index + 1, ...item }));
		console.table(indexedData, ['data_no', ...Object.keys(data[0])]);
		let dataIndex;
		let isValidInput = false;

		do {
			dataIndex = parseInt(readline.question(`Enter data_no to use (1 to ${FetchDataCount}): `).trim());
			
			if (isNaN(dataIndex) || dataIndex < 1 || dataIndex > FetchDataCount) {
				console.log(`Invalid input. Please enter a number between 1 and ${FetchDataCount}. your input is ${dataIndex}`);
			} else {
				isValidInput = true;
			}
		} while (!isValidInput);

		let data_return = data[dataIndex-1];
		let pair = data_return['coin'].replace("+", "");
		let coins = coinsName.getCoinName(pair);
		let fromToken = coins[0];
		let toToken = coins[1];
		let buy_exchange = data_return['buy_exchange'].replace("Huobi", "htx").toLowerCase();
		let sell_exchange = data_return['sell_exchange'].replace("Huobi", "htx").toLowerCase();
		let buy_price = data_return['buy_price'];
		let sell_price = data_return['sell_price'];
		let profit = data_return['profit'];
		return { fromToken:fromToken,toToken:toToken,buy_exchange:buy_exchange,sell_exchange:sell_exchange,buy_price:buy_price,sell_price:sell_price,profit:profit}; // Convert to zero-based index
	} catch(error) {
		return ("❌ Error feth data\n");
	}
}
main();