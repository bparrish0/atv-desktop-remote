/** Shared keyboard mapping. Text fields always keep normal typing behavior. */
const keymap = Object.freeze({
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right',
    Space: 'select', Enter: 'select',
    q: 'volume_down', e: 'volume_up', r: 'menu', f: 'home',
    t: 'home', l: 'home_hold', Backspace: 'menu', Escape: 'menu',
    v: 'play_pause', p: 'play_pause', Pause: 'play_pause',
    Previous: 'skip_backward', Next: 'skip_forward',
    '[': 'skip_backward', ']': 'skip_forward', g: 'top_menu',
    '+': 'volume_up', '=': 'volume_up', '-': 'volume_down', '_': 'volume_down'
});

function normalizeKey(key) {
    if (key === ' ') return 'Space';
    return key.length === 1 ? key.toLowerCase() : key;
}

function isTypingTarget(target) {
    return Boolean(target && (target.isContentEditable || target.closest?.(
        'input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="combobox"]'
    )));
}

module.exports = { keymap, normalizeKey, isTypingTarget };
