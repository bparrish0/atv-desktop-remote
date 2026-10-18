const { test } = require('node:test');
const assert = require('node:assert/strict');
const { keymap, normalizeKey, isTypingTarget } = require('../app/keyboard');
test('requested controls and Shift/caps variants dispatch the correct remote commands', () => {
    for (const [key, command] of Object.entries({ w:'up', a:'left', s:'down', d:'right', ' ':'select', q:'volume_down', e:'volume_up', r:'menu', f:'home' })) {
        assert.equal(keymap[normalizeKey(key)], command);
        assert.equal(keymap[normalizeKey(key.toUpperCase())], command);
    }
    assert.equal(keymap.Enter, 'select');
    assert.equal(keymap.ArrowUp, 'up');
    assert.equal(keymap.p, 'play_pause');
    assert.equal(keymap.Pause, 'play_pause');
});
test('typing and native button activation are excluded from remote shortcuts', () => {
    assert.equal(isTypingTarget(null), false);
    assert.equal(isTypingTarget({ isContentEditable: true }), true);
    assert.equal(isTypingTarget({ closest: () => ({}) }), true);
    assert.equal(isTypingTarget({ closest: () => null }), false);
});
