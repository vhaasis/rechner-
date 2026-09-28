// Holt für jede Aktie aus stocks.js die aktuellen Google-News-Schlagzeilen (deutsch + englisch)
// und schreibt sie als <TICKER>.json in das Ausgabeverzeichnis. Läuft in GitHub Actions.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import path from "node:path";

const OUT_DIR = process.argv[2] || "out";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const PER_EDITION = 30;
const DELAY_MS = 1200;

const EDITIONS = [
  { lang: "DE", hl: "de", gl: "DE", ceid: "DE:de", suffix: "Aktie" },
  { lang: "EN", hl: "en-US", gl: "US", ceid: "US:en", suffix: "stock" }
];

const BUSINESS_TOPIC = "https://news.google.com/rss/headlines/section/topic/BUSINESS";
const TODAY_PER_EDITION = 40;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadStocks() {
  const src = await readFile(new URL("../stocks.js", import.meta.url), "utf8");
  const sandbox = { window: {} };
  runInNewContext(src, sandbox);
  return sandbox.window.STOCKS.map(([ticker, name, query]) => ({
    ticker,
    name,
    query: query || (/[\s\-'&.]/.test(name) ? `"${name}"` : name)
  }));
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text) {
  return text
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();
}

export function parseRss(xml, lang) {
  const items = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const tag = (name) => {
      const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
      return m ? decode(m[1]) : "";
    };
    const src = /<source\s+url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/.exec(block);
    const source = src ? decode(src[2]) : "";
    const sourceUrl = src ? decode(src[1]) : "";
    let title = tag("title");
    while (source && title.toLowerCase().endsWith(" - " + source.toLowerCase())) {
      title = title.slice(0, -(source.length + 3)).trim();
    }
    const link = tag("link");
    const date = new Date(tag("pubDate"));
    if (!title || !/^https?:\/\//.test(link) || isNaN(date.getTime())) continue;
    items.push({ title, url: link, source, sourceUrl, date: date.toISOString(), lang });
  }
  return items;
}

async function fetchRss(url, lang) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; aktien-news-bot/1.0; +https://github.com/vhaasis/rechner-)" }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (!xml.includes("<rss")) throw new Error("keine RSS-Antwort");
  return parseRss(xml, lang);
}

async function fetchEdition(stock, ed) {
  const q = `${stock.query} ${ed.suffix} when:30d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${ed.hl}&gl=${ed.gl}&ceid=${ed.ceid}`;
  return (await fetchRss(url, ed.lang)).slice(0, PER_EDITION);
}

// Wirtschafts-Schlagzeilen des Tages (Google-News-Rubrik „Wirtschaft“ bzw. „Business“).
async function fetchToday(updated) {
  const lists = [];
  for (const ed of EDITIONS) {
    try {
      const url = `${BUSINESS_TOPIC}?hl=${ed.hl}&gl=${ed.gl}&ceid=${ed.ceid}`;
      lists.push((await fetchRss(url, ed.lang)).slice(0, TODAY_PER_EDITION));
    } catch (e) {
      console.warn(`Tagesnachrichten ${ed.lang}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  const items = merge(lists);
  if (items.length === 0) return false;
  await writeFile(path.join(OUT_DIR, "heute.json"), JSON.stringify({ updated, items }));
  console.log(`Tagesnachrichten: ${items.length} Meldungen`);
  return true;
}

function merge(lists) {
  const seen = new Set();
  const out = [];
  const longest = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (!item) continue;
      const key = item.title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "").slice(0, 90);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

async function main() {
  const stocks = (await loadStocks()).filter((s) => !ONLY || ONLY.includes(s.ticker));
  await mkdir(OUT_DIR, { recursive: true });
  const updated = new Date().toISOString();
  let ok = 0;
  const failed = [];

  const todayOk = await fetchToday(updated);
  if (!todayOk) failed.push("heute");

  for (const stock of stocks) {
    const lists = [];
    for (const ed of EDITIONS) {
      try {
        lists.push(await fetchEdition(stock, ed));
      } catch (e) {
        console.warn(`${stock.ticker} ${ed.lang}: ${e.message}`);
      }
      await sleep(DELAY_MS);
    }
    const items = merge(lists);
    if (items.length === 0) {
      failed.push(stock.ticker);
      continue;
    }
    const file = path.join(OUT_DIR, `${stock.ticker}.json`);
    await writeFile(file, JSON.stringify({ ticker: stock.ticker, name: stock.name, updated, items }));
    ok++;
    console.log(`${stock.ticker}: ${items.length} Meldungen`);
  }

  await writeFile(path.join(OUT_DIR, "status.json"), JSON.stringify({ updated, ok, failed }, null, 2));
  console.log(`Fertig: ${ok} von ${stocks.length} Aktien aktualisiert${failed.length ? `, ohne Treffer: ${failed.join(", ")}` : ""}`);
  if (ok === 0 && !todayOk) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
