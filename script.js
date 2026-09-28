(function () {
  "use strict";

  // Vorbereitete Schlagzeilen (Google News), alle 2 Stunden per GitHub Actions aktualisiert.
  const DATA_BASE = "https://raw.githubusercontent.com/vhaasis/rechner-/news-data/";

  const STOCKS = (window.STOCKS || []).map(([ticker, name, query, aliases]) => ({
    ticker, name, query: query || quote(name), aliases: aliases || []
  }));

  const QUICK_PICKS = ["TSLA", "NVDA", "AAPL", "SAP", "RHM", "MSFT", "VOW3"];

  const TOP_MEDIA = [
    "reuters.com", "bloomberg.com", "cnbc.com", "marketwatch.com", "wsj.com", "ft.com",
    "finance.yahoo.com", "barrons.com", "forbes.com", "businessinsider.com", "economist.com",
    "nytimes.com", "apnews.com", "bbc.com", "bbc.co.uk", "theguardian.com", "cnn.com",
    "fool.com", "investing.com", "seekingalpha.com", "morningstar.com",
    "handelsblatt.com", "faz.net", "sueddeutsche.de", "spiegel.de", "zeit.de", "welt.de",
    "tagesschau.de", "boerse-online.de", "finanzen.net", "manager-magazin.de", "wiwo.de",
    "n-tv.de", "deraktionaer.de", "onvista.de", "boerse.de", "capital.de", "boersen-zeitung.de",
    "tagesspiegel.de", "nzz.ch", "derstandard.at"
  ];

  const TIMESPANS = {
    "1d": { days: 1, label: "letzte 24 Stunden" },
    "3d": { days: 3, label: "letzte 3 Tage" },
    "1w": { days: 7, label: "letzte Woche" },
    "1m": { days: 31, label: "letzter Monat" }
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
  const todayEl = $("today");
  const todayDate = $("todayDate");
  const todayMeta = $("todayMeta");
  const segRegion = $("segRegion");
  const todayNotice = $("todayNotice");
  const todayNoticeText = $("todayNoticeText");
  const todayNoticeAction = $("todayNoticeAction");
  const todaySkeleton = $("todaySkeleton");
  const todayLead = $("todayLead");
  const todayList = $("todayList");
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
    timespan: "1w",
    sort: "relevanz",
    source: "alle",
    mode: null,        // "feed" (vorbereitete Daten) oder "live" (GDELT)
    pool: [],
    updated: null,
    loaded: false,
    token: 0
  };

  const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  const shortDateFormatter = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
  const longDateFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const relFormatter = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

  function quote(text) {
    return /[\s\-'&.]/.test(text) ? '"' + text + '"' : text;
  }

  function safeStorage(kind) {
    try {
      const s = window[kind];
      s.setItem("__probe__", "1");
      s.removeItem("__probe__");
      return s;
    } catch (e) {
      return null;
    }
  }

  const local = safeStorage("localStorage");
  const session = safeStorage("sessionStorage");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  function stockTarget(stock) {
    return { key: stock.ticker, label: stock.name, ticker: stock.ticker, query: stock.query, input: stock.name };
  }

  function resolveTarget(raw) {
    const stock = findStock(raw);
    if (stock) return stockTarget(stock);
    const cleaned = raw.replace(/["():]/g, " ").replace(/\s+/g, " ").trim().replace(/^-+/, "");
    if (cleaned.length < 2) return null;
    return { key: cleaned.toLowerCase(), label: cleaned, ticker: null, query: quote(cleaned), input: cleaned };
  }

  // ---------- Cache ----------

  const memoryCache = new Map();

  function readCache(key) {
    let entry = memoryCache.get(key);
    if (!entry && session) {
      try { entry = JSON.parse(session.getItem(key) || "null"); } catch (e) { entry = null; }
    }
    return entry && Date.now() - entry.ts < CACHE_TTL_MS ? entry.value : null;
  }

  function writeCache(key, value) {
    const entry = { ts: Date.now(), value };
    memoryCache.set(key, entry);
    if (session) {
      try { session.setItem(key, JSON.stringify(entry)); } catch (e) { /* Speicher voll oder gesperrt */ }
    }
  }

  // ---------- Vorbereitete Daten ----------

  async function loadFeed(ticker) {
    const key = "feed:" + ticker;
    const cached = readCache(key);
    if (cached) return cached;
    let res;
    try {
      res = await fetch(DATA_BASE + encodeURIComponent(ticker) + ".json");
    } catch (e) {
      return null;
    }
    if (!res.ok) return null;
    let data;
    try { data = await res.json(); } catch (e) { return null; }
    if (!data || !Array.isArray(data.items)) return null;
    writeCache(key, data);
    return data;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  function prepareFeed(items) {
    return dedupe(items.map((it, i) => {
      const host = hostOf(it.sourceUrl);
      return {
        rank: i,
        title: cleanTitle(it.title),
        url: it.url,
        source: it.source || host,
        date: parseDate(it.date),
        lang: it.lang || "",
        image: "",
        top: isTopMedium(host)
      };
    }));
  }

  // ---------- GDELT (Live-Fallback) ----------

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

  let queue = Promise.resolve();

  // GDELT erlaubt nur ~1 Anfrage alle 5 Sekunden pro IP; Abrufe laufen seriell mit Mindestabstand.
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

  function gdeltUrl(query, timespan) {
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

  async function fetchGdelt(target, timespan, isStale, onWait) {
    let res;
    try {
      res = await queuedFetch(gdeltUrl(target.query, timespan), isStale, onWait);
    } catch (e) {
      if (navigator.onLine === false) throw new ApiError("offline", "offline");
      // Abgewiesene Anfragen (Rate-Limit) kommen ohne CORS-Header an und schlagen als Netzwerkfehler auf.
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

  function parseSeenDate(seendate) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate || "");
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return isNaN(d.getTime()) ? null : d;
  }

  function prepareGdelt(raw) {
    return dedupe(raw.map((a, i) => {
      const host = (a.domain || "").replace(/^www\./, "");
      const langName = (a.language || "").toLowerCase();
      return {
        rank: i,
        title: cleanTitle(a.title),
        url: a.url,
        source: host,
        date: parseSeenDate(a.seendate),
        lang: LANG_CODES[langName] || (langName ? langName.slice(0, 2).toUpperCase() : ""),
        image: /^https:\/\//.test(a.socialimage || "") ? a.socialimage : "",
        top: isTopMedium(host)
      };
    }));
  }

  // ---------- Aufbereitung ----------

  function parseDate(value) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function cleanTitle(title) {
    return (title || "").replace(/\s+/g, " ").replace(/\s+([,.;:!?%])/g, "$1").trim();
  }

  function isTopMedium(host) {
    const h = (host || "").toLowerCase();
    return TOP_MEDIA.some((t) => h === t || h.endsWith("." + t));
  }

  function dedupe(list) {
    const seen = new Set();
    return list.filter((a) => {
      if (!a.title || !/^https?:\/\//.test(a.url || "")) return false;
      const fingerprint = a.title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "").slice(0, 90);
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
  }

  function inTimespan(list) {
    const cutoff = Date.now() - TIMESPANS[state.timespan].days * 86400000;
    return list.filter((a) => !a.date || a.date.getTime() >= cutoff);
  }

  function visibleArticles() {
    let list = inTimespan(state.pool);
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

  function buildMeta(a, showTop) {
    const meta = el("div", "meta");
    meta.appendChild(el("span", "meta-source", a.source || "unbekannte Quelle"));
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
    if (a.top && showTop) meta.appendChild(el("span", "meta-top", "Top-Medium"));
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

  function newsLink(className, a) {
    const link = el("a", className);
    link.href = a.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function renderLead(a, eyebrow, showTop) {
    const article = el("article", "lead");
    const link = newsLink("lead-link", a);
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
    body.appendChild(el("span", "eyebrow", eyebrow));
    body.appendChild(el("h2", "lead-title", a.title));
    body.appendChild(buildMeta(a, showTop));
    link.appendChild(body);
    article.appendChild(link);
    return article;
  }

  function renderStory(a, showTop) {
    const li = el("li", "story");
    const link = newsLink("story-link", a);
    const text = el("div", "story-text");
    text.appendChild(buildMeta(a, showTop));
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

    if (inTimespan(state.pool).length === 0) {
      const wider = state.timespan !== "1m";
      showNotice(
        "Keine Meldungen im gewählten Zeitraum." + (wider ? "" : " Prüfe die Schreibweise oder versuche einen anderen Namen."),
        "warn",
        wider ? "Letzten Monat zeigen" : null,
        wider ? () => setTimespan("1m") : null
      );
      return;
    }
    if (list.length === 0) {
      showNotice("Im gewählten Zeitraum gibt es keine Meldungen von Top-Medien.", "warn", "Alle Quellen zeigen", () => setSource("alle"));
      return;
    }
    hideNotice();

    const showTop = state.source !== "top";
    leadEl.appendChild(renderLead(list[0], state.sort === "neu" ? "Neueste Meldung" : "Top-Meldung", showTop));
    const fragment = document.createDocumentFragment();
    list.slice(1).forEach((a) => fragment.appendChild(renderStory(a, showTop)));
    listEl.appendChild(fragment);
  }

  function renderMeta(list) {
    const parts = [];
    if (list.length === 0) {
      parts.push("Keine Meldungen");
    } else {
      const sources = new Set(list.map((a) => a.source)).size;
      parts.push(list.length + (list.length === 1 ? " Meldung" : " Meldungen"));
      parts.push(sources + (sources === 1 ? " Quelle" : " Quellen"));
    }
    parts.push(TIMESPANS[state.timespan].label);
    if (state.mode === "feed" && state.updated) parts.push("aktualisiert " + relativeTime(state.updated));
    resultsMeta.textContent = parts.join(" · ");
  }

  function showHeader(target) {
    todayEl.hidden = true;
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
    noticeAction.hidden = !actionLabel;
    noticeAction.textContent = actionLabel || "";
    noticeAction.onclick = onAction || null;
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
    if (state.timespan !== "1w") params.set("zeit", state.timespan);
    if (state.sort !== "relevanz") params.set("sort", state.sort);
    if (state.source !== "alle") params.set("quellen", state.source);
    try {
      history.replaceState(null, "", "?" + params.toString());
    } catch (e) { /* z. B. file:// */ }
  }

  function errorMessage(err, target) {
    switch (err.kind) {
      case "offline":
        return "Keine Internetverbindung. Prüfe deine Verbindung und versuche es erneut.";
      case "rate":
      case "blocked":
        return (target.ticker ? "" : "Firmen außerhalb der Vorschlagsliste werden live über GDELT gesucht. ") +
          "GDELT nimmt von deiner Verbindung gerade keine Anfragen an – das passiert oft in Uni- oder Firmennetzen und mit iCloud Private Relay. " +
          "Wähle eine Aktie aus der Vorschlagsliste oder versuche es später erneut.";
      case "gdelt":
        return /short|long/i.test(err.message)
          ? "Der Suchbegriff ist zu kurz oder zu lang. Gib den vollständigen Firmennamen ein, z. B. „Rheinmetall“."
          : "Die News-Quelle meldet: „" + err.message + "“";
      default:
        return "Die News-Quelle antwortet gerade mit einem Fehler (" + err.message + "). Bitte später erneut versuchen.";
    }
  }

  // ---------- Suche ----------

  function applyPool(mode, pool, updated) {
    setLoading(false);
    state.mode = mode;
    state.pool = pool;
    state.updated = updated || null;
    state.loaded = true;
    renderResults();
  }

  async function search(target) {
    const token = ++state.token;
    const isStale = () => token !== state.token;
    state.target = target;
    state.loaded = false;
    input.value = target.input;
    input.blur();
    closeSuggestions();
    showHeader(target);
    syncSegments();
    syncUrl();
    hideNotice();
    resultsMeta.textContent = "Suche läuft …";
    setLoading(true);

    if (target.ticker) {
      const feed = await loadFeed(target.ticker);
      if (isStale()) return;
      if (feed) {
        applyPool("feed", prepareFeed(feed.items), parseDate(feed.updated));
        return;
      }
    }
    await searchLive(target, token, isStale);
  }

  async function searchLive(target, token, isStale) {
    const key = "gdelt:" + target.key + ":" + state.timespan;
    const cached = readCache(key);
    if (cached) {
      applyPool("live", prepareGdelt(cached));
      return;
    }
    const onWait = (ms) => {
      if (!isStale()) showNotice("Einen Moment – die Live-Suche erlaubt nur eine Anfrage alle 5 Sekunden (noch " + Math.ceil(ms / 1000) + " s).", "info");
    };

    let raw;
    try {
      try {
        raw = await fetchGdelt(target, state.timespan, isStale, onWait);
      } catch (err) {
        if (err.kind !== "rate" && err.kind !== "blocked") throw err;
        if (isStale()) return;
        showNotice("Die Live-Suche bremst gerade. Neuer Versuch in wenigen Sekunden …", "info");
        await sleep(RETRY_EXTRA_DELAY_MS);
        raw = await fetchGdelt(target, state.timespan, isStale, onWait);
      }
    } catch (err) {
      if (isStale()) return;
      setLoading(false);
      state.mode = "live";
      state.pool = [];
      resultsMeta.textContent = TIMESPANS[state.timespan].label;
      showNotice(errorMessage(err, target), "error", "Erneut versuchen", () => search(target));
      return;
    }

    if (raw === null || isStale()) return;
    writeCache(key, raw);
    applyPool("live", prepareGdelt(raw));
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

  function setTimespan(value) {
    if (value === state.timespan) return;
    state.timespan = value;
    syncSegments();
    syncUrl();
    if (!state.target) return;
    // Vorbereitete Daten decken 30 Tage ab und werden nur lokal gefiltert; die Live-Suche fragt neu an.
    if (state.mode === "feed" && state.loaded) renderResults();
    else search(state.target);
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
        search(stockTarget(s));
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

  // ---------- Startseite: NEWS Heute ----------

  const today = { items: [], updated: null, region: "alle" };
  const TODAY_MAX = 21;

  function showTodayNotice(message, kind, actionLabel, onAction) {
    todayNotice.hidden = false;
    todayNotice.className = "notice" + (kind === "error" ? " is-error" : kind === "warn" ? " is-warn" : "");
    todayNoticeText.textContent = message;
    todayNoticeAction.hidden = !actionLabel;
    todayNoticeAction.textContent = actionLabel || "";
    todayNoticeAction.onclick = onAction || null;
  }

  function todaySelection() {
    const list = today.region === "alle" ? today.items : today.items.filter((a) => a.lang === today.region);
    const now = Date.now();
    const within = (hours) => list.filter((a) => a.date && now - a.date.getTime() <= hours * 3600000);
    let hours = 24;
    let picked = within(24);
    if (picked.length < 6) {
      const wider = within(48);
      if (wider.length > picked.length) {
        hours = 48;
        picked = wider;
      }
    }
    return { hours, items: picked.slice(0, TODAY_MAX) };
  }

  function renderToday() {
    todayLead.innerHTML = "";
    todayList.innerHTML = "";
    segRegion.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === today.region)));

    const { hours, items } = todaySelection();
    const parts = [];
    parts.push(items.length ? items.length + (items.length === 1 ? " Meldung" : " Meldungen") : "Keine Meldungen");
    parts.push("letzte " + hours + " Stunden");
    if (today.updated) parts.push("aktualisiert " + relativeTime(today.updated));
    todayMeta.textContent = parts.join(" · ");

    if (items.length === 0) {
      showTodayNotice("Für diese Auswahl gibt es gerade keine aktuellen Meldungen.", "warn");
      return;
    }
    todayNotice.hidden = true;
    todayLead.appendChild(renderLead(items[0], "Top-Meldung des Tages", false));
    const fragment = document.createDocumentFragment();
    items.slice(1).forEach((a) => fragment.appendChild(renderStory(a, false)));
    todayList.appendChild(fragment);
  }

  async function loadToday() {
    todayDate.textContent = longDateFormatter.format(new Date());
    todayNotice.hidden = true;
    todaySkeleton.hidden = false;
    todayMeta.textContent = "Lade die Schlagzeilen des Tages …";

    let data = readCache("today");
    if (!data) {
      try {
        const res = await fetch(DATA_BASE + "heute.json");
        if (res.ok) data = await res.json();
      } catch (e) {
        data = null;
      }
      if (data && Array.isArray(data.items)) writeCache("today", data);
    }
    todaySkeleton.hidden = true;

    if (!data || !Array.isArray(data.items)) {
      todayMeta.textContent = "";
      showTodayNotice(
        navigator.onLine === false
          ? "Keine Internetverbindung."
          : "Die Schlagzeilen des Tages konnten gerade nicht geladen werden.",
        "error", "Erneut versuchen", loadToday
      );
      return;
    }
    today.items = prepareFeed(data.items);
    today.updated = parseDate(data.updated);
    renderToday();
  }

  bindSegment(segRegion, (value) => {
    today.region = value;
    if (today.items.length) renderToday();
  });

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
      btn.addEventListener("click", () => search(stockTarget(stock)));
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
      search(stockTarget(currentMatches[activeSuggestion]));
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

  bindSegment(segTime, setTimespan);
  bindSegment(segSort, (value) => {
    state.sort = value;
    syncSegments();
    syncUrl();
    if (state.loaded) renderResults();
  });
  bindSegment(segSource, setSource);

  buildQuickPicks();

  const params = new URLSearchParams(location.search);
  if (TIMESPANS[params.get("zeit")]) state.timespan = params.get("zeit");
  if (params.get("sort") === "neu") state.sort = "neu";
  if (params.get("quellen") === "top") state.source = "top";
  syncSegments();

  const initial = (params.get("q") || "").trim();
  if (initial) searchFromInput(initial);
  else loadToday();
})();
