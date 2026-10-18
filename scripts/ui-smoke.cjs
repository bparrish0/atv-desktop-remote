const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const repo = process.cwd();
const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'atv-remote-qa-'));
const output = process.env.ATV_QA_OUTPUT || profile;
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', profile);
const watchdog = setTimeout(() => { console.error('UI smoke test timed out'); app.exit(1); }, 30000);
app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 340, height: 690, show: false, webPreferences: { offscreen: true, nodeIntegration: true, contextIsolation: false } });
    win.webContents.session.webRequest.onBeforeRequest((details, done) => done({ cancel: details.url.endsWith('/web_remote.js') || /^https?:/.test(details.url) }));
    await win.loadFile(path.join(repo, 'app/index.html'));
    const results = await win.webContents.executeJavaScript(`(async () => {
        const assert = require('assert/strict');
        const device = require('./device');
        const { States, appState } = require('./state');
        const views = require('./views');
        const events = require('./events');
        const sent = [], ipc = [];
        const creds = { companion: 'test-only', device: { identifier: 'test-only', name: 'Living Room', address: '192.0.2.1' } };
        localStorage.setItem('remote_credentials', JSON.stringify({ 'Living Room': creds }));
        localStorage.setItem('atvcreds', JSON.stringify(creds));
        device.isConnected = () => true;
        device.sendKey = async (key, action) => sent.push({ key, action });
        device.connectWithRetry = async () => {};
        const handlers = {};
        events.init({ ipcRenderer: { on(name, callback) { handlers[name] = callback; }, invoke: async (...args) => { ipc.push(args); } } });
        handlers.mainLog(null, 'Test IPC logging\\n');
        views.init();
        views.showView(States.CONNECTED);
        document.querySelector('#s2style-sheet').href='css/select2.min.css';
        const press = (key, options = {}, target = window) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
        for (const key of ['w', 'a', 's', 'd', ' ', 'q', 'e', 'r', 'f', 'v', 'V', 'p']) press(key);
        assert.deepEqual(sent.map(x => x.key), ['up','left','down','right','select','volume_down','volume_up','menu','home','play_pause','play_pause','play_pause']);
        sent.length = 0;
        // Reopening must leave a remote surface ready, even after a native button
        // (such as Quit) or the device dropdown held focus on the previous open.
        for (const selector of ['#exitLink', '[data-key="select"]', '#remoteDropdown']) {
            document.querySelector(selector).focus();
            handlers.focusRemote();
            assert.equal(document.activeElement, document.querySelector('.siri-remote'));
            press('w', {}, document.activeElement);
        }
        assert.deepEqual(sent.map(x => x.key), ['up', 'up', 'up']);
        sent.length = 0;
        press('F', {shiftKey: true}); press('W', {shiftKey: true});
        assert.deepEqual(sent, [{key:'home',action:'Hold'}, {key:'up',action:'Hold'}]);
        sent.length = 0;
        press('q'); press('q'); press('q');
        assert.equal(sent.length, 3);
        assert.ok(!ipc.some(x => x[0] === 'quit'));
        sent.length = 0;
        for (const key of ['w','q','e','r','f',' ','k','h']) press(key, {}, document.querySelector('#pairCode'));
        press('q', { metaKey: true }); press('w', {ctrlKey: true}); press('f', {altKey: true});
        assert.equal(sent.length, 0);
        // Mouse clicks and native keyboard/assistive activation each send once.
        for (const button of document.querySelectorAll('[data-key]')) {
            button.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,button:0}));
            button.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,button:0}));
        }
        assert.equal(sent.length, 10);
        sent.length = 0;
        document.querySelector('[data-key="select"]').click();
        assert.deepEqual(sent.map(x => x.key), ['select']);
        sent.length = 0;
        const tv = document.querySelector('[data-key="home"]');
        tv.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,button:0}));
        await new Promise(r => setTimeout(r, 1050));
        tv.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,button:0}));
        assert.deepEqual(sent, [{key:'home',action:'Hold'}]);
        press('Alt');
        assert.notEqual(getComputedStyle(document.querySelector('.pad-up .keyTextAlt')).display, 'none');
        window.dispatchEvent(new KeyboardEvent('keyup', {key:'Alt'}));
        assert.equal(getComputedStyle(document.querySelector('.pad-up .keyTextAlt')).display, 'none');
        const bounds = document.querySelector('.siri-remote').getBoundingClientRect();
        assert.ok(bounds.left >= 0 && bounds.right <= innerWidth);
        assert.ok(document.querySelector('footer').getBoundingClientRect().bottom <= innerHeight);
        await new Promise(r => setTimeout(r, 1200));
        return { checks: 'reopen focus from Quit/remote button/dropdown, keyboard dispatch, Q repeat, typing/modifier guards, 10 mouse buttons, native activation, TV long press, Alt hints, window bounds', width: innerWidth, height: innerHeight };
    })()`);
    console.log(JSON.stringify(results));
    await new Promise(r => setTimeout(r, 150));
    fs.writeFileSync(path.join(output, 'remote-light.png'), (await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`document.body.classList.add('darkMode'); document.querySelector('#s2style-sheet').href='css/select2-inverted.css'`);
    await new Promise(r => setTimeout(r, 150));
    fs.writeFileSync(path.join(output, 'remote-dark.png'), (await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript(`const views = require('./views'); views.showView(require('./state').States.PAIRING_1); const input = document.querySelector('#pairCode'); input.value = '1234'; document.querySelector('#exitLink').focus(); views.focusControls(); if (document.activeElement !== input || input.value !== '1234') throw new Error('Pairing focus or code lost'); if (getComputedStyle(input).display === 'none' || input.getBoundingClientRect().right > innerWidth) throw new Error('Pairing input is hidden or clipped');`);
    fs.writeFileSync(path.join(output, 'pairing-dark.png'), (await win.webContents.capturePage()).toPNG());
    clearTimeout(watchdog);
    app.quit();
}).catch(error => { console.error(error); app.exit(1); });
