const keyboard = require('./keyboard');
let dialog, bindings, draft, onChange;
let recording = null;

function init(changed) {
    dialog = document.querySelector('#shortcutSettings');
    onChange = changed;
    bindings = keyboard.load(localStorage);
    document.querySelector('#settingsButton').addEventListener('click', open);
    document.querySelector('#cancelShortcuts').addEventListener('click', () => dialog.close());
    document.querySelector('#resetShortcuts').addEventListener('click', () => {
        draft = keyboard.defaults(); recording = null; render(); message('Defaults restored. Save to apply.');
    });
    document.querySelector('#saveShortcuts').addEventListener('click', () => {
        try {
            bindings = keyboard.save(localStorage, draft);
            onChange();
            dialog.close();
        } catch (error) { message(error.message); }
    });
    dialog.addEventListener('close', () => {
        recording = null;
        document.querySelector('#settingsButton').setAttribute('aria-expanded', 'false');
        // Return to the remote so its shortcuts work immediately after saving.
        require('./views').focusControls();
    });
    dialog.addEventListener('keydown', event => {
        // Never send remote commands while a shortcut is being edited.
        event.stopPropagation();
        if (event.key === 'Tab') return;
        if (event.key === 'Escape' && !recording) return; // Native dialog dismissal.
        if (!recording) return;
        event.preventDefault();
        const binding = keyboard.bindingFromEvent(event);
        if (!binding) { message('Use one key, optionally with Shift. Command, Control and Option are reserved.'); return; }
        const conflict = keyboard.actions.find(action => action.id !== recording && draft[action.id].includes(binding));
        if (conflict) { message(`${keyboard.formatBinding(binding)} is already assigned to ${conflict.label}. Clear it there first.`); return; }
        draft[recording] = [binding];
        const input = document.querySelector(`[data-shortcut="${recording}"]`);
        recording = null;
        render();
        input.focus();
        // Keep the field focused without continuing to record accidentally.
        recording = null;
        message('Shortcut updated. Save to apply.');
    });
    dialog.addEventListener('click', event => {
        const bounds = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
}
function message(text) { document.querySelector('#shortcutMessage').textContent = text; }
function isOpen() { return Boolean(dialog?.open); }
function getBindings() { return bindings; }
function open() {
    draft = structuredClone(bindings);
    recording = null;
    render(); message('');
    dialog.showModal();
    document.querySelector('#settingsButton').setAttribute('aria-expanded', 'true');
    document.querySelector('#cancelShortcuts').focus();
    document.querySelector('#shortcutRows').scrollTop = 0;
}
function render() {
    const rows = document.querySelector('#shortcutRows');
    // Build once so recording updates do not remove the focused input.
    if (!rows.children.length) {
        for (const action of keyboard.actions) {
            const row = document.createElement('div'); row.className = 'shortcut-row';
            const label = document.createElement('label'); label.textContent = action.label; label.htmlFor = `shortcut-${action.id}`;
            const input = document.createElement('input');
            input.id = label.htmlFor; input.dataset.shortcut = action.id; input.readOnly = true;
            input.setAttribute('aria-label', `${action.label} shortcut. Press a key to replace.`);
            const record = () => { recording = action.id; input.value = 'Press a key…'; message(`Set ${action.label}: press a key, optionally with Shift.`); };
            input.addEventListener('focus', record);
            input.addEventListener('click', record);
            input.addEventListener('blur', () => { recording = null; render(); });
            const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'clear-shortcut'; clear.textContent = '×'; clear.setAttribute('aria-label', `Clear ${action.label} shortcut`);
            clear.addEventListener('click', () => { draft[action.id] = []; recording = null; render(); message('Shortcut cleared. Save to apply.'); });
            row.append(label, input, clear); rows.append(row);
        }
    }
    for (const action of keyboard.actions) {
        const input = rows.querySelector(`[data-shortcut="${action.id}"]`);
        input.value = draft[action.id].map(keyboard.formatBinding).join(', ') || 'Unassigned';
        input.title = input.value;
    }
}
module.exports = { init, open, isOpen, getBindings };
