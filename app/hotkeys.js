const defaultHotkeys = Object.freeze([
    'CommandOrControl+Shift+Space', 'Super+Shift+R', 'Command+Control+R'
]);

/** Check each registration: OS conflicts return false; invalid accelerators throw. */
function registerShowShortcuts(shortcuts, custom, callback) {
    const requested = [...new Set(custom.split(',').map(key => key.trim()).filter(Boolean))];
    const registered = [], failed = [];
    function register(keys) {
        for (const key of keys) {
            try {
                if (shortcuts.register(key, callback)) {
                    registered.push(key);
                    continue;
                }
            } catch (_) { /* Report malformed accelerators alongside conflicts. */ }
            failed.push(key);
        }
    }
    register(requested.length ? requested : defaultHotkeys);
    if (requested.length && !registered.length) register(defaultHotkeys.filter(key => !requested.includes(key)));
    return { registered, failed };
}

module.exports = { defaultHotkeys, registerShowShortcuts };
