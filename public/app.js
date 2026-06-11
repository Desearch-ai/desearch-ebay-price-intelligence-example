const form = document.querySelector('#search-form');
const statusEl = document.querySelector('#status');
const resultsEl = document.querySelector('#results');
const summaryEl = document.querySelector('#summary');
const listingGrid = document.querySelector('#listing-grid');
const promptEl = document.querySelector('#prompt');
const downloadButton = document.querySelector('#download');
const keyInput = document.querySelector('#apiKey');
const submitButton = document.querySelector('#submit-button');
const queryInput = document.querySelector('#query');
const loaderEl = document.querySelector('#loader');
const loaderTitle = document.querySelector('#loader-title');
const loaderDetail = document.querySelector('#loader-detail');
const loaderBar = document.querySelector('#loader-bar');
const stageEls = [...document.querySelectorAll('.stage')];
const presetButtons = [...document.querySelectorAll('[data-preset]')];

let lastResult = null;
let loaderTimers = [];

const loaderSteps = [
  {
    title: 'Searching eBay with Web Search',
    detail: 'Keeping the query as a real SERP query so site:ebay.com stays intact.',
    progress: '18%',
  },
  {
    title: 'Cleaning and deduping result links',
    detail: 'Removing tracking parameters and keeping public eBay URLs.',
    progress: '44%',
  },
  {
    title: 'Crawling selected listings',
    detail: 'Fetching page text from the highest-value links first.',
    progress: '72%',
  },
  {
    title: 'Extracting price intelligence',
    detail: 'Parsing price, shipping, condition, seller rating, and totals.',
    progress: '92%',
  },
];

const savedKey = localStorage.getItem('desearch_api_key');
if (savedKey) keyInput.value = savedKey;

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    queryInput.value = button.dataset.preset;
    queryInput.focus();
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const apiKey = keyInput.value.trim();
  if (apiKey) localStorage.setItem('desearch_api_key', apiKey);

  setBusy(true);
  setStatus('Running live Desearch pipeline...', '');
  resultsEl.classList.add('hidden');
  startLoader();

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Desearch-Api-Key': apiKey } : {}),
      },
      body: JSON.stringify({
        query: data.query,
        site: data.site,
        count: Number(data.count),
        crawlLimit: Number(data.crawlLimit),
        renderJs: Boolean(data.renderJs),
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed with ${response.status}`);

    setLoaderStep(3);
    await delay(250);
    lastResult = result;
    renderResult(result);
    setStatus(`Done. ${result.summary.totalFound} URLs found, ${result.summary.pricedCount} with price signals.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
    loaderTitle.textContent = 'Something blocked the run';
    loaderDetail.textContent = 'Check the API key, query, or Desearch response details, then try again.';
    loaderBar.style.width = '100%';
    loaderEl.classList.add('error');
  } finally {
    clearLoaderTimers();
    setBusy(false);
  }
});

downloadButton.addEventListener('click', () => {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'desearch-ebay-price-results.json';
  a.click();
  URL.revokeObjectURL(url);
});

function startLoader() {
  clearLoaderTimers();
  loaderEl.classList.remove('hidden', 'error');
  setLoaderStep(0);
  loaderEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  loaderTimers = [
    setTimeout(() => setLoaderStep(1), 650),
    setTimeout(() => setLoaderStep(2), 1400),
    setTimeout(() => setLoaderStep(3), 2300),
  ];
}

function clearLoaderTimers() {
  loaderTimers.forEach((timer) => clearTimeout(timer));
  loaderTimers = [];
}

function setLoaderStep(index) {
  const step = loaderSteps[index] || loaderSteps[0];
  loaderTitle.textContent = step.title;
  loaderDetail.innerHTML = escapeHtml(step.detail).replace('site:ebay.com', '<code>site:ebay.com</code>');
  loaderBar.style.width = step.progress;
  stageEls.forEach((stage, stageIndex) => {
    stage.classList.toggle('active', stageIndex === index);
    stage.classList.toggle('done', stageIndex < index);
  });
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  submitButton.innerHTML = isBusy
    ? '<span class="spinner"></span> Running...'
    : '<span class="button-icon">↗</span> Run search';
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type || ''}`.trim();
}

function renderResult(result) {
  const sortedListings = [...result.listings].sort((a, b) => {
    const ap = Number.isFinite(Number(a.totalPrice)) ? Number(a.totalPrice) : Number.POSITIVE_INFINITY;
    const bp = Number.isFinite(Number(b.totalPrice)) ? Number(b.totalPrice) : Number.POSITIVE_INFINITY;
    return ap - bp;
  });

  resultsEl.classList.remove('hidden');
  promptEl.textContent = result.searchPrompt;
  summaryEl.innerHTML = '';
  listingGrid.innerHTML = '';

  const best = result.summary.lowest;
  const metrics = [
    { label: 'Public URLs', value: result.summary.totalFound, tone: 'neutral' },
    { label: 'Priced listings', value: result.summary.pricedCount, tone: 'neutral' },
    { label: 'Lowest total', value: money(best?.totalPrice), tone: 'win' },
    { label: 'Median', value: money(result.summary.medianPrice), tone: 'neutral' },
    { label: 'Average', value: money(result.summary.averagePrice), tone: 'neutral' },
  ];

  for (const metric of metrics) {
    const card = document.createElement('div');
    card.className = `metric ${metric.tone}`;
    card.innerHTML = `<span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(String(metric.value ?? '—'))}</strong>`;
    summaryEl.appendChild(card);
  }

  if (best) {
    const bestCard = document.createElement('article');
    bestCard.className = 'listing-card best-card';
    bestCard.innerHTML = `
      <div class="card-topline"><span>Best detected deal</span><strong>${money(best.totalPrice)}</strong></div>
      <a href="${escapeAttr(best.link)}" target="_blank" rel="noreferrer">${escapeHtml(best.title)}</a>
      <p>${escapeHtml(truncate(best.snippet || best.crawlPreview || '', 190))}</p>
      <div class="card-tags">
        ${tag(best.condition || 'Condition unknown')}
        ${tag(best.sellerRating ? `${best.sellerRating} seller` : 'Seller unknown')}
        ${tag(best.crawled ? 'Crawled' : 'Search result')}
      </div>
    `;
    listingGrid.appendChild(bestCard);
  }

  for (const [index, listing] of sortedListings.entries()) {
    const card = document.createElement('article');
    card.className = 'listing-card';
    card.innerHTML = `
      <div class="card-topline"><span>#${index + 1}</span><strong>${money(listing.totalPrice)}</strong></div>
      <a href="${escapeAttr(listing.link)}" target="_blank" rel="noreferrer">${escapeHtml(listing.title)}</a>
      <p>${escapeHtml(truncate(listing.snippet || listing.crawlPreview || '', 170))}</p>
      <div class="price-row">
        <span>Price ${money(listing.price)}</span>
        <span>Shipping ${listing.shipping === 0 ? 'Free' : money(listing.shipping)}</span>
      </div>
      <div class="card-tags">
        ${tag(listing.condition || 'Condition unknown')}
        ${tag(listing.sellerRating ? `${listing.sellerRating} seller` : 'Seller unknown')}
        ${tag(listing.crawled ? 'Crawled' : 'SERP only')}
      </div>
    `;
    listingGrid.appendChild(card);
  }

  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function tag(value) {
  return `<span class="tag">${escapeHtml(value)}</span>`;
}

function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function truncate(value, length) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
