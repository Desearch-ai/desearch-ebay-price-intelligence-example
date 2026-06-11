# Desearch eBay Price Intelligence Example

A small public code example showing how to build an eBay price-intelligence UI with the Desearch API.

Live demo: https://desearch-ebay-price-app.vercel.app

## What this example shows

- Uses the **SERP Web Search** endpoint instead of AI Search so search operators like `site:ebay.com` are preserved.
- Calls `GET /web?query=site%3Aebay.com+...&start=0` and paginates with `start=10`, `start=20`, etc.
- Optionally crawls selected result links with `GET /web/crawl`.
- Extracts price, shipping, total price, condition, seller rating, and crawl status.
- Ships a simple premium UI with presets, advanced settings, staged loaders, summary cards, best-deal highlight, and JSON export.

## API flow

### 1. Discover public eBay URLs

```http
GET https://api.desearch.ai/web?query=site%3Aebay.com%20iPhone%2015%20Pro%20Max%20256GB%20unlocked%20used%20under%20%24850&start=0
Authorization: $DESEARCH_API_KEY
```

For the next page, call the same endpoint with `start=10`; for page 3 use `start=20`.

### 2. Crawl selected listing/result pages

```http
GET https://api.desearch.ai/web/crawl?url=https://www.ebay.com/itm/...&format=text&js=false
Authorization: $DESEARCH_API_KEY
```

For JS-rendered pages:

```http
GET https://api.desearch.ai/web/crawl?url=https://www.ebay.com/itm/...&format=text&js=true&wait=3000
Authorization: $DESEARCH_API_KEY
```

## Run locally

```bash
npm install
cp .env.example .env
# edit .env and set DESEARCH_API_KEY, or paste a key in the UI
npm start
```

Open http://localhost:3000.

## Test

```bash
npm test
```

## Deploy on Vercel

```bash
vercel
vercel env add DESEARCH_API_KEY production
vercel --prod
```

If `DESEARCH_API_KEY` is not configured on the deployment, the UI can still accept a test key and pass it to `/api/search` using the `X-Desearch-Api-Key` header.

## Project structure

```txt
api/search.js       Vercel serverless API route
src/lib.mjs         Desearch calls, parsing, normalization, summary helpers
public/index.html   Demo UI
public/app.js       Browser interaction
public/styles.css   Warm-white UI styles
server.mjs          Local static server + API route
test/lib.test.mjs   Node test suite
```

## Notes

This is a demo, not a full scraping platform. eBay may change markup, block some pages, or require JS rendering. For production-grade marketplace monitoring, add queues, retries, persistence, proxy/session handling where legally allowed, and more robust extraction.
