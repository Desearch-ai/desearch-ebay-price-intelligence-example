import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runEbayPriceSearch } from './src/lib.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const port = Number.parseInt(process.env.PORT || '3000', 10);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/search') {
      await handleSearch(request, response);
      return;
    }

    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const safePath = normalize(requested).replace(/^\.\.(?:\/|$)/, '');
    const filePath = join(publicDir, safePath);
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error.code === 'ENOENT' ? 'Not found' : error.stack);
  }
}).listen(port, () => {
  console.log(`Desearch eBay price app running at http://localhost:${port}`);
});

async function handleSearch(request, response) {
  if (request.method !== 'POST') {
    response.writeHead(405, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    return;
  }

  try {
    const body = await readJson(request);
    const apiKey = process.env.DESEARCH_API_KEY || request.headers['x-desearch-api-key'] || request.headers.authorization;
    const result = await runEbayPriceSearch({
      query: body.query,
      site: body.site || 'ebay.com',
      count: body.count || 20,
      crawlLimit: body.crawlLimit ?? 5,
      renderJs: Boolean(body.renderJs),
      apiKey,
    });
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(error.status || 500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message, status: error.status || 500, details: error.body || null }));
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
