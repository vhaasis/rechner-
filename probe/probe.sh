#!/usr/bin/env bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
t() { # Titel, URL, [weitere curl-Argumente]
  local title="$1" url="$2"; shift 2
  echo "=== $title"
  curl -sS -m 20 -A "$UA" -o /tmp/body -w "HTTP %{http_code} %{content_type} %{size_download}B\n" "$@" "$url" 2>&1
  head -c 350 /tmp/body | tr '\n' ' '; echo; echo
}
t "Yahoo chart AAPL (query1)" "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d"
t "Yahoo chart AAPL (query2)" "https://query2.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1d"
# Yahoo mit Cookie + Crumb
curl -sS -m 20 -A "$UA" -c /tmp/cj -o /dev/null -w "cookie-seite HTTP %{http_code}\n" https://fc.yahoo.com
echo "=== Yahoo crumb"; curl -sS -m 20 -A "$UA" -b /tmp/cj -w "\nHTTP %{http_code}\n" https://query1.finance.yahoo.com/v1/test/getcrumb | head -c 200; echo
t "Stooq Quote AAPL" "https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvp&h&e=csv"
t "Stooq Quote SAP.DE" "https://stooq.com/q/l/?s=sap.de&f=sd2t2ohlcv&h&e=csv"
t "Stooq Historie AAPL" "https://stooq.com/q/d/l/?s=aapl.us&i=d"
t "CoinGecko simple price" "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,dogecoin&vs_currencies=eur&include_24hr_change=true&include_last_updated_at=true"
t "Google Finance AAPL" "https://www.google.com/finance/quote/AAPL:NASDAQ?hl=de" -H "Accept-Language: de-DE,de;q=0.9"
t "Binance BTCEUR" "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCEUR"
t "Kraken XBTEUR" "https://api.kraken.com/0/public/Ticker?pair=XBTEUR"
t "Twelve Data (ohne Key)" "https://api.twelvedata.com/quote?symbol=AAPL"
t "Finnhub (ohne Key)" "https://finnhub.io/api/v1/quote?symbol=AAPL"
# 1790705764
