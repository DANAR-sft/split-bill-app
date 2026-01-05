import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

async function downloadFile(url: string, dest: string) {
  // Use global fetch available in Node 18+; fallback to (globalThis as any).fetch
  const fetchFn: any =
    (globalThis as any).fetch ?? (await import("node-fetch")).default;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const fileStream = fs.createWriteStream(dest);
  await pipeline(res.body, fileStream);
}

async function main() {
  const args = process.argv.slice(2);
  const langs = args.length ? args : ["eng"];
  const base = "https://github.com/tesseract-ocr/tessdata/raw/main";
  const outDir = path.join(__dirname, "..", "public", "tessdata");

  for (const lang of langs) {
    const url = `${base}/${lang}.traineddata`;
    const dest = path.join(outDir, `${lang}.traineddata`);
    try {
      console.log(`Downloading ${lang} -> ${dest}`);
      await downloadFile(url, dest);
      console.log(`Saved ${dest}`);
    } catch (e: any) {
      console.error(`Error fetching ${lang}:`, e?.message ?? e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
