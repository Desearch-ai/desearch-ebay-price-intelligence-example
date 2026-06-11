import { runEbayPriceSearch } from '../src/lib.mjs';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Desearch-Api-Key');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const body = typeof request.body === 'object' && request.body !== null ? request.body : await readJsonBody(request);
    const apiKey = process.env.DESEARCH_API_KEY || request.headers['x-desearch-api-key'] || request.headers.authorization;
    const result = await runEbayPriceSearch({
      query: body.query,
      site: body.site || 'ebay.com',
      count: body.count || 20,
      crawlLimit: body.crawlLimit ?? 5,
      renderJs: Boolean(body.renderJs),
      apiKey,
    });

    response.status(200).json(result);
  } catch (error) {
    response.status(error.status || 500).json({
      error: error.message || 'Unexpected error',
      status: error.status || 500,
      details: error.body || null,
    });
  }
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
