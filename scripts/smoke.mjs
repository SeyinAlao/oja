import { readFileSync } from "node:fs";
const img = "data:image/jpeg;base64," + readFileSync("test-assets/sample.jpg").toString("base64");
const style = process.argv[2] || "english";
const t = Date.now();
const res = await fetch("http://localhost:3010/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ images: [img], hints: { name: "Ankara tote bag", condition: "Brand new" }, style }),
});
console.log(style, res.status, "wall ms:", Date.now() - t);
console.log(JSON.stringify(await res.json(), null, 2));
