// Holt Kurs und Vortagesschlusskurs für alle Werte aus stocks.js bei Yahoo Finance
// und schreibt sie als quotes.json in das Ausgabeverzeichnis. Läuft in GitHub Actions.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import path from "node:path";

const OUT_DIR = process.argv[2] || "out";
// Yahoo drosselt Abfragen von Cloud-Servern schnell (HTTP 429): einzeln abfragen und bei 429 bremsen.
const MIN_PACE_MS = 700;
const MAX_PACE_MS = 4000;
const MAX_CONSECUTIVE_FAILURES = 8;
let pace = MIN_PACE_MS;
const KEEP_OLD_MS = 24 * 3600 * 1000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadSymbols() {
  const src = await readFile(new URL("../stocks.js", import.meta.url), "utf8");
  const sandbox = { window: {} };
  runInNewContext(src, sandbox);
  const map = sandbox.window.QUOTE_SYMBOLS || {};
  return sandbox.window.STOCKS.map(([ticker]) => ({ ticker, symbol: map[ticker] || ticker }));
}

// Liest Kurs und Vortagesschlusskurs aus einer Yahoo-Chart-Antwort (range=5d, interval=1d).
export function parseChart(json) {
  const result = json?.chart?.result?.[0];
  if (!result?.meta) return null;
  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const bars = [];
  (result.timestamp || []).forEach((t, i) => {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) bars.push({ t, c });
  });
  const price = Number.isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : bars.at(-1)?.c;
  if (!Number.isFinite(price) || price <= 0) return null;
  // Die letzte Kerze ist der aktuelle (oder letzte) Handelstag, die davor der Vortag.
  const prevClose = bars.length >= 2 ? bars.at(-2).c : meta.previousClose ?? null;
  const time = Number.isFinite(meta.regularMarketTime) ? new Date(meta.regularMarketTime * 1000).toISOString() : null;
  return {
    price,
    prevClose: Number.isFinite(prevClose) && prevClose > 0 ? prevClose : null,
    currency: meta.currency || "USD",
    time
  };
}

let requestCount = 0;

async function getJson(hosts, pathAndQuery) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    const host = hosts[requestCount++ % hosts.length];
    try {
      const res = await fetch(`https://${host}${pathAndQuery}`, { headers: HEADERS });
      if (res.ok) {
        pace = Math.max(MIN_PACE_MS, pace * 0.9);
        return await res.json();
      }
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status === 404) break;
      if (res.status === 429) pace = Math.min(MAX_PACE_MS, pace * 1.6);
    } catch (e) {
      lastError = e;
    }
    await sleep(5000 * (attempt + 1));
  }
  throw lastError;
}

async function resolveIsin(isin) {
  const data = await getJson(["query2.finance.yahoo.com", "query1.finance.yahoo.com"],
    `/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=8&newsCount=0&listsCount=0`);
  const quotes = (data.quotes || []).filter((q) => q.symbol && (q.quoteType === "ETF" || q.quoteType === "EQUITY"));
  const pick = quotes.find((q) => q.symbol.endsWith(".DE")) || quotes.find((q) => /\.(F|SG|MI|PA|AS)$/.test(q.symbol)) || quotes[0];
  return pick ? pick.symbol : null;
}

async function fetchQuote(symbol) {
  const data = await getJson(["query1.finance.yahoo.com", "query2.finance.yahoo.com"],
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`);
  return parseChart(data);
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(path.join(OUT_DIR, "quotes.json"), "utf8")).quotes || {};
  } catch (e) {
    return {};
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const entries = await loadSymbols();
  const previous = await readPrevious();
  const quotes = {};
  const failed = [];
  let consecutiveFailures = 0;

  for (const { ticker, symbol: raw } of entries) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      failed.push(ticker);
      continue;
    }
    try {
      let symbol = raw;
      if (raw.startsWith("isin:")) {
        symbol = await resolveIsin(raw.slice(5));
        if (!symbol) throw new Error(`ISIN ${raw.slice(5)} nicht gefunden`);
        console.log(`${ticker}: ${raw} -> ${symbol}`);
        await sleep(pace);
      }
      const q = await fetchQuote(symbol);
      if (!q) throw new Error("keine Kursdaten");
      quotes[ticker] = { symbol, ...q };
      consecutiveFailures = 0;
    } catch (e) {
      failed.push(ticker);
      consecutiveFailures++;
      console.warn(`${ticker} (${raw}): ${e.message}`);
      if (consecutiveFailures === MAX_CONSECUTIVE_FAILURES) console.warn("Zu viele Fehler in Folge – breche ab, behalte alte Kurse.");
    }
    await sleep(pace);
  }

  // Kurzzeitig fehlgeschlagene Abrufe behalten ihren letzten Kurs (max. 24 Stunden alt).
  let kept = 0;
  for (const ticker of failed) {
    const old = previous[ticker];
    if (old?.time && Date.now() - new Date(old.time).getTime() < KEEP_OLD_MS) {
      quotes[ticker] = old;
      kept++;
    }
  }

  const ok = Object.keys(quotes).length - kept;
  await writeFile(path.join(OUT_DIR, "quotes.json"), JSON.stringify({ updated: new Date().toISOString(), quotes }));
  console.log(`Kurse: ${ok} von ${entries.length} aktuell, ${kept} übernommen, ohne Kurs: ${failed.filter((t) => !quotes[t]).join(", ") || "–"}`);
  if (ok === 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
