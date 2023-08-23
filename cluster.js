const { Cluster } = require('puppeteer-cluster');
const express = require('express');

let servedRequests = 0;
let errorCount = 0;

const app = express();
const port = 3000;

app.use(express.json());
// Function to log server stats
const logServerStats = () => {
    console.log(`Served Requests: ${servedRequests}`);
    console.log(`Error Count: ${errorCount}`);
};

// Log server stats every minute (60,000 milliseconds)
setInterval(logServerStats, 60000);

// Define your launch options here
const launchOptions = {
    headless: "new",
    args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-zygote',
        '--deterministic-fetch',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        // '--single-process',

    ],
};
if (process.env.CHROME_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;
};

let max_concurrency = 2;
if (process.env.MAX_CONCURRENCY) {
    max_concurrency = parseInt(process.env.MAX_CONCURRENCY, 10);
  };

(async () => {
    // Create a cluster with N workers
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: max_concurrency,
        puppeteerOptions: launchOptions,
    });

    // Define a task
    cluster.task(async ({ page, data: {url, headers} }) => {
        const startTime = Date.now();
        if (headers) {
            for (const [name, value] of Object.entries(headers)) {
                await page.setExtraHTTPHeaders({ [name]: value });
            }
        }
        const response = await page.goto(url, {timeout: 60000});
        const status_code = response.status()
        // const pageBody = await page.evaluate(() => document.body.innerHTML);
        const finalUrl = page.url();
        const pageBody = await page.content()
        const endTime = Date.now();
        const loadTime = endTime - startTime;
        let url_string = "'" + url + "'"
        if(finalUrl != url)
            url_string = "'" + url + "' -> '" + finalUrl + "'"
        tpl = `[DEBUG] Fetched ${url_string} status: ${status_code} (${loadTime/1000}s)`
        console.log(tpl)
        servedRequests++;
        return {page: pageBody, status: status_code, headers: response.headers()};
    });

    // Define a route for receiving URLs via POST requests
    app.post('/render', async (req, res) => {
        const { url, headers } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required.' });
        }

        try {
            const result = await cluster.execute({url, headers});
            res.status(200).json(result);
        } catch (err) {
            errorCount++;
            console.debug("[DEBUG] Could not get '" + url + "' Error: " + err)
            res.status(500).json({ error: 'An error occurred while processing the URL.' + err });
        }
    });

    // Start the Express server
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });

    // Shutdown the cluster and close Express server on process termination
    process.on('SIGINT', async () => {
        await cluster.idle();
        await cluster.close();
        process.exit();
    });
})();
