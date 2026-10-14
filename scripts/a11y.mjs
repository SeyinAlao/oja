// Accessibility check. Runs against a running app with /api/generate mocked, so it takes
// seconds and needs no model. Covers:
//   - axe-core (WCAG 2.0-2.2 A/AA + best-practice) in empty, loading, result, no-product, error
//   - keyboard-only walk, radio arrow keys, focus after generation
//   - the polite live region ("Writing your listing", "Listing ready", "Copied title")
//   - touch-target size (44px) and horizontal overflow at 390px
//   - prefers-reduced-motion
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
  price_range_ngn: { low: 12000, high: 18000, note: "Depends on fabric and size." },
};
const noProduct = {
  ...listing,
  title: "No sellable product visible: the photo shows only a wall",
  hashtags: [],
  price_range_ngn: { low: 0, high: 0, note: "No product." },
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
let failures = 0;
const fail = (msg) => {
  console.log(`  FAIL: ${msg}`);
  failures++;
};
const ok = (msg) => console.log(`  ok: ${msg}`);

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
  failures += bad.length; // best-practice findings count too: none are accepted
}

async function open(mock, contextOptions = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...contextOptions });
  const page = await ctx.newPage();
  await page.route("**/api/generate", mock);
  await page.goto(base);
  await page.getByRole("button", { name: /write my listing/i }).waitFor();
  return page;
}

const liveText = (page) => page.locator('[role="status"][aria-live="polite"]').first().innerText();
const addPhoto = async (page) => {
  await page.setInputFiles("input[type=file]", sample);
  await page.getByRole("img", { name: /Preview of product photo 1/ }).waitFor();
};

// 1. Empty
{
  const page = await open((r) => r.abort());
  await scan(page, "empty");

  // Target size and overflow at 390px.
  const small = await page.evaluate(() => {
    const out = [];
    const sel = 'button, a[href], input:not([type=file]):not(.sr-only), label:has(input[type=radio])';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  });
  small.length ? small.forEach((s) => fail(`target under 44px: ${s}`)) : ok("all empty-state targets are at least 44x44");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  overflow ? fail("horizontal overflow at 390px") : ok("no horizontal overflow at 390px");

  // Every interactive element shows a pointer; disabled/aria-disabled show not-allowed.
  const cursors = await page.evaluate(() => {
    const bad = [];
    const sel = 'button, a[href], label:has(input[type=radio])';
    for (const el of document.querySelectorAll(sel)) {
      const c = getComputedStyle(el).cursor;
      if (c !== "pointer") bad.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 24)}" has cursor ${c}`);
    }
    return bad;
  });
  cursors.length ? cursors.forEach((c) => fail(c)) : ok("every button, link and style option has cursor: pointer");

  // Placeholders are visually distinct from typed values.
  const style = await page.evaluate(() => {
    const el = document.getElementById("hint-price");
    const ph = getComputedStyle(el, "::placeholder");
    el.focus();
    return { phStyle: ph.fontStyle, phText: el.placeholder, value: el.value };
  });
  style.phStyle === "italic" && style.value === "" && style.phText.startsWith("e.g.")
    ? ok("price placeholder is italic, starts with 'e.g.' and the field value is empty")
    : fail(`placeholder not distinct: ${JSON.stringify(style)}`);
  await page.context().close();
}

// 2. Loading + live region + result + focus + copy announcement
{
  let release;
  const gate = new Promise((res) => (release = res));
  let sentBody = null;
  const page = await open(async (route) => {
    sentBody = JSON.parse(route.request().postData());
    await gate;
    await route.fulfill({ json: { listing, ms: 4200, model: "gemma3:4b" } });
  });
  await addPhoto(page);
  const removeName = await page.getByRole("button", { name: /Remove photo/ }).getAttribute("aria-label");
  /Remove photo 1 of 1/.test(removeName) ? ok(`remove button is named "${removeName}"`) : fail(`remove label: ${removeName}`);

  await page.getByRole("button", { name: /write my listing/i }).click();
  await page.getByRole("heading", { name: "Writing your listing" }).waitFor();
  await page.waitForTimeout(1200);
  const busyCursor = await page.getByRole("button", { name: /writing your listing/i }).evaluate((el) => getComputedStyle(el).cursor);
  busyCursor === "not-allowed" ? ok("generate button shows not-allowed while busy") : fail(`busy cursor is ${busyCursor}`);
  (await page.locator('[aria-busy="true"]').count()) > 0 ? ok("loading region has aria-busy") : fail("no aria-busy while loading");
  /Writing your listing/.test(await liveText(page)) ? ok("live region announces 'Writing your listing'") : fail(`live: ${await liveText(page)}`);
  await scan(page, "loading");

  release();
  await page.getByRole("button", { name: "Regenerate" }).waitFor();
  await page.waitForTimeout(800);
  /Listing ready/.test(await liveText(page)) ? ok("live region announces 'Listing ready'") : fail(`live: ${await liveText(page)}`);
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  focused === "Your listing" ? ok("focus moved to the results heading") : fail(`focus is on: ${focused}`);
  await scan(page, "result");

  // Tab continues from the heading (not trapped) and reaches the first copy button next.
  await page.keyboard.press("Tab");
  const next = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  next === "Copy title" ? ok("Tab from the results heading reaches 'Copy title'") : fail(`next focus: ${next}`);

  await page.getByRole("button", { name: "Copy title" }).click();
  await page.waitForTimeout(200);
  /Copied title/.test(await liveText(page)) ? ok("live region announces 'Copied title'") : fail(`live: ${await liveText(page)}`);

  // Hints: nothing typed means no hint keys on the wire (placeholder text never sent).
  JSON.stringify(sentBody.hints) === "{}" ? ok("request carried no hints when fields were empty") : fail(`hints sent: ${JSON.stringify(sentBody.hints)}`);
  await page.context().close();
}

