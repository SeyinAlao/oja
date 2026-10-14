// Latency + quality benchmark. For each configuration it starts the production server on its
// own port with that configuration's env, runs every style N times, and prints a summary.
// The API key is read from .env.local by Next itself and is never printed or passed on argv.
// Usage: node scripts/bench.mjs <configs.json> <results.json> [runs]
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [configsPath, outPath, runsArg] = process.argv.slice(2);
const configs = JSON.parse(readFileSync(configsPath, "utf8"));
const runs = Number(runsArg) || 3;
const styles = ["english", "pidgin", "yoruba"];
const PORT = 3011;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealthy() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("server did not start");
}

const PIDGIN = /\b(dey|na|wey|abeg|oya|una|no be|sharp sharp|well well|no dull|don land|fit)\b/i;
const YORUBA = /(káàbọ̀|káàbọ|jọ̀ọ́|jọ́|ṣeun|ẹ̀wà|ó dára|ẹ ṣé|ẹ jọ|ẹ káàbọ̀|o ṣeun|ẹ)/i;
const SLANG = /\b(no cap|slay|bestie|vibes?|lit|fire)\b/i;
const DISCLAIMER = /\b(rough|estimate|estimated|guide|guarantee)\b/i;

function checks(style, l) {
  const fields = { caption: l.caption, description: l.description, status: l.whatsapp_status };
  const all = Object.values(fields).join(" ");
  const voiceRe = style === "pidgin" ? PIDGIN : style === "yoruba" ? YORUBA : null;
  return {
    voiceFields: voiceRe ? Object.values(fields).filter((t) => voiceRe.test(t)).length : null,
    handle: /handle|strap/i.test(all),
    slang: SLANG.test(all),
    noteDisclaimer: DISCLAIMER.test(l.price_range_ngn?.note ?? ""),
    hashtagsOk: l.hashtags.length >= 5 && l.hashtags.length <= 8,
  };
}

const results = [];
for (const cfg of configs) {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
    { env: { ...process.env, ...cfg.env }, stdio: "ignore" },
  );
  try {
    await waitHealthy();
    const img = "data:image/jpeg;base64," + readFileSync(cfg.image).toString("base64");
    for (const style of styles) {
      for (let run = 1; run <= runs; run++) {
        const t = Date.now();
        let row = { config: cfg.name, style, run };
        try {
          const res = await fetch(`http://localhost:${PORT}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: [img], hints: { name: "Ankara tote bag" }, style }),
          });
          const data = await res.json();
          row = { ...row, status: res.status, wallMs: Date.now() - t };
          if (res.ok) row = { ...row, ms: data.ms, attempts: data.attempts, ...checks(style, data.listing), listing: data.listing };
          else row.error = data.error;
        } catch (e) {
          row = { ...row, status: 0, wallMs: Date.now() - t, error: String(e).slice(0, 80) };
        }
        results.push(row);
        console.log(
          `${cfg.name} ${style} #${run}: ${row.status} ${row.wallMs}ms attempts=${row.attempts ?? "-"}` +
            (row.error ? ` error=${row.error}` : ""),
        );
        writeFileSync(outPath, JSON.stringify(results, null, 1));
        await sleep(1500);
      }
    }
  } finally {
    child.kill();
    await sleep(1000);
  }
}

console.log("\nconfig | style | n | ok | repairs | median s | min | max");
for (const cfg of configs) {
  for (const style of styles) {
    const rows = results.filter((r) => r.config === cfg.name && r.style === style);
    const ok = rows.filter((r) => r.status === 200);
    const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
    const med = ms.length ? ms[Math.floor(ms.length / 2)] / 1000 : NaN;
    console.log(
      `${cfg.name} | ${style} | ${rows.length} | ${ok.length} | ${ok.filter((r) => r.attempts === 2).length} | ` +
        `${med.toFixed(1)} | ${(ms[0] / 1000).toFixed(1)} | ${(ms.at(-1) / 1000).toFixed(1)}`,
    );
  }
}
