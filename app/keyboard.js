/** Local remote shortcuts. Global panel shortcuts are configured separately. */
const STORAGE_KEY = 'remote_shortcuts_v1';
const actions = Object.freeze([
    { id: 'up', label: 'Up', keys: ['w', 'ArrowUp'] },
    { id: 'down', label: 'Down', keys: ['s', 'ArrowDown'] },
    { id: 'left', label: 'Left', keys: ['a', 'ArrowLeft'] },
    { id: 'right', label: 'Right', keys: ['d', 'ArrowRight'] },
    { id: 'select', label: 'Select', keys: ['Space', 'Enter'] },
    { id: 'menu', label: 'Back', keys: ['r', 'Backspace', 'Escape'] },
    { id: 'home', label: 'TV', keys: ['f', 't'] },
    { id: 'home_hold', label: 'Control Center', keys: ['Shift+f', 'Shift+t', 'l'] },
    { id: 'play_pause', label: 'Play / pause', keys: ['v', 'p', 'Pause'] },
    { id: 'volume_up', label: 'Volume up', keys: ['e', '+', '='] },
    { id: 'volume_down', label: 'Volume down', keys: ['q', '-', '_'] },
    { id: 'skip_backward', label: 'Skip backward', keys: ['[', 'Previous'] },
    { id: 'skip_forward', label: 'Skip forward', keys: [']', 'Next'] },
    { id: 'top_menu', label: 'Top menu', keys: ['g'] },
    { id: 'keyboard', label: 'Open keyboard', keys: ['k'] },
    { id: 'hide', label: 'Hide remote', keys: ['h'] }
]);
const specialKeys = new Set(['Space', 'Enter', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Pause', 'Previous', 'Next', ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)]);
function normalizeKey(key) {
    if (key === ' ') return 'Space';
    return key.length === 1 ? key.toLowerCase() : key;
}
function defaults() { return Object.fromEntries(actions.map(action => [action.id, [...action.keys]])); }
function validBinding(binding) {
    if (typeof binding !== 'string') return false;
    const key = binding.startsWith('Shift+') ? binding.slice(6) : binding;
    return (key.length === 1 && !/\s/.test(key) && key === normalizeKey(key)) || specialKeys.has(key);
}
function validate(bindings) {
    const used = new Map();
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new Error('Invalid shortcut settings.');
    for (const action of actions) {
        const keys = bindings[action.id];
        if (!Array.isArray(keys) || keys.length > 12 || keys.some(key => !validBinding(key))) throw new Error(`Invalid shortcut for ${action.label}.`);
        for (const key of keys) {
            if (used.has(key)) throw new Error(`${formatBinding(key)} is already assigned to ${used.get(key)}.`);
            used.set(key, action.label);
        }
    }
    return Object.fromEntries(actions.map(action => [action.id, [...bindings[action.id]]]));
}
function load(storage) {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        return raw ? validate(JSON.parse(raw)) : defaults();
    } catch (_) { return defaults(); }
}
function save(storage, bindings) {
    const validated = validate(bindings);
    storage.setItem(STORAGE_KEY, JSON.stringify(validated));
    return validated;
}
function bindingFromEvent(event) {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || typeof event.key !== 'string') return null;
    const key = normalizeKey(event.key);
    if (!validBinding(key)) return null;
    return (event.shiftKey ? 'Shift+' : '') + key;
}
function resolve(event, bindings) {
    const binding = bindingFromEvent(event);
    if (!binding) return null;
    const find = key => actions.find(action => bindings[action.id].includes(key));
    const exact = find(binding);
    const action = exact || (event.shiftKey && find(normalizeKey(event.key)));
    if (!action) return null;
    return { action: action.id, command: action.id === 'home_hold' ? 'home' : action.id,
        hold: action.id === 'home_hold' || (!exact && event.shiftKey && !['keyboard', 'hide'].includes(action.id)) };
}
function formatBinding(binding) {
    const shifted = binding.startsWith('Shift+');
    const key = shifted ? binding.slice(6) : binding;
    const labels = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Backspace: '⌫' };
    return (shifted ? 'Shift + ' : '') + (labels[key] || (key.length === 1 ? key.toUpperCase() : key));
}
function isTypingTarget(target) {
    return Boolean(target && (target.isContentEditable || target.closest?.(
        'input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="combobox"]'
    )));
}
// Retained for compatibility with modules/tests using the original default map.
const keymap = Object.freeze(Object.fromEntries(actions.filter(a => !['keyboard', 'hide'].includes(a.id)).flatMap(a => a.keys.filter(k => !k.startsWith('Shift+')).map(k => [k, a.id]))));
module.exports = { actions, defaults, validate, load, save, resolve, bindingFromEvent, formatBinding, keymap, normalizeKey, isTypingTarget, STORAGE_KEY };
