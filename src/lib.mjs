const DESEARCH_BASE_URL = 'https://api.desearch.ai';

export function normalizeSite(site = 'ebay.com') {
  return String(site || 'ebay.com')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

export function buildWebSearchPrompt(query, site = 'ebay.com') {
  const q = String(query || '').trim();
  const normalizedSite = normalizeSite(site);
  return `site:${normalizedSite} ${q}`.trim();
}

export function clampCount(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 10;
  return Math.max(10, Math.min(200, n));
}

export function flattenWebSearchResults(response = {}) {
  const groups = [
    'search_results',
    'youtube_search_results',
    'hacker_news_search_results',
    'reddit_search_results',
    'arxiv_search_results',
    'wikipedia_search_results',
  ];

  return groups.flatMap((group) => {
    const items = Array.isArray(response[group]) ? response[group] : [];
    return items
      .filter((item) => item && item.link)
      .map((item) => ({
        title: item.title || 'Untitled result',
        snippet: item.snippet || '',
        link: item.link,
        source: group,
      }));
  });
}

function canonicalLink(link) {
  try {
    const url = new URL(link);
    url.hash = '';
    const drop = ['mkcid', 'mkevt', 'mkrid', 'campid', 'toolid', 'customid', 'var', 'hash', 'amdata'];
    for (const key of drop) url.searchParams.delete(key);
    const keys = [...url.searchParams.keys()].sort();
    const sorted = new URL(url.origin + url.pathname);
    for (const key of keys) sorted.searchParams.set(key, url.searchParams.get(key));
    return sorted.toString().replace(/\/$/, '');
  } catch {
    return String(link || '').trim();
  }
}

export function dedupeResults(results = []) {
  const seen = new Set();
  const deduped = [];
  for (const result of results) {
    const key = canonicalLink(result.link);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...result, canonicalLink: key });
  }
  return deduped;
}

export function filterResultsBySite(results = [], site = 'ebay.com') {
  const normalizedSite = normalizeSite(site).split('/')[0].replace(/^www\./i, '').toLowerCase();
  return results.filter((result) => {
    try {
      const host = new URL(result.link).hostname.replace(/^www\./i, '').toLowerCase();
      return host === normalizedSite || host.endsWith(`.${normalizedSite}`);
    } catch {
      return false;
    }
  });
}

export function extractMoney(text = '') {
  const matches = [];
  const moneyPattern = /(?:US\s*)?\$\s*([0-9][0-9,]*(?:\.\d{2})?)/gi;
  let match;
  while ((match = moneyPattern.exec(String(text))) !== null) {
    const value = Number.parseFloat(match[1].replace(/,/g, ''));
    if (Number.isFinite(value)) matches.push(value);
  }
  return matches;
}

function pickPrice(text) {
  const prices = extractMoney(text).filter((value) => value > 0);
  if (!prices.length) return null;
  // eBay snippets sometimes include original/similar prices. Use the first explicit price as listing price.
  return roundMoney(prices[0]);
}

function pickShipping(text) {
  const lower = String(text).toLowerCase();
  if (/free\s+shipping/.test(lower)) return 0;
  const shippingMatch = lower.match(/(?:shipping|delivery)[^$]{0,40}\$\s*([0-9][0-9,]*(?:\.\d{2})?)/i);
  if (!shippingMatch) return null;
  return roundMoney(Number.parseFloat(shippingMatch[1].replace(/,/g, '')));
}

function pickCondition(text) {
  const value = String(text);
  const explicit = value.match(/condition\s*:?\s*(new other|open box|brand new|pre-owned|used|new|refurbished|for parts|parts only)/i);
  if (explicit) return titleCase(explicit[1]);
  const inferred = value.match(/\b(new other|open box|brand new|pre-owned|used|new|refurbished|for parts|parts only)\b/i);
  return inferred ? titleCase(inferred[1]) : null;
}

function pickSellerRating(text) {
  const match = String(text).match(/(\d{1,3}(?:\.\d+)?)%\s*(?:positive\s*)?(?:feedback|seller|rating)/i);
  return match ? `${match[1]}%` : null;
}

