const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

app.use(express.json());

app.post('/render', async (req, res) => {
  const { url, headers: customHeaders, options } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }
  try {

    const launchOptions = {
        headless: "new",
        args: ['--no-sandbox']
    };

    if (process.env.CHROME_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;
    };

    const browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage();

    // Set custom headers if provided
    if (customHeaders) {
      for (const [name, value] of Object.entries(customHeaders)) {
        await page.setExtraHTTPHeaders({ [name]: value });
      }
    }

    // Create a variable to hold the response headers
    let responseHeaders = {};

    // Intercept network responses to capture the headers
    await page.on('response', (response) => {
      const responseUrl = new URL(response.url());
      const originalUrl = new URL(url);
      if (responseUrl.href === originalUrl.href) {
        responseHeaders = response.headers();
      }
    });
    const timeoutValue = options && options.timeout !== undefined ? options.timeout : 5000;
    const response = await page.goto(url, {timeout: timeoutValue});

    // await new Promise(resolve => setTimeout(resolve, timeoutValue));
    const resp_status = response.status();
    // Set the captured response headers to the actual response
    Object.keys(responseHeaders).forEach((name) => {
        try {
            res.setHeader("X-" + name, responseHeaders[name]);
        } catch (error) {
            console.log("Could not set response header: ", name, responseHeaders[name], error);
        }
    });

    if (resp_status === 200) {
        const content = await page.content();
        // Send the content along with the response headers
        res.status(200).send(content);
        console.log("returned ok")
      } else {
        res.status(resp_status).send();
      }

    await browser.close();


  } catch (error) {
    console.log("Error: ", error)
    res.status(500).json({ error: 'An error occurred.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;