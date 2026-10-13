// Captures docs/mobile.png (empty state) and docs/result.png (one real generation).
// Usage: node scripts/screenshots.mjs http://localhost:3010
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:3010";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(base);
await page.getByRole("button", { name: /write my listing/i }).waitFor();
await page.getByText(/locally on your machine|hosted open-weight endpoint/).waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/mobile.png", fullPage: true });
console.log("wrote docs/mobile.png");

await page.setInputFiles("input[type=file]", "test-assets/sample.jpg");
await page.getByRole("img", { name: "Product photo 1" }).waitFor();
await page.getByLabel(/What is it/).fill("Ankara tote bag");
await page.getByLabel(/Condition/).fill("Brand new");
await page.getByLabel(/Price in mind/).fill("₦15,000");
await page.getByText("Naija Pidgin", { exact: true }).click();
const t = Date.now();
await page.getByRole("button", { name: /write my listing/i }).click();
await page.getByRole("button", { name: "Regenerate" }).waitFor({ timeout: 600000 });
console.log("UI generation seconds:", ((Date.now() - t) / 1000).toFixed(1));
await page.waitForTimeout(1000);
await page.screenshot({ path: "docs/result.png", fullPage: true });
console.log("wrote docs/result.png");
await browser.close();
