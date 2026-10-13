// Renders public/og.png (1200x630) in the Oja palette using headless Edge/Chrome.
// Usage: node scripts/make-og.mjs   (needs internet once, for the Fraunces web font)
import { chromium } from "playwright-core";

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=DM+Sans:wght@500;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:#fbf6ea;font-family:'DM Sans',sans-serif;color:#0f3d2e;position:relative;overflow:hidden}
  .band{position:absolute;left:0;top:0;bottom:0;width:430px;background:#0f3d2e}
  .awning{position:absolute;left:0;top:0;width:430px;height:96px;background:repeating-linear-gradient(90deg,#e8a317 0 54px,#fbf6ea 54px 108px)}
  .scallop{position:absolute;left:0;top:96px;width:430px;height:28px;background:radial-gradient(circle at 27px 0,#e8a317 27px,transparent 28px) 0 0/108px 28px repeat-x}
  .mark{position:absolute;left:0;top:190px;width:430px;text-align:center;font-family:'Fraunces',serif;font-weight:600;font-size:210px;color:#fbf6ea;letter-spacing:-6px}
  .tag{position:absolute;left:0;top:450px;width:430px;text-align:center;font-weight:700;font-size:26px;letter-spacing:6px;color:#e8a317}
  .copy{position:absolute;left:500px;top:120px;width:640px}
  h1{font-family:'Fraunces',serif;font-weight:600;font-size:80px;line-height:1.05}
  h1 span{color:#b97a00}
  p{margin-top:30px;font-size:34px;line-height:1.35;color:#5b5a4b;font-weight:500}
  .pill{position:absolute;left:500px;bottom:64px;background:#0f3d2e;color:#fbf6ea;border-radius:999px;padding:14px 28px;font-weight:700;font-size:26px}
  .dot{display:inline-block;width:16px;height:16px;border-radius:50%;background:#e8a317;margin-right:12px}
</style></head><body>
<div class="band"></div><div class="awning"></div><div class="scallop"></div>
<div class="mark">Oja</div><div class="tag">LISTINGS THAT SELL</div>
<div class="copy"><h1>Snap it. We write it. <span>You sell it.</span></h1>
<p>Instagram and WhatsApp listings in Clear English, Naija Pidgin or Yoruba-flavoured English.</p></div>
<div class="pill"><span class="dot"></span>Open-weight AI</div>
</body></html>`;

const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "public/og.png" });
await browser.close();
console.log("wrote public/og.png");