function titleCase(value) {
  return String(value).replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function roundMoney(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
}

export function extractListingDetails(result, crawlText = '') {
  const combined = `${result?.title || ''}\n${result?.snippet || ''}\n${crawlText || ''}`;
  const price = pickPrice(combined);
  const shipping = pickShipping(combined);
  const totalPrice = price == null ? null : roundMoney(price + (shipping || 0));

  return {
    title: result?.title || 'Untitled listing',
    snippet: result?.snippet || '',
    link: result?.link,
    canonicalLink: result?.canonicalLink || canonicalLink(result?.link),
    source: result?.source || 'search_results',
    price,
    shipping,
    totalPrice,
    condition: pickCondition(combined),
    sellerRating: pickSellerRating(combined),
    crawled: Boolean(crawlText),
    crawlPreview: crawlText ? String(crawlText).slice(0, 700) : '',
  };
}

export function summarizeListings(listings = []) {
  const priced = listings
    .filter((listing) => Number.isFinite(Number(listing.totalPrice)))
    .map((listing) => ({ ...listing, totalPrice: Number(listing.totalPrice) }))
    .sort((a, b) => a.totalPrice - b.totalPrice);

  const prices = priced.map((listing) => listing.totalPrice);
  const totalFound = listings.length;
  const pricedCount = priced.length;
  const averagePrice = pricedCount ? roundMoney(prices.reduce((sum, price) => sum + price, 0) / pricedCount) : null;
  const medianPrice = pricedCount
    ? roundMoney(prices.length % 2 ? prices[Math.floor(prices.length / 2)] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2)
    : null;

  return {
    totalFound,
    pricedCount,
    averagePrice,
    medianPrice,
    lowest: priced[0] || null,
    highest: priced[priced.length - 1] || null,
    bestDeals: priced.slice(0, 5),
  };
}

function getBillingHeaders(response) {
  return {
    costUsd: response.headers.get('x-desearch-cost-usd'),
    usageCount: response.headers.get('x-desearch-usage-count'),
    service: response.headers.get('x-desearch-service'),
    currency: response.headers.get('x-desearch-currency'),
  };
}

async function readResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

export async function callDesearchWebSearch({ query, site, count, apiKey, fetchImpl = fetch }) {
  const prompt = buildWebSearchPrompt(query, site);
  const response = await fetchImpl(`${DESEARCH_BASE_URL}/desearch/ai/search/links/web`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, tools: ['web'], count: clampCount(count) }),
  });

  const body = await readResponseBody(response);
  if (!response.ok) {
    const message = typeof body === 'string' ? body : body?.detail || body?.message || JSON.stringify(body);
    const error = new Error(`Desearch web search failed: ${response.status} ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return {
    body,
    prompt,
    billing: getBillingHeaders(response),
  };
}

export async function callDesearchCrawl({ url, apiKey, renderJs = false, fetchImpl = fetch }) {
  const endpoint = new URL(`${DESEARCH_BASE_URL}/web/crawl`);
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('format', 'text');
  endpoint.searchParams.set('js', renderJs ? 'true' : 'false');
  if (renderJs) endpoint.searchParams.set('wait', '3000');

  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: { Authorization: apiKey },
  });
  const body = await readResponseBody(response);
  if (!response.ok) {
    const message = typeof body === 'string' ? body : body?.detail || body?.message || JSON.stringify(body);
    const error = new Error(`Desearch crawl failed: ${response.status} ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return {
    text: typeof body === 'string' ? body : JSON.stringify(body),
    billing: getBillingHeaders(response),
  };
}

export async function runEbayPriceSearch({
  query,
  site = 'ebay.com',
  count = 20,
  crawlLimit = 5,
  renderJs = false,
  apiKey,
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    const error = new Error('Missing Desearch API key. Set DESEARCH_API_KEY on the server or provide one in the app.');
    error.status = 400;
    throw error;
  }
  if (!String(query || '').trim()) {
    const error = new Error('Query is required.');
    error.status = 400;
    throw error;
  }

  const search = await callDesearchWebSearch({ query, site, count, apiKey, fetchImpl });
  const flattened = flattenWebSearchResults(search.body);
  const filtered = filterResultsBySite(flattened, site);
  const deduped = dedupeResults(filtered.length ? filtered : flattened);
  const limitedCrawl = Math.max(0, Math.min(Number.parseInt(crawlLimit, 10) || 0, deduped.length));

  const crawlBillings = [];
  const listings = [];
  for (let index = 0; index < deduped.length; index += 1) {
    const result = deduped[index];
    let crawlText = '';
    if (index < limitedCrawl) {
      try {
        const crawl = await callDesearchCrawl({ url: result.link, apiKey, renderJs, fetchImpl });
        crawlText = crawl.text;
        crawlBillings.push({ url: result.link, billing: crawl.billing, ok: true });
      } catch (error) {
        crawlBillings.push({ url: result.link, ok: false, error: error.message, status: error.status || 500 });
      }
    }
    listings.push(extractListingDetails(result, crawlText));
  }

  return {
    query,
    site: normalizeSite(site),
    searchPrompt: search.prompt,
    count: clampCount(count),
    crawled: limitedCrawl,
    summary: summarizeListings(listings),
    listings,
    billing: {
      search: search.billing,
      crawls: crawlBillings,
    },
  };
}
