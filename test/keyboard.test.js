const { test } = require('node:test');
const assert = require('node:assert/strict');
const { keymap, normalizeKey, isTypingTarget } = require('../app/keyboard');
test('requested controls and Shift/caps variants dispatch the correct remote commands', () => {
    for (const [key, command] of Object.entries({ w:'up', a:'left', s:'down', d:'right', ' ':'select', q:'volume_down', e:'volume_up', r:'menu', f:'home', v:'play_pause' })) {
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

const keyboard = require('../app/keyboard');
test('custom shortcuts persist, replace aliases and resolve independently from the defaults', () => {
    const stored = new Map();
    const storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
    const bindings = keyboard.defaults();
    bindings.up = ['z'];
    bindings.home_hold = ['c'];
    keyboard.save(storage, bindings);
    const reloaded = keyboard.load(storage);
    assert.equal(keyboard.resolve({ key: 'w' }, reloaded), null);
    assert.equal(keyboard.resolve({ key: 'ArrowUp' }, reloaded), null);
    assert.deepEqual(keyboard.resolve({ key: 'Z' }, reloaded), { action: 'up', command: 'up', hold: false });
    assert.deepEqual(keyboard.resolve({ key: 'Z', shiftKey: true }, reloaded), { action: 'up', command: 'up', hold: true });
    assert.deepEqual(keyboard.resolve({ key: 'c' }, reloaded), { action: 'home_hold', command: 'home', hold: true });
    reloaded.up = [];
    assert.equal(keyboard.resolve({ key: 'z' }, reloaded), null);
});
test('duplicate or malformed settings cannot be saved, and corrupt storage recovers defaults', () => {
    const bindings = keyboard.defaults();
    bindings.up = ['q'];
    let writes = 0;
    assert.throws(() => keyboard.save({ setItem() { writes++; } }, bindings), /already assigned/);
    assert.equal(writes, 0);
    bindings.up = ['Tab'];
    assert.throws(() => keyboard.validate(bindings), /Invalid shortcut/);
    for (const raw of ['null', '{', '{"up":["z"]}', '[]']) {
        assert.deepEqual(keyboard.load({ getItem: () => raw }), keyboard.defaults());
    }
    assert.throws(() => keyboard.save({ setItem() { throw new Error('Storage full'); } }, keyboard.defaults()), /Storage full/);
});
test('recording rejects modifier-only, Caps Lock, composition and OS combinations', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Tab']) assert.equal(keyboard.bindingFromEvent({ key }), null);
    for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) assert.equal(keyboard.bindingFromEvent({ key: 'w', [flag]: true }), null);
    assert.equal(keyboard.bindingFromEvent({ key: 'F', shiftKey: true }), 'Shift+f');
    assert.equal(keyboard.bindingFromEvent({ key: ' ' }), 'Space');
    assert.equal(keyboard.bindingFromEvent({ key: '+', shiftKey: true }), 'Shift++');
    assert.equal(keyboard.formatBinding('Shift++'), 'Shift + +');
});
