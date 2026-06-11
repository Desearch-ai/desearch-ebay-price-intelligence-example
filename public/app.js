const form = document.querySelector('#search-form');
const statusEl = document.querySelector('#status');
const resultsEl = document.querySelector('#results');
const summaryEl = document.querySelector('#summary');
const listingBody = document.querySelector('#listing-body');
const promptEl = document.querySelector('#prompt');
const downloadButton = document.querySelector('#download');
const keyInput = document.querySelector('#apiKey');

let lastResult = null;

const savedKey = localStorage.getItem('desearch_api_key');
if (savedKey) keyInput.value = savedKey;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const apiKey = keyInput.value.trim();
  if (apiKey) localStorage.setItem('desearch_api_key', apiKey);

  setStatus('Running Desearch web search with site: operator, then crawling selected listings...', '');
  resultsEl.classList.add('hidden');

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
    lastResult = result;
    renderResult(result);
    setStatus(`Done. Found ${result.summary.totalFound} links; parsed prices from ${result.summary.pricedCount}.`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
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

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type || ''}`.trim();
}

function renderResult(result) {
  resultsEl.classList.remove('hidden');
  promptEl.textContent = result.searchPrompt;
  summaryEl.innerHTML = '';

  const metrics = [
    ['Found', result.summary.totalFound],
    ['Priced', result.summary.pricedCount],
    ['Lowest', money(result.summary.lowest?.totalPrice)],
    ['Median', money(result.summary.medianPrice)],
    ['Average', money(result.summary.averagePrice)],
  ];

  for (const [label, value] of metrics) {
    const card = document.createElement('div');
    card.className = 'metric';
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? '—'))}</strong>`;
    summaryEl.appendChild(card);
  }

  listingBody.innerHTML = '';
  for (const listing of result.listings) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <a href="${escapeAttr(listing.link)}" target="_blank" rel="noreferrer">${escapeHtml(listing.title)}</a>
        <div class="small">${escapeHtml(truncate(listing.snippet || listing.crawlPreview || '', 150))}</div>
      </td>
      <td>${money(listing.price)}</td>
      <td>${listing.shipping === 0 ? 'Free' : money(listing.shipping)}</td>
      <td><strong>${money(listing.totalPrice)}</strong></td>
      <td>${escapeHtml(listing.condition || '—')}</td>
      <td>${escapeHtml(listing.sellerRating || '—')}</td>
      <td>${listing.crawled ? '<span class="badge">yes</span>' : '—'}</td>
    `;
    listingBody.appendChild(row);
  }

  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function truncate(value, length) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
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
