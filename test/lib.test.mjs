import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildWebSearchPrompt,
  clampCount,
  dedupeResults,
  extractListingDetails,
  extractMoney,
  flattenWebSearchResults,
  normalizeSite,
  summarizeListings,
} from '../src/lib.mjs';

describe('Desearch eBay app core helpers', () => {
  it('builds a web-search prompt that preserves site: operators', () => {
    assert.equal(
      buildWebSearchPrompt('iPhone 15 Pro Max 256GB unlocked', 'ebay.com'),
      'site:ebay.com iPhone 15 Pro Max 256GB unlocked'
    );
  });

  it('normalizes site values without stripping eBay paths', () => {
    assert.equal(normalizeSite('https://www.ebay.com/sch/i.html'), 'ebay.com/sch/i.html');
    assert.equal(normalizeSite('ebay.com'), 'ebay.com');
  });

  it('clamps Desearch web-search count to the documented 10..200 range', () => {
    assert.equal(clampCount(1), 10);
    assert.equal(clampCount(40), 40);
    assert.equal(clampCount(500), 200);
  });

  it('flattens Desearch web search response groups', () => {
    const response = {
      search_results: [
        { title: 'A', snippet: 'one', link: 'https://www.ebay.com/itm/1' },
      ],
      reddit_search_results: null,
      youtube_search_results: [
        { title: 'Video', snippet: 'ignore but valid', link: 'https://youtube.com/watch?v=1' },
      ],
    };

    assert.deepEqual(flattenWebSearchResults(response).map((r) => r.link), [
      'https://www.ebay.com/itm/1',
      'https://youtube.com/watch?v=1',
    ]);
  });

  it('dedupes repeated links and keeps first source metadata', () => {
    const deduped = dedupeResults([
      { title: 'A', snippet: 'one', link: 'https://www.ebay.com/itm/1?mkcid=1', source: 'search_results' },
      { title: 'A2', snippet: 'two', link: 'https://www.ebay.com/itm/1', source: 'search_results' },
    ]);

    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].title, 'A');
  });

  it('extracts eBay-style money strings', () => {
    assert.deepEqual(extractMoney('Apple iPhone - US $1,299.00 + $12.50 shipping'), [1299, 12.5]);
  });

  it('extracts listing detail from search text plus crawl text', () => {
    const listing = extractListingDetails(
      {
        title: 'Apple iPhone 15 Pro Max 256GB Unlocked - Used',
        snippet: 'US $799.99. Free shipping. Seller 99.2% positive feedback.',
        link: 'https://www.ebay.com/itm/123',
      },
      'Condition: Used\nLocated in: New York, United States\nSeller: phone_shop (99.2% positive feedback)'
    );

    assert.equal(listing.price, 799.99);
    assert.equal(listing.shipping, 0);
    assert.equal(listing.totalPrice, 799.99);
    assert.equal(listing.condition, 'Used');
    assert.equal(listing.sellerRating, '99.2%');
  });

  it('summarizes parsed listing prices', () => {
    const summary = summarizeListings([
      { title: 'A', totalPrice: 100, price: 100, link: 'a' },
      { title: 'B', totalPrice: 80, price: 80, link: 'b' },
      { title: 'C', totalPrice: 120, price: 120, link: 'c' },
    ]);

    assert.equal(summary.totalFound, 3);
    assert.equal(summary.lowest.totalPrice, 80);
    assert.equal(summary.medianPrice, 100);
    assert.equal(summary.averagePrice, 100);
  });
});
