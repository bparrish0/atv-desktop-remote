// Real menubar/main-process regression test; isolated profile and mocked ATV I/O.
const { app, BrowserWindow, globalShortcut, session } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'atv-focus-qa-'));
app.setPath('userData', profile);
process.chdir(path.join(repo, 'app'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const callbacks = new Map();
const originalRegister = globalShortcut.register.bind(globalShortcut);
globalShortcut.register = (key, callback) => {
    callbacks.set(key, callback);
    return originalRegister(key, callback);
};
const watchdog = setTimeout(() => { console.error('Focus test timed out'); app.exit(1); }, 20000);
app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest((details, done) => done({
        cancel: details.url.endsWith('/web_remote.js') || /^https?:/.test(details.url)
    }));
});
require('../app/main');
app.whenReady().then(async () => {
    while (!global.MB?.window || !global.MB.window.webContents || global.MB.window.webContents.isLoading()) await delay(25);
    // menubar's ready listener creates the input window and wires IPC.
    await delay(150);
    const mb = global.MB;
    const win = mb.window;
    await win.webContents.executeJavaScript(`
        const device = require('./device');
        device.isConnected = () => true;
        window.sent = [];
        device.sendKey = async key => sent.push(key);
        require('./events').init();
        require('./views').showView(require('./state').States.CONNECTED);
    `);
    const otherWindow = new BrowserWindow({ width: 200, height: 100 });
    await otherWindow.loadURL('data:text/html,<title>Focus test</title>Other window');
    otherWindow.show();
    otherWindow.focus();
    await delay(150);
    assert.ok(otherWindow.isFocused(), 'Native focus testing requires an unlocked, active desktop session');
    // Actual menubar click handler: no direct call to the app's show helper.
    for (let attempt = 0; attempt < 3; attempt++) {
        mb.hideWindow();
        otherWindow.show();
        otherWindow.focus();
        await delay(150);
        mb.tray.emit('click', {}, mb.tray.getBounds());
        await delay(150);
        assert.ok(win.isFocused(), 'tray click must focus the native window');
        assert.ok(win.webContents.isFocused(), 'tray click must focus web contents');
        assert.equal(await win.webContents.executeJavaScript('document.activeElement.className'), 'siri-remote');
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W' });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'W' });
        await delay(30);
        await win.webContents.executeJavaScript(`document.querySelector('#exitLink').focus()`);
    }
    assert.deepEqual(await win.webContents.executeJavaScript('sent'), ['up', 'up', 'up']);
    const shortcut = 'CommandOrControl+Shift+Space';
    assert.ok(globalShortcut.isRegistered(shortcut), 'new global hotkey must register with the OS');
    // Exercise the registered callback and the real main-process show/hide paths.
    mb.hideWindow();
    callbacks.get(shortcut)();
    await delay(200);
    assert.ok(win.isVisible() && win.isFocused());
    callbacks.get(shortcut)();
    await delay(150);
    assert.equal(win.isVisible(), false);
    callbacks.get(shortcut)();
    await delay(200);
    assert.ok(win.isVisible() && win.isFocused());
    assert.equal(await win.webContents.executeJavaScript('document.activeElement.className'), 'siri-remote');
    // When pinned but unfocused, the shortcut should focus instead of hiding it.
    win.setAlwaysOnTop(true);
    otherWindow.show();
    otherWindow.focus();
    await delay(150);
    assert.ok(win.isVisible() && !win.isFocused());
    callbacks.get(shortcut)();
    await delay(150);
    assert.ok(win.isVisible() && win.isFocused());
    await win.webContents.executeJavaScript(`require('./views').showView(require('./state').States.PAIRING_1); document.querySelector('#pairCode').value = '1234';`);
    mb.hideWindow();
    await delay(150);
    mb.tray.emit('click', {}, mb.tray.getBounds());
    await delay(150);
    assert.deepEqual(await win.webContents.executeJavaScript(`({ id: document.activeElement.id, code: document.querySelector('#pairCode').value })`), { id: 'pairCode', code: '1234' });
    console.log(JSON.stringify({ checks: 'three tray reopens with native keyboard commands; OS shortcut registration; shortcut callback open/hide/reopen; pinned unfocused panel activation; pairing focus and value' }));
    clearTimeout(watchdog);
    globalShortcut.unregisterAll();
    app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
