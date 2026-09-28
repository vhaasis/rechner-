(function () {
  "use strict";

  // Kuratiertes Mapping Ticker -> Firmenname, verbessert die Trefferqualität
  // bei der Volltextsuche (GDELT kennt keine Ticker-Symbole direkt).
  const TICKER_MAP = {
    AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Alphabet Google", GOOG: "Alphabet Google",
    AMZN: "Amazon", TSLA: "Tesla", META: "Meta Platforms", NVDA: "Nvidia",
    NFLX: "Netflix", AMD: "AMD", INTC: "Intel", BA: "Boeing", DIS: "Disney",
    KO: "Coca-Cola", PEP: "PepsiCo", JPM: "JPMorgan Chase", V: "Visa",
    MA: "Mastercard", PYPL: "PayPal", UBER: "Uber", SHOP: "Shopify", BABA: "Alibaba",
    SAP: "SAP SE", SIE: "Siemens", "SIE.DE": "Siemens", VOW3: "Volkswagen",
    "VOW3.DE": "Volkswagen", BMW: "BMW", "BMW.DE": "BMW", ALV: "Allianz",
    "ALV.DE": "Allianz", DTE: "Deutsche Telekom", "DTE.DE": "Deutsche Telekom",
    DBK: "Deutsche Bank", "DBK.DE": "Deutsche Bank", BAS: "BASF", "BAS.DE": "BASF",
    ADS: "Adidas", "ADS.DE": "Adidas", MBG: "Mercedes-Benz", "MBG.DE": "Mercedes-Benz",
    RWE: "RWE", "RWE.DE": "RWE", EOAN: "E.ON", "EOAN.DE": "E.ON",
    BAYN: "Bayer", "BAYN.DE": "Bayer", LIN: "Linde", NKE: "Nike",
    MCD: "McDonald's", SBUX: "Starbucks", WMT: "Walmart", XOM: "ExxonMobil",
    CVX: "Chevron", PFE: "Pfizer", JNJ: "Johnson & Johnson", IBM: "IBM",
    ORCL: "Oracle", CRM: "Salesforce", ADBE: "Adobe", QCOM: "Qualcomm"
  };

  const POPULAR = ["Apple", "Tesla", "Microsoft", "Nvidia", "SAP", "Amazon", "Volkswagen", "BMW"];

  const TRUSTED_DOMAINS = [
    "reuters.com", "bloomberg.com", "cnbc.com", "marketwatch.com", "wsj.com",
    "ft.com", "finance.yahoo.com", "investing.com", "barrons.com", "forbes.com",
    "businessinsider.com", "handelsblatt.com", "faz.net", "spiegel.de",
    "boerse-online.de", "finanzen.net", "manager-magazin.de", "wiwo.de", "n-tv.de"
  ];

  const form = document.getElementById("searchForm");
  const input = document.getElementById("stockInput");
  const suggestions = document.getElementById("suggestions");
  const chipRow = document.getElementById("popularChips");
  const timespanSelect = document.getElementById("timespanSelect");
  const trustedOnly = document.getElementById("trustedOnly");
  const statusBox = document.getElementById("statusBox");
  const newsList = document.getElementById("newsList");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsCount = document.getElementById("resultsCount");

  const dateFormatter = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  function buildChips() {
    chipRow.innerHTML = "";
    POPULAR.forEach((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = name;
      chip.addEventListener("click", () => {
        input.value = name;
        runSearch(name);
      });
      chipRow.appendChild(chip);
    });
  }

  function resolveQueryTerm(raw) {
    const trimmed = raw.trim();
    const asTicker = trimmed.toUpperCase();
    if (TICKER_MAP[asTicker]) return TICKER_MAP[asTicker];
    return trimmed;
  }

  function updateSuggestions() {
    const val = input.value.trim().toUpperCase();
    if (!val) {
      suggestions.hidden = true;
      suggestions.innerHTML = "";
      return;
    }
    const matches = Object.keys(TICKER_MAP)
      .filter((t) => t.startsWith(val) || TICKER_MAP[t].toUpperCase().includes(val))
      .slice(0, 6);
    if (matches.length === 0) {
      suggestions.hidden = true;
      suggestions.innerHTML = "";
      return;
    }
    suggestions.innerHTML = "";
    matches.forEach((ticker) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "suggestion-item";
      item.textContent = ticker + " – " + TICKER_MAP[ticker];
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = TICKER_MAP[ticker];
        suggestions.hidden = true;
        runSearch(TICKER_MAP[ticker]);
      });
      suggestions.appendChild(item);
    });
    suggestions.hidden = false;
  }

  function buildGdeltUrl(term, { timespan, useTrustedDomains }) {
    let query = '"' + term.replace(/"/g, "") + '"';
    if (useTrustedDomains) {
      const domainClause = TRUSTED_DOMAINS.map((d) => "domain:" + d).join(" OR ");
      query += " (" + domainClause + ")";
    }
    const params = new URLSearchParams({
      query: query,
      mode: "artlist",
      format: "json",
      maxrecords: "30",
      sort: "hybridrel",
      timespan: timespan
    });
    return "https://api.gdeltproject.org/api/v2/doc/doc?" + params.toString();
  }

  async function fetchArticles(term, options) {
    const url = buildGdeltUrl(term, options);
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    if (!text.trim()) return [];
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Unerwartete Antwort der News-API");
    }
    return data.articles || [];
  }

  function parseSeenDate(seendate) {
    // Format: YYYYMMDDTHHMMSSZ
    if (!seendate || seendate.length < 15) return null;
    const iso = seendate.slice(0, 4) + "-" + seendate.slice(4, 6) + "-" + seendate.slice(6, 8) +
      "T" + seendate.slice(9, 11) + ":" + seendate.slice(11, 13) + ":" + seendate.slice(13, 15) + "Z";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function renderArticles(articles, term) {
    newsList.innerHTML = "";
    resultsTitle.textContent = "Ergebnisse für „" + term + "“";
    resultsCount.textContent = articles.length + (articles.length === 1 ? " Artikel" : " Artikel");

    if (articles.length === 0) {
      setStatus("Keine News gefunden. Versuche einen anderen Suchbegriff oder einen größeren Zeitraum.", "fail");
      return;
    }
    setStatus("", null, true);

    articles.forEach((a) => {
      const card = document.createElement("a");
      card.className = "news-item";
      card.href = a.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";

      if (a.socialimage) {
        const img = document.createElement("img");
        img.className = "news-thumb";
        img.src = a.socialimage;
        img.alt = "";
        img.loading = "lazy";
        img.onerror = () => { img.remove(); };
        card.appendChild(img);
      }

      const body = document.createElement("div");
      body.className = "news-body";

      const title = document.createElement("div");
      title.className = "news-title";
      title.textContent = a.title || "(ohne Titel)";
      body.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "news-meta";
      const date = parseSeenDate(a.seendate);
      const parts = [];
      if (a.domain) parts.push(a.domain);
      if (date) parts.push(dateFormatter.format(date));
      meta.textContent = parts.join(" · ");
      body.appendChild(meta);

      card.appendChild(body);
      newsList.appendChild(card);
    });
  }

  function setStatus(message, kind, hide) {
    if (hide) {
      statusBox.hidden = true;
      return;
    }
    statusBox.hidden = false;
    statusBox.className = "status-box" + (kind ? " " + kind : "");
    statusBox.textContent = message;
  }

  let requestToken = 0;

  async function runSearch(rawInput) {
    const raw = (rawInput !== undefined ? rawInput : input.value).trim();
    if (!raw) {
      setStatus("Bitte eine Aktie oder ein Tickersymbol eingeben.", "fail");
      return;
    }
    suggestions.hidden = true;
    const term = resolveQueryTerm(raw);
    const timespan = timespanSelect.value;
    const useTrustedDomains = trustedOnly.checked;

    const myToken = ++requestToken;
    newsList.innerHTML = "";
    resultsCount.textContent = "";
    resultsTitle.textContent = "Suche nach „" + term + "“ …";
    setStatus("Lade News …", "loading");

    try {
      let articles = await fetchArticles(term, { timespan, useTrustedDomains });
      let fallbackUsed = false;
      if (articles.length === 0 && useTrustedDomains) {
        articles = await fetchArticles(term, { timespan, useTrustedDomains: false });
        fallbackUsed = true;
      }
      if (myToken !== requestToken) return; // veraltete Antwort ignorieren

      renderArticles(articles, term);
      if (fallbackUsed && articles.length > 0) {
        setStatus("Keine Treffer in den seriösen Wirtschaftsmedien – zeige Ergebnisse aus allen Quellen.", "warn");
      }
    } catch (err) {
      if (myToken !== requestToken) return;
      resultsTitle.textContent = "Ergebnisse";
      setStatus("Die News konnten nicht geladen werden (" + err.message + "). Bitte später erneut versuchen.", "fail");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });

  input.addEventListener("input", updateSuggestions);
  input.addEventListener("blur", () => {
    setTimeout(() => { suggestions.hidden = true; }, 150);
  });
  timespanSelect.addEventListener("change", () => {
    if (input.value.trim()) runSearch();
  });
  trustedOnly.addEventListener("change", () => {
    if (input.value.trim()) runSearch();
  });

  buildChips();
})();
