const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaultHotkeys, registerShowShortcuts } = require('../app/hotkeys');

test('new default and legacy global shortcuts share the panel callback', () => {
    const callbacks = new Map();
    let opened = 0;
    const result = registerShowShortcuts({ register(key, fn) { callbacks.set(key, fn); return true; } }, '', () => opened++);
    assert.equal(defaultHotkeys[0], 'CommandOrControl+Shift+Space');
    assert.deepEqual(result, { registered: [...defaultHotkeys], failed: [] });
    callbacks.forEach(fn => fn());
    assert.equal(opened, 3);
});

test('custom combinations are trimmed and deduplicated, without overriding working choices', () => {
    const keys = [];
    const result = registerShowShortcuts({ register(key) { keys.push(key); return true; } }, ' Command+K, ,Command+K, Control+J ', () => {});
    assert.deepEqual(keys, ['Command+K', 'Control+J']);
    assert.deepEqual(result.registered, keys);
});

test('conflicts and malformed accelerators are reported and defaults recover', () => {
    const result = registerShowShortcuts({ register(key) {
        if (key === 'malformed') throw new Error('invalid accelerator');
        return key !== 'Command+K';
    } }, 'Command+K, malformed', () => {});
    assert.deepEqual(result.failed, ['Command+K', 'malformed']);
    assert.deepEqual(result.registered, [...defaultHotkeys]);
});

test('a default conflict still leaves the legacy shortcuts available', () => {
    const result = registerShowShortcuts({ register: key => key !== defaultHotkeys[0] }, '', () => {});
    assert.deepEqual(result.failed, [defaultHotkeys[0]]);
    assert.deepEqual(result.registered, defaultHotkeys.slice(1));
});
