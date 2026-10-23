import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAccessTokenClaims } from '../src/aws-handler.mjs';

const audience = 'https://api.wanderwrap.test/mcp';

test('AWS access-token claims are bound to the MCP audience and required scope', () => {
  const scopes = validateAccessTokenClaims({ aud: audience, scope: 'openid wanderwrap/gifts.read wanderwrap/gifts.write' }, {
    audience,
    requiredScope: 'wanderwrap/gifts.write'
  });
  assert.equal(scopes.has('wanderwrap/gifts.read'), true);
});

test('AWS access-token claims reject the wrong resource audience', () => {
  assert.throws(() => validateAccessTokenClaims({ aud: 'https://evil.example/mcp', scope: 'wanderwrap/gifts.read' }, {
    audience,
    requiredScope: 'wanderwrap/gifts.read'
  }), /audience/);
});

test('AWS access-token claims reject missing write scope', () => {
  assert.throws(() => validateAccessTokenClaims({ aud: audience, scope: 'wanderwrap/gifts.read' }, {
    audience,
    requiredScope: 'wanderwrap/gifts.write'
  }), /Missing required scope/);
});
