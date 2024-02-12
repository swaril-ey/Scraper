import puppeteer from "puppeteer";
import * as csv from "fast-csv";
import * as path from "path";
import { fileURLToPath } from "url";

var locale = process.argv.slice(2);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function format(date) {
  if (!(date instanceof Date)) {
    throw new Error('Invalid "date" argument. You must pass a date instance');
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

(async () => {
  console.time("start");
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const today = format(new Date());

  // Set Viewport
  await page.setViewport({ width: 1280, height: 1024 });

  // Helper Function
  const isElementVisible = async (page, cssSelector) => {
    let visible = true;
    await page
      .waitForSelector(cssSelector, { visible: true, timeout: 2000 })
      .catch(() => {
        visible = false;
      });
    return visible;
  };

  await page.goto(
    `https://www.herbalife.com/${locale}/u/category/all-products`
  );

  const consentPopupSelector = "#onetrust-accept-btn-handler";

  let isConsentVisible = await isElementVisible(page, consentPopupSelector);

  if (isConsentVisible) {
    await page.click(consentPopupSelector);
  }

  const selectorForLoadMoreButton = "button[data-testid='loadMoreBtn']";
  let loadMoreVisible = await isElementVisible(page, selectorForLoadMoreButton);

  while (loadMoreVisible) {
    await page.click(selectorForLoadMoreButton).catch(() => {});
    loadMoreVisible = await isElementVisible(page, selectorForLoadMoreButton);
  }

  let urls = await page.$$eval(
    "div[class*='ProductTile'] > a[href]",
    (options) => {
      return options.map((option) => option.getAttribute("href"));
    }
  );

  let responseToFile = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const split = url.split("/");
    var name = `${split[3]}_${split[6]}`;
    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });

    await page.goto(url);

    let response;
    const featuredCarouselSelector = ".cmp-content-carousel__item--active";
    const featuredCarouselScope = ".cmp-content-carousel";
    const featuredContentVisible = await page
      .waitForSelector(featuredCarouselSelector, {
        timeout: 3000,
        visible: true,
      })
      .then(() => {
        return true;
      })
      .catch((err) => {
        return false;
      });

    if (featuredContentVisible) {
      const scope = await page.$eval(featuredCarouselScope, (scope) =>
        scope.getAttribute("data-scope")
      );

      if (scope) {
        response = [url, featuredContentVisible, scope];
      } else {
        response = [url, featuredContentVisible, false];
      }
    } else {
      response = [url, featuredContentVisible, false];
    }

    console.log(`${i}/${urls.length}`, response);
    responseToFile.push(response);

    await page.screenshot({
        path: `./${name}.jpg`,
        fullPage: true
    });
  }

  csv
    .writeToPath(
      path.resolve(__dirname, `${today}-${locale}.csv`),
      responseToFile,
      {
        headers: ["url", "featuredContentVisible", "scope"],
      }
    )
    .on("error", (err) => console.log(err))
    .on("finish", () => console.log("done writing"));

  await browser.close();
  console.timeEnd("start");
})();