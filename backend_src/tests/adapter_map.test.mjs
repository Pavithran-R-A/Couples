// BackendAdapter → Appwrite action contract: every mapped Function action
// must still exist in the Function source, and the review-mandated gap
// actions must be present. Compile-time exhaustiveness (every keyof
// BackendAdapter mapped) is enforced by services/AppwriteActionMap.ts via
// tsc; this test covers the runtime side.
import assert from 'node:assert/strict';

// The Function module fail-closes without its env; provide test values
// before importing it (same placeholders as the couples-api suite).
process.env.APPWRITE_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
process.env.APPWRITE_API_KEY = 'test-server-key';
process.env.APPWRITE_FUNCTION_PROJECT_ID = 'test-project';
process.env.APPWRITE_CODE_PEPPER = 'test-pepper-0123456789abcdef';

const { APPWRITE_ACTION_MAP } = await import('../../services/AppwriteActionMap.ts');
const { ACTION_NAMES } = await import('../../functions/couples-api/src/main.js');

const mappedActions = new Set();
for (const [method, mapping] of Object.entries(APPWRITE_ACTION_MAP)) {
  assert.ok(mapping && typeof mapping === 'object', `mapping for ${method} must be an object`);
  assert.ok(typeof mapping.note === 'string', `mapping for ${method} must carry a note`);
  if (mapping.action) {
    for (const action of mapping.action.split(' + ')) {
      assert.ok(
        ACTION_NAMES.includes(action),
        `BackendAdapter.${method} maps to Function action "${action}" which no longer exists (have: ${ACTION_NAMES.join(', ')})`
      );
      mappedActions.add(action);
    }
  } else {
    assert.ok(mapping.sdk, `BackendAdapter.${method} must map to either a Function action or an SDK operation`);
  }
}

// Sixth-review minimum gap-closure set.
for (const required of ['partner.get', 'partner.unlink', 'letter.history', 'reaction.list', 'note.markRead', 'stats.get']) {
  assert.ok(mappedActions.has(required), `required gap action "${required}" is not mapped to any adapter method`);
}

console.log(`adapter map OK: ${Object.keys(APPWRITE_ACTION_MAP).length} methods mapped, ${mappedActions.size} Function actions referenced, ${ACTION_NAMES.length} actions implemented`);
