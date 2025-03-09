const coinsName = require("./libs/coins.js");
const EXC = require("./exchange/htx.js");

async function main() {
	let token = 'BTCUSDT';
	let exRate = await EXC.getExchangeRate('DGB','USDT');
	console.log("RATE : " + JSON.stringify(exRate));
	
	let swap = await EXC.swapTokens('DGB','USDT', 'SELL', '1');
	console.log("SWAP : " + JSON.stringify(swap));
	
	let withdraw = await EXC.withdrawToken('USDT', '10', 'TXKrW8JQCfAAyDUq8YmzcaivRatLUYkmk4', 'TRC20');
	console.log("WTDRW : " + JSON.stringify(withdraw));
	
	let balance = await EXC.getBalanceByAsset('USDT');
	console.log("BALANCE : " + JSON.stringify(balance));
	
}

main();