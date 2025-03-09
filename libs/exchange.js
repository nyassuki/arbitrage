const puppeteer = require('puppeteer');

async function getExchange(numrow) {
    console.log("Fetching data from https://freecryptoarbitrage.com/crossexchange please wait ...\n");

    // Launch Puppeteer
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Navigate to the target website
    await page.goto('https://freecryptoarbitrage.com/crossexchange', {
        waitUntil: 'networkidle2',
    });

    // Extract table data
    const tableData = await page.evaluate((numrow) => {
        const rows = document.querySelectorAll('table tbody tr'); // Select all table rows
        const data = [];

        rows.forEach((row, index) => {
            if (index < numrow) { // Only process the first `numrow` rows
                const columns = row.querySelectorAll('td'); // Select all columns in the row
                const rowData = {
                    coin: columns[0]?.innerText.trim().replace(/\s+/g, '') || '',
                    buy_exchange: columns[1]?.innerText.trim() || '',
                    sell_exchange: columns[3]?.innerText.trim() || '',
                    buy_price: parseFloat(columns[2]?.innerText.replace(/[^0-9.]/g, '')) || 0,
                    sell_price: parseFloat(columns[4]?.innerText.replace(/[^0-9.]/g, '')) || 0,
                    profit: parseFloat(columns[5]?.innerText.replace(/[^0-9.]/g, '')) || 0,
                };
                data.push(rowData);
            }
        });

        return data; // Ensure the data is returned
    }, numrow);

    // Close the browser
    await browser.close();

    return JSON.parse(JSON.stringify(tableData, null, 2));
}

module.exports = { getExchange };
