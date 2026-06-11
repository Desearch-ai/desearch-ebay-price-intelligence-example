# Desearch eBay Price Intelligence Example

A small public code example showing how to build an eBay price-intelligence UI with the Desearch API.

Live demo: https://desearch-ebay-price-app.vercel.app

## What this example shows

- Uses **Desearch Web Search** instead of AI Search so search operators like `site:ebay.com` are preserved.
- Calls `POST /desearch/ai/search/links/web` with `tools: ["web"]`.
- Optionally crawls selected result links with `GET /web/crawl`.
- Extracts price, shipping, total price, condition, seller rating, and crawl status.
- Ships a simple warm-white UI and a serverless API route for Vercel.

## API flow

### 1. Discover public eBay URLs

```http
POST https://api.desearch.ai/desearch/ai/search/links/web
Authorization: $DESEARCH_API_KEY
Content-Type: application/json
```

```json
{
  "prompt": "site:ebay.com iPhone 15 Pro Max 256GB unlocked used under $850",
  "tools": ["web"],
  "count": 20
}
```

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
