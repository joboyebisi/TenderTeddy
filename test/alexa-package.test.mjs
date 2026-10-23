import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageRoot = new URL('../alexa/addon-package/', import.meta.url);

test('Alexa+ add-on manifest satisfies listing and MCP integration constraints', async () => {
  const manifest = JSON.parse(await readFile(new URL('addon.json', packageRoot), 'utf8'));
  assert.equal(manifest.manifestVersion, '1.0');
  assert.deepEqual(manifest.storeListing.distributionCountries, ['GB', 'US']);
  for (const listing of Object.values(manifest.storeListing.locales)) {
    assert.ok(listing.name.value.length <= 30);
    assert.ok(listing.shortDescription.length <= 123);
    assert.ok(listing.fullDescription.length <= 4000);
    assert.ok(listing.examplePhrases.length >= 3 && listing.examplePhrases.length <= 4);
    assert.equal(listing.mediaAssets.icons.light.length, 6);
    assert.equal(listing.mediaAssets.carouselImages[0].size, '600x900');
    assert.ok(listing.mediaAssets.carouselImages[0].altText.length <= 250);
  }
  assert.equal(manifest.integrations[0].type, 'MCP');
  assert.match(manifest.integrations[0].config.endpoints.default.uri, /^https:\/\/.+\/mcp$/);
});

test('Alexa+ store media files match every declared pixel size', async () => {
  for (const size of [64, 72, 88, 126, 180, 241]) {
    const dimensions = pngDimensions(await readFile(new URL(`media/icon-${size}.png`, packageRoot)));
    assert.deepEqual(dimensions, { width: size, height: size });
  }
  assert.deepEqual(pngDimensions(await readFile(new URL('media/carousel-600x900.png', packageRoot))), { width: 600, height: 900 });
});

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
