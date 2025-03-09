const fetch = require("node-fetch");
async function getConversionRate(fromToken, toToken) {
    const url = "https://www.coinex.com/res/market";
    
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            },
        });

        const pair = `${fromToken}${toToken}`.toUpperCase(); // Ensure the pair is in uppercase
        const data = await response.json();

        // Check if the pair exists in the market data
        if (data.data.market_info && data.data.market_info[pair]) {
            const conversionRate = data.data.market_info[pair];
            console.log(`Conversion rate for ${pair}:`, conversionRate.price_rate);
            return conversionRate;
        } else {
            console.error(`Pair ${pair} not found in market data.`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching conversion rate:", error);
        return null;
    }
}
// Run the function
getConversionRate("GLMR","USDT");