// 3. No-product result
{
  const page = await open((route) => route.fulfill({ json: { listing: noProduct, ms: 900, model: "m" } }));
  await addPhoto(page);
  await page.getByRole("button", { name: /write my listing/i }).click();
  await page.getByRole("heading", { name: /couldn’t see a product/ }).waitFor();
  await page.waitForTimeout(500);
  await scan(page, "no-product");
  await page.context().close();
}

// 4. Error
{
  const page = await open((route) =>
    route.fulfill({ status: 502, json: { error: "unreachable", message: "Could not reach the AI model." } }),
  );
  await addPhoto(page);
  await page.getByRole("button", { name: /write my listing/i }).click();
  await page.getByRole("alert").filter({ hasText: "AI model" }).waitFor();
  await page.waitForTimeout(500);
  await scan(page, "error");
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  /can’t reach the AI model/.test(focused ?? "") ? ok("focus moved to the error heading") : fail(`focus is on: ${focused}`);
  await page.context().close();
}

// 5. Keyboard-only walk and radio arrow keys
{
  const page = await open((route) => route.fulfill({ json: { listing, ms: 1000, model: "m" } }));
  const order = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const desc = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "(body)";
      const label =
        el.getAttribute("aria-label") || el.labels?.[0]?.textContent?.trim() || el.textContent?.trim() || el.id;
      const visible = getComputedStyle(el).outlineStyle !== "none" ? "outline" : "NO-OUTLINE";
      return `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""} "${label?.slice(0, 40)}" ${visible}`;
    });
    order.push(desc);
    if (/write my listing/i.test(desc)) break;
  }
  console.log("keyboard focus order:");
  order.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
  order.some((d) => d.includes("NO-OUTLINE")) && fail("an element has no visible focus outline");
  /write my listing/i.test(order.at(-1) ?? "") || fail("never reached the generate button by keyboard");
  order.filter((d) => d.includes("[radio]")).length === 1
    ? ok("the style group is a single tab stop")
    : fail("style radios are not a single tab stop");

  // Arrow keys move the radio selection.
  await page.getByRole("radio", { name: "Clear English" }).focus();
  await page.keyboard.press("ArrowRight");
  (await page.getByRole("radio", { name: "Naija Pidgin" }).isChecked())
    ? ok("ArrowRight moves from Clear English to Naija Pidgin")
    : fail("ArrowRight did not change the style");
  await page.keyboard.press("ArrowRight");
  (await page.getByRole("radio", { name: "Yoruba-flavoured" }).isChecked())
    ? ok("ArrowRight again selects Yoruba-flavoured")
    : fail("second ArrowRight did not change the style");
  (await page.getByRole("radiogroup").count()) === 1 ? ok("one radiogroup is exposed") : fail("radiogroup missing");

  // Enter on generate with no photo shows a clear message.
  await page.getByRole("button", { name: /write my listing/i }).focus();
  await page.keyboard.press("Enter");
  (await page.getByText("Add at least one product photo first.").count()) > 0
    ? ok("Enter on generate with no photo shows a clear message")
    : fail("no validation message after Enter");
  await page.context().close();
}

// 6. Reduced motion
{
  const page = await open((r) => r.abort(), { reducedMotion: "reduce" });
  const dur = await page.evaluate(() => {
    const el = document.querySelector(".skeleton") ?? document.querySelector("button");
    return parseFloat(getComputedStyle(el).transitionDuration) || 0;
  });
  const anim = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "skeleton";
    document.body.appendChild(probe);
    return parseFloat(getComputedStyle(probe).animationDuration);
  });
  dur <= 0.001 && anim <= 0.001
    ? ok(`reduced motion: transitions ${dur}s, animations ${anim}s`)
    : fail(`reduced motion not honoured: transition ${dur}s animation ${anim}s`);
  await page.context().close();
}

await browser.close();
console.log(failures === 0 ? "\nA11Y OK" : `\nA11Y FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
