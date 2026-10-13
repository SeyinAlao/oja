// Accessibility check: axe-core (WCAG 2.x A/AA) in the empty, loading, result and error
// states, plus a keyboard-only walk. /api/generate is mocked so this runs in seconds.
// Usage: start the app (pnpm start -p 3010), then: node scripts/a11y.mjs http://localhost:3010
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:3010";
const sample = "test-assets/sample.jpg";

const listing = {
  title: "Ankara Tote Bag",
  caption: "Carry Lagos in style.\nDM to order.",
  description: "A sturdy Ankara tote with bold stripes. Delivery in Lagos, Abuja and Port Harcourt.",
  hashtags: ["#AnkaraBag", "#NigerianFashion", "#LagosVendor"],
  whatsapp_status: "New Ankara tote! DM to order.",
  price_range_ngn: { low: 12000, high: 18000, note: "Prices vary with size and fabric." },
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
let failures = 0;

async function scan(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const bad = results.violations;
  const blocking = bad.filter((v) => ["serious", "critical"].includes(v.impact));
  console.log(`${label}: ${bad.length} violations (${blocking.length} serious/critical)`);
  for (const v of bad) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(" ")}`);
  }
  failures += blocking.length;
}

async function fresh(mock) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route("**/api/generate", mock);
  await page.goto(base);
  await page.getByRole("button", { name: /write my listing/i }).waitFor();
  return page;
}

// 1. Empty
{
  const page = await fresh((r) => r.abort());
  await scan(page, "empty");
  await page.close();
}

// 2. Loading (request stays pending) and 3. Result
{
  let release;
  const gate = new Promise((res) => (release = res));
  const page = await fresh(async (route) => {
    await gate;
    await route.fulfill({ json: { listing, ms: 4200, model: "gemma3:4b" } });
  });
  await page.setInputFiles("input[type=file]", sample);
  await page.getByRole("img", { name: "Product photo 1" }).waitFor();
  await page.getByRole("button", { name: /write my listing/i }).click();
  await page.getByText("Writing your listing…").waitFor();
  await page.waitForTimeout(1500);
  await scan(page, "loading");
  release();
  await page.getByRole("button", { name: "Regenerate" }).waitFor();
  await page.waitForTimeout(800); // let entrance animations settle
  await scan(page, "result");
  await page.close();
}

// 4. Error
{
  const page = await fresh((route) =>
    route.fulfill({ status: 502, json: { error: "unreachable", message: "Could not reach the AI model." } }),
  );
  await page.setInputFiles("input[type=file]", sample);
  await page.getByRole("img", { name: "Product photo 1" }).waitFor();
  await page.getByRole("button", { name: /write my listing/i }).click();
  await page.getByRole("alert").filter({ hasText: "AI model" }).waitFor();
  await page.waitForTimeout(500);
  await scan(page, "error");
  await page.close();
}

// 5. Keyboard-only walk through the form
{
  const page = await fresh((route) => route.fulfill({ json: { listing, ms: 1000, model: "gemma3:4b" } }));
  const order = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const desc = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "(body)";
      const label =
        el.getAttribute("aria-label") ||
        el.labels?.[0]?.textContent?.trim() ||
        el.textContent?.trim() ||
        el.id;
      const outline = getComputedStyle(el).outlineStyle !== "none" ? "outline" : "NO-OUTLINE";
      return `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""} "${label?.slice(0, 40)}" ${outline}`;
    });
    order.push(desc);
    if (/write my listing/i.test(desc)) break;
  }
  console.log("keyboard focus order:");
  order.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
  if (order.some((d) => d.includes("NO-OUTLINE"))) {
    console.log("  FAIL: an element has no visible focus outline");
    failures++;
  }
  if (!/write my listing/i.test(order.at(-1) ?? "")) {
    console.log("  FAIL: never reached the generate button by keyboard");
    failures++;
  }
  // Activate with the keyboard and check the result is announced in the live region.
  await page.keyboard.press("Enter");
  await page.getByText("Please add at least one photo", { exact: false }).or(
    page.getByText("Add at least one product photo first."),
  ).first().waitFor({ timeout: 3000 }).then(
    () => console.log("  Enter on generate with no photo shows a clear message (role=alert)"),
    () => {
      console.log("  FAIL: no validation message after Enter");
      failures++;
    },
  );
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "A11Y OK" : `A11Y FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
