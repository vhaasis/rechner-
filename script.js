(function () {
  "use strict";

  // [Ticker, Anzeigename, GDELT-Suchausdruck (optional), weitere Suchbegriffe (optional)]
  const STOCKS = [
    ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["NVDA", "Nvidia"], ["AMZN", "Amazon"],
    ["GOOGL", "Alphabet", "(Alphabet OR Google)", ["GOOG", "Google"]],
    ["META", "Meta Platforms", '("Meta Platforms" OR Facebook)', ["Meta", "Facebook"]],
    ["TSLA", "Tesla"], ["NFLX", "Netflix"],
    ["AMD", "AMD", '(AMD OR "Advanced Micro Devices")', ["Advanced Micro Devices"]],
    ["INTC", "Intel"], ["AVGO", "Broadcom"], ["PLTR", "Palantir"], ["ORCL", "Oracle"],
    ["CRM", "Salesforce"], ["ADBE", "Adobe"], ["QCOM", "Qualcomm"], ["IBM", "IBM"],
    ["ASML", "ASML"], ["BA", "Boeing"], ["DIS", "Disney"], ["KO", "Coca-Cola"],
    ["PEP", "PepsiCo"], ["MCD", "McDonald's", '("McDonald\'s" OR McDonalds)', ["McDonalds"]], ["NKE", "Nike"], ["SBUX", "Starbucks"],
    ["WMT", "Walmart"], ["JPM", "JPMorgan", '(JPMorgan OR "JP Morgan")', ["JP Morgan"]],
    ["V", "Visa"], ["MA", "Mastercard"], ["PYPL", "PayPal"], ["UBER", "Uber"],
    ["BABA", "Alibaba"],
    ["BRK.B", "Berkshire Hathaway", null, ["BRK", "Berkshire"]],
    ["LLY", "Eli Lilly"], ["NVO", "Novo Nordisk"], ["PFE", "Pfizer"],
    ["JNJ", "Johnson & Johnson"], ["XOM", "ExxonMobil", '(ExxonMobil OR "Exxon Mobil")', ["Exxon"]],
    ["CVX", "Chevron"],
    ["SAP", "SAP"], ["SIE", "Siemens"], ["ENR", "Siemens Energy"], ["ALV", "Allianz"],
    ["DTE", "Deutsche Telekom", null, ["Telekom"]], ["DBK", "Deutsche Bank"],
    ["CBK", "Commerzbank"], ["MUV2", "Munich Re", '("Munich Re" OR "Münchener Rück")', ["Münchener Rück"]],
    ["BAS", "BASF"], ["BAYN", "Bayer"], ["ADS", "Adidas"], ["BMW", "BMW"],
    ["MBG", "Mercedes-Benz", null, ["Mercedes"]], ["VOW3", "Volkswagen", null, ["VW", "VOW"]],
    ["P911", "Porsche"], ["RHM", "Rheinmetall"], ["IFX", "Infineon"], ["AIR", "Airbus"],
    ["DHL", "DHL Group", '("DHL Group" OR "Deutsche Post")', ["Deutsche Post", "DHL"]],
    ["RWE", "RWE"], ["EOAN", "E.ON", "Eon", ["Eon"]],
    ["HNR1", "Hannover Rück", '("Hannover Re" OR "Hannover Rück")', ["Hannover Re"]],
    ["ZAL", "Zalando"], ["LIN", "Linde"], ["MRK", "Merck"], ["HEN3", "Henkel"],
    ["BEI", "Beiersdorf"], ["DB1", "Deutsche Börse"], ["CON", "Continental"],
    ["SHL", "Siemens Healthineers", null, ["Healthineers"]], ["MTX", "MTU Aero Engines", null, ["MTU"]],
    ["HEI", "Heidelberg Materials"], ["SY1", "Symrise"], ["QIA", "Qiagen"], ["VNA", "Vonovia"],
    ["BNR", "Brenntag"], ["SRT3", "Sartorius"], ["FRE", "Fresenius"]
  ].map(([ticker, name, query, aliases]) => ({ ticker, name, query: query || quote(name), aliases: aliases || [] }));

  const QUICK_PICKS = ["TSLA", "NVDA", "AAPL", "SAP", "RHM", "MSFT", "VOW3"];

  const TOP_MEDIA = [
    "reuters.com", "bloomberg.com", "cnbc.com", "marketwatch.com", "wsj.com", "ft.com",
    "finance.yahoo.com", "barrons.com", "forbes.com", "businessinsider.com", "economist.com",
    "nytimes.com", "apnews.com", "bbc.com", "bbc.co.uk", "theguardian.com", "cnn.com",
    "fool.com", "investing.com", "seekingalpha.com",
    "handelsblatt.com", "faz.net", "sueddeutsche.de", "spiegel.de", "zeit.de", "welt.de",
    "tagesschau.de", "boerse-online.de", "finanzen.net", "manager-magazin.de", "wiwo.de",
    "n-tv.de", "deraktionaer.de", "onvista.de", "boerse.de", "capital.de", "nzz.ch", "derstandard.at"
  ];

  const TIMESPAN_LABELS = {
    "1d": "letzte 24 Stunden", "3d": "letzte 3 Tage", "1w": "letzte Woche",
    "1m": "letzter Monat", "3m": "letzte 3 Monate"
  };

  const LANG_CODES = {
    german: "DE", english: "EN", french: "FR", spanish: "ES", italian: "IT", dutch: "NL",
    portuguese: "PT", polish: "PL", russian: "RU", chinese: "ZH", japanese: "JA",
    korean: "KO", turkish: "TR", arabic: "AR", swedish: "SV", danish: "DA", norwegian: "NO"
  };

  const MIN_INTERVAL_MS = 5500;
  const RETRY_EXTRA_DELAY_MS = 7000;
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const MAX_RECORDS = 100;

  const $ = (id) => document.getElementById(id);
  const form = $("searchForm");
  const input = $("stockInput");
  const suggestionsEl = $("suggestions");
  const quickpicksEl = $("quickpicks");
  const introEl = $("intro");
  const resultsHead = $("resultsHead");
  const resultsTicker = $("resultsTicker");
  const resultsTitle = $("resultsTitle");
  const resultsMeta = $("resultsMeta");
  const toolbar = $("toolbar");
  const segTime = $("segTime");
  const segSort = $("segSort");
  const segSource = $("segSource");
  const notice = $("notice");
  const noticeText = $("noticeText");
  const noticeAction = $("noticeAction");
  const skeleton = $("skeleton");
  const leadEl = $("lead");
  const listEl = $("newsList");

  const state = {
    target: null,
    timespan: "1m",
    sort: "relevanz",
    source: "alle",
    articles: [],
    loaded: false,
    token: 0
  };

  const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  const shortDateFormatter = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
  const relFormatter = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

  function quote(text) {
    return /[\s\-'&.]/.test(text) ? '"' + text + '"' : text;
  }

  function safeStorage(kind) {
    try {
      const s = window[kind];
      const probe = "__probe__";
      s.setItem(probe, probe);
      s.removeItem(probe);
      return s;
    } catch (e) {
      return null;
    }
  }

  const local = safeStorage("localStorage");
  const session = safeStorage("sessionStorage");

  // ---------- Suchbegriff auflösen ----------

  function normalizeTicker(raw) {
    return raw.trim().toUpperCase().replace(/\.(DE|F|XETRA|US)$/, "");
  }

  function findStock(raw) {
    const t = normalizeTicker(raw);
    const lower = raw.trim().toLowerCase();
    return STOCKS.find((s) =>
      s.ticker === t ||
      s.name.toLowerCase() === lower ||
      s.aliases.some((a) => a.toLowerCase() === lower || a.toUpperCase() === t)
    ) || null;
  }

  function resolveTarget(raw) {
    const stock = findStock(raw);
    if (stock) {
      return { key: stock.ticker, label: stock.name, ticker: stock.ticker, query: stock.query, input: stock.name };
    }
    const cleaned = raw.replace(/["():]/g, " ").replace(/\s+/g, " ").trim().replace(/^-+/, "");
    if (cleaned.length < 2) return null;
    return { key: cleaned.toLowerCase(), label: cleaned, ticker: null, query: quote(cleaned), input: cleaned };
  }

  // ---------- GDELT-Zugriff: Warteschlange, Cache, Fehler ----------

  class ApiError extends Error {
    constructor(kind, message) {
      super(message);
      this.kind = kind;
    }
  }

  let lastFetchAtMemory = 0;

  function getLastFetchAt() {
    const stored = local ? Number(local.getItem("gdeltLastFetchAt")) || 0 : 0;
    return Math.max(stored, lastFetchAtMemory);
  }

  function setLastFetchAt(ts) {
    lastFetchAtMemory = ts;
    if (local) {
      try { local.setItem("gdeltLastFetchAt", String(ts)); } catch (e) { /* Speicher voll oder gesperrt */ }
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let queue = Promise.resolve();

  // GDELT erlaubt nur ~1 Anfrage alle 5 Sekunden; alle Abrufe laufen seriell mit Mindestabstand.
  function queuedFetch(url, isStale, onWait) {
    const run = async () => {
      if (isStale()) return null;
      const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - getLastFetchAt()));
      if (wait > 0) {
        onWait(wait);
        await sleep(wait);
      }
      if (isStale()) return null;
      setLastFetchAt(Date.now());
      return fetch(url, { referrerPolicy: "no-referrer" });
    };
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  }

  function buildUrl(query, timespan) {
    const params = new URLSearchParams({
      query: query,
      mode: "artlist",
      format: "json",
      maxrecords: String(MAX_RECORDS),
      sort: "hybridrel",
      timespan: timespan
    });
    return "https://api.gdeltproject.org/api/v2/doc/doc?" + params.toString();
  }

  function cacheKey(target, timespan) {
    return "news:" + target.key + ":" + timespan;
  }

  const memoryCache = new Map();

  function readCache(key) {
    let entry = memoryCache.get(key);
    if (!entry && session) {
      try { entry = JSON.parse(session.getItem(key) || "null"); } catch (e) { entry = null; }
    }
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.articles;
    return null;
  }

  function writeCache(key, articles) {
    const entry = { ts: Date.now(), articles };
    memoryCache.set(key, entry);
    if (session) {
      try { session.setItem(key, JSON.stringify(entry)); } catch (e) { /* Speicher voll oder gesperrt */ }
    }
  }

  async function fetchArticles(target, timespan, isStale, onWait) {
    let res;
    try {
      res = await queuedFetch(buildUrl(target.query, timespan), isStale, onWait);
    } catch (e) {
      if (navigator.onLine === false) throw new ApiError("offline", "Keine Internetverbindung.");
      // Abgewiesene Anfragen (v. a. Rate-Limit) kommen ohne CORS-Header an und schlagen hier als Netzwerkfehler auf.
      throw new ApiError("blocked", e.message);
    }
    if (res === null) return null;
    if (res.status === 429) throw new ApiError("rate", "HTTP 429");
    if (!res.ok) throw new ApiError("http", "HTTP " + res.status);

    const text = (await res.text()).trim();
    if (!text) return [];
    if (/limit requests/i.test(text)) throw new ApiError("rate", text);
    const data = parseJsonLenient(text);
    if (!data) throw new ApiError("gdelt", text.slice(0, 200));
    return Array.isArray(data.articles) ? data.articles : [];
  }

  // GDELT liefert gelegentlich ungültige Backslash-Escapes in Titeln.
  function parseJsonLenient(text) {
    if (text[0] !== "{") return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      try {
        return JSON.parse(text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\"));
      } catch (e2) {
        return null;
      }
    }
  }

  // ---------- Artikel aufbereiten ----------

  function parseSeenDate(seendate) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate || "");
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return isNaN(d.getTime()) ? null : d;
  }

  function cleanTitle(title) {
    return (title || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?%])/g, "$1")
      .trim();
  }

  function isTopMedium(domain) {
    const d = (domain || "").toLowerCase().replace(/^www\./, "");
    return TOP_MEDIA.some((t) => d === t || d.endsWith("." + t));
  }

  function prepareArticles(raw) {
    const seen = new Set();
    const out = [];
    raw.forEach((a, index) => {
      const title = cleanTitle(a.title);
      if (!title || !/^https?:\/\//.test(a.url || "")) return;
      const fingerprint = title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "").slice(0, 90);
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      const langName = (a.language || "").toLowerCase();
      out.push({
        rank: index,
        title,
        url: a.url,
        domain: (a.domain || "").replace(/^www\./, ""),
        date: parseSeenDate(a.seendate),
        lang: LANG_CODES[langName] || (langName ? langName.slice(0, 2).toUpperCase() : ""),
        image: /^https:\/\//.test(a.socialimage || "") ? a.socialimage : "",
        top: isTopMedium(a.domain)
      });
    });
    return out;
  }

  function visibleArticles() {
    let list = state.articles.slice();
    if (state.source === "top") list = list.filter((a) => a.top);
    if (state.sort === "neu") {
      list.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    } else {
      list.sort((a, b) => (Number(b.top) - Number(a.top)) || (a.rank - b.rank));
    }
    return list;
  }

  function relativeTime(date) {
    const diffSec = (date.getTime() - Date.now()) / 1000;
    const abs = Math.abs(diffSec);
    if (abs < 60) return "gerade eben";
    if (abs < 3600) return relFormatter.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return relFormatter.format(Math.round(diffSec / 3600), "hour");
    if (abs < 86400 * 7) return relFormatter.format(Math.round(diffSec / 86400), "day");
    return shortDateFormatter.format(date);
  }

  // ---------- Rendering ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildMeta(a) {
    const meta = el("div", "meta");
    meta.appendChild(el("span", "meta-source", a.domain || "unbekannte Quelle"));
    if (a.date) {
      meta.appendChild(el("span", "meta-sep", "·"));
      const time = el("time", "", relativeTime(a.date));
      time.dateTime = a.date.toISOString();
      time.title = dateFormatter.format(a.date);
      meta.appendChild(time);
    }
    if (a.lang) {
      const lang = el("span", "meta-lang", a.lang);
      lang.title = "Sprache";
      meta.appendChild(lang);
    }
    if (a.top && state.source !== "top") meta.appendChild(el("span", "meta-top", "Top-Medium"));
    return meta;
  }

  function buildImage(src, className, onFail) {
    const img = el("img", className);
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", onFail, { once: true });
    return img;
  }

  function renderLead(a) {
    const article = el("article", "lead");
    const link = el("a", "lead-link");
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    if (a.image) {
      const media = el("div", "lead-media");
      media.appendChild(buildImage(a.image, "", () => {
        media.remove();
        link.classList.add("no-media");
      }));
      link.appendChild(media);
    } else {
      link.classList.add("no-media");
    }

    const body = el("div", "lead-body");
    body.appendChild(el("span", "eyebrow", state.sort === "neu" ? "Neueste Meldung" : "Top-Meldung"));
    body.appendChild(el("h2", "lead-title", a.title));
    body.appendChild(buildMeta(a));
    link.appendChild(body);
    article.appendChild(link);
    return article;
  }

  function renderStory(a) {
    const li = el("li", "story");
    const link = el("a", "story-link");
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const text = el("div", "story-text");
    text.appendChild(buildMeta(a));
    text.appendChild(el("h3", "story-title", a.title));
    link.appendChild(text);

    if (a.image) link.appendChild(buildImage(a.image, "story-thumb", (e) => e.target.remove()));
    li.appendChild(link);
    return li;
  }

  function renderResults() {
    leadEl.innerHTML = "";
    listEl.innerHTML = "";
    const list = visibleArticles();
    renderMeta(list);

    if (state.articles.length === 0) {
      showNotice("Keine Meldungen gefunden. Wähle einen längeren Zeitraum oder prüfe die Schreibweise.", "warn");
      return;
    }
    if (list.length === 0) {
      showNotice("Im gewählten Zeitraum gibt es keine Meldungen von Top-Medien.", "warn", "Alle Quellen zeigen", () => setSource("alle"));
      return;
    }
    hideNotice();

    leadEl.appendChild(renderLead(list[0]));
    const fragment = document.createDocumentFragment();
    list.slice(1).forEach((a) => fragment.appendChild(renderStory(a)));
    listEl.appendChild(fragment);
  }

  function renderMeta(list) {
    const shown = list || visibleArticles();
    if (shown.length === 0) {
      resultsMeta.textContent = "Keine Meldungen · " + TIMESPAN_LABELS[state.timespan];
      return;
    }
    const sources = new Set(shown.map((a) => a.domain)).size;
    const topCount = state.articles.filter((a) => a.top).length;
    const parts = [
      shown.length + (shown.length === 1 ? " Meldung" : " Meldungen"),
      sources + (sources === 1 ? " Quelle" : " Quellen")
    ];
    if (state.source === "alle" && topCount > 0) parts.push(topCount + " von Top-Medien");
    parts.push(TIMESPAN_LABELS[state.timespan]);
    resultsMeta.textContent = parts.join(" · ");
  }

  function showHeader(target) {
    introEl.hidden = true;
    resultsHead.hidden = false;
    toolbar.hidden = false;
    resultsTitle.textContent = target.label;
    resultsTicker.hidden = !target.ticker;
    resultsTicker.textContent = target.ticker || "";
    document.title = target.label + " – Aktien-News";
  }

  function showNotice(message, kind, actionLabel, onAction) {
    notice.hidden = false;
    notice.className = "notice" + (kind === "error" ? " is-error" : kind === "warn" ? " is-warn" : "");
    noticeText.textContent = message;
    if (actionLabel) {
      noticeAction.hidden = false;
      noticeAction.textContent = actionLabel;
      noticeAction.onclick = onAction;
    } else {
      noticeAction.hidden = true;
      noticeAction.onclick = null;
    }
  }

  function hideNotice() {
    notice.hidden = true;
  }

  function setLoading(on) {
    skeleton.hidden = !on;
    if (on) {
      leadEl.innerHTML = "";
      listEl.innerHTML = "";
    }
  }

  function syncSegments() {
    [[segTime, state.timespan], [segSort, state.sort], [segSource, state.source]].forEach(([group, value]) => {
      group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === value)));
    });
    quickpicksEl.querySelectorAll(".pick").forEach((b) => {
      b.setAttribute("aria-pressed", String(!!state.target && b.dataset.ticker === state.target.ticker));
    });
  }

  function syncUrl() {
    if (!state.target) return;
    const params = new URLSearchParams();
    params.set("q", state.target.ticker || state.target.input);
    if (state.timespan !== "1m") params.set("zeit", state.timespan);
    if (state.sort !== "relevanz") params.set("sort", state.sort);
    if (state.source !== "alle") params.set("quellen", state.source);
    try {
      history.replaceState(null, "", "?" + params.toString());
    } catch (e) { /* z. B. file:// */ }
  }

  function errorMessage(err) {
    switch (err.kind) {
      case "offline":
        return "Keine Internetverbindung. Prüfe deine Verbindung und versuche es erneut.";
      case "rate":
      case "blocked":
        return "Die News-API nimmt gerade keine Anfragen an – meist, weil kurz zuvor schon gesucht wurde. Warte ein paar Sekunden und versuche es erneut.";
      case "gdelt":
        return /short|long/i.test(err.message)
          ? "Der Suchbegriff ist zu kurz oder zu lang. Gib den vollständigen Firmennamen ein, z. B. „Rheinmetall“."
          : "Die News-API meldet: „" + err.message + "“";
      default:
        return "Die News-API antwortet gerade mit einem Fehler (" + err.message + "). Bitte später erneut versuchen.";
    }
  }

  // ---------- Suche ----------

  async function search(target) {
    const token = ++state.token;
    const isStale = () => token !== state.token;
    state.target = target;
    input.value = target.input;
    input.blur();
    closeSuggestions();
    showHeader(target);
    syncSegments();
    syncUrl();

    state.loaded = false;
    const key = cacheKey(target, state.timespan);
    const cached = readCache(key);
    if (cached) {
      setLoading(false);
      state.articles = prepareArticles(cached);
      state.loaded = true;
      renderResults();
      return;
    }

    resultsMeta.textContent = "Suche läuft …";
    setLoading(true);
    hideNotice();
    const onWait = (ms) => {
      if (!isStale()) showNotice("Einen Moment – die News-API erlaubt nur eine Anfrage alle 5 Sekunden (noch " + Math.ceil(ms / 1000) + " s).", "info");
    };

    let raw;
    try {
      try {
        raw = await fetchArticles(target, state.timespan, isStale, onWait);
      } catch (err) {
        if (err.kind !== "rate" && err.kind !== "blocked") throw err;
        if (isStale()) return;
        showNotice("Die News-API bremst gerade. Neuer Versuch in wenigen Sekunden …", "info");
        await sleep(RETRY_EXTRA_DELAY_MS);
        raw = await fetchArticles(target, state.timespan, isStale, onWait);
      }
    } catch (err) {
      if (isStale()) return;
      setLoading(false);
      state.articles = [];
      resultsMeta.textContent = TIMESPAN_LABELS[state.timespan];
      showNotice(errorMessage(err), "error", "Erneut versuchen", () => search(target));
      return;
    }

    if (raw === null || isStale()) return;
    writeCache(key, raw);
    setLoading(false);
    state.articles = prepareArticles(raw);
    state.loaded = true;
    renderResults();
  }

  function searchFromInput(raw) {
    const target = resolveTarget(raw);
    if (!target) {
      showNotice("Bitte gib einen Firmennamen oder ein Tickersymbol ein.", "warn");
      input.focus();
      return;
    }
    search(target);
  }

  function setSource(value) {
    state.source = value;
    syncSegments();
    syncUrl();
    if (state.loaded) renderResults();
  }

  // ---------- Vorschläge ----------

  let activeSuggestion = -1;
  let currentMatches = [];

  function matchStocks(value) {
    const v = value.trim().toLowerCase();
    if (!v) return [];
    const upper = normalizeTicker(value);
    const scored = [];
    STOCKS.forEach((s) => {
      let score = -1;
      if (s.ticker === upper) score = 0;
      else if (s.ticker.startsWith(upper)) score = 1;
      else if (s.name.toLowerCase().startsWith(v)) score = 2;
      else if (s.aliases.some((a) => a.toLowerCase().startsWith(v))) score = 3;
      else if (s.name.toLowerCase().includes(v)) score = 4;
      if (score >= 0) scored.push([score, s]);
    });
    return scored.sort((a, b) => a[0] - b[0]).slice(0, 6).map((x) => x[1]);
  }

  function renderSuggestions() {
    currentMatches = matchStocks(input.value);
    suggestionsEl.innerHTML = "";
    activeSuggestion = -1;
    if (currentMatches.length === 0) {
      closeSuggestions();
      return;
    }
    currentMatches.forEach((s, i) => {
      const li = el("li", "suggestion");
      li.id = "sugg-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.appendChild(el("span", "suggestion-ticker", s.ticker));
      li.appendChild(el("span", "suggestion-name", s.name));
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        pickStock(s);
      });
      suggestionsEl.appendChild(li);
    });
    suggestionsEl.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function closeSuggestions() {
    suggestionsEl.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeSuggestion = -1;
  }

  function moveSuggestion(delta) {
    if (suggestionsEl.hidden || currentMatches.length === 0) return;
    activeSuggestion = (activeSuggestion + delta + currentMatches.length) % currentMatches.length;
    suggestionsEl.querySelectorAll(".suggestion").forEach((li, i) => {
      li.setAttribute("aria-selected", String(i === activeSuggestion));
    });
    input.setAttribute("aria-activedescendant", "sugg-" + activeSuggestion);
  }

  function pickStock(stock) {
    search({ key: stock.ticker, label: stock.name, ticker: stock.ticker, query: stock.query, input: stock.name });
  }

  // ---------- Initialisierung ----------

  function buildQuickPicks() {
    QUICK_PICKS.forEach((ticker) => {
      const stock = STOCKS.find((s) => s.ticker === ticker);
      if (!stock) return;
      const btn = el("button", "pick");
      btn.type = "button";
      btn.dataset.ticker = stock.ticker;
      btn.setAttribute("aria-pressed", "false");
      btn.appendChild(el("span", "pick-ticker", stock.ticker));
      btn.appendChild(el("span", "", stock.name));
      btn.addEventListener("click", () => pickStock(stock));
      quickpicksEl.appendChild(btn);
    });
  }

  function bindSegment(group, onChange) {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (btn) onChange(btn.dataset.value);
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (activeSuggestion >= 0 && currentMatches[activeSuggestion]) {
      pickStock(currentMatches[activeSuggestion]);
      return;
    }
    searchFromInput(input.value);
  });

  input.addEventListener("input", renderSuggestions);
  input.addEventListener("focus", () => { if (input.value.trim()) renderSuggestions(); });
  input.addEventListener("blur", () => setTimeout(closeSuggestions, 120));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSuggestion(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSuggestion(-1); }
    else if (e.key === "Escape") { closeSuggestions(); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  bindSegment(segTime, (value) => {
    if (value === state.timespan) return;
    state.timespan = value;
    if (state.target) search(state.target);
    else syncSegments();
  });

  bindSegment(segSort, (value) => {
    state.sort = value;
    syncSegments();
    syncUrl();
    if (state.loaded) renderResults();
  });

  bindSegment(segSource, setSource);

  buildQuickPicks();

  const params = new URLSearchParams(location.search);
  if (TIMESPAN_LABELS[params.get("zeit")]) state.timespan = params.get("zeit");
  if (params.get("sort") === "neu") state.sort = "neu";
  if (params.get("quellen") === "top") state.source = "top";
  syncSegments();

  const initial = (params.get("q") || "").trim();
  if (initial) searchFromInput(initial);
})();
