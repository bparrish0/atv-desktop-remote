const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exportDevices, importDevices } = require('../app/device-backup');
const cred = (identifier, companion = 'test-only-pairing') => ({ device: { identifier, address: '192.0.2.1' }, companion });
function storage(devices = {}, active = null) {
    const data = new Map([['remote_credentials', JSON.stringify(devices)], ['atvcreds', JSON.stringify(active)], ['uimode', 'darkmode']]);
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
test('pairings round-trip to a new machine without changing preferences', () => {
    const original = storage({ Living: cred('one'), Bedroom: cred('two') }, cred('two'));
    const destination = storage();
    assert.equal(importDevices(destination, exportDevices(original)), 2);
    assert.equal(destination.getItem('remote_credentials'), original.getItem('remote_credentials'));
    assert.equal(destination.getItem('atvcreds'), original.getItem('atvcreds'));
    assert.equal(destination.getItem('uimode'), 'darkmode');
});
test('merge preserves existing devices and active selection; handles name collisions and repeat imports', () => {
    const destination = storage({ Living: cred('one', 'updated') }, cred('one', 'updated'));
    const text = exportDevices(storage({ Living: cred('two'), OldName: cred('one') }, cred('two')));
    assert.equal(importDevices(destination, text), 1);
    const devices = JSON.parse(destination.getItem('remote_credentials'));
    assert.equal(devices.Living.companion, 'updated');
    assert.equal(devices['Living (imported 1)'].device.identifier, 'two');
    assert.equal(JSON.parse(destination.getItem('atvcreds')).device.identifier, 'one');
    assert.equal(importDevices(destination, text), 0);
});
test('invalid, unsupported, empty and prototype-polluting backups leave storage unchanged', () => {
    const destination = storage({ Existing: cred('one') }, cred('one'));
    const before = destination.getItem('remote_credentials');
    for (const text of ['oops', '{}', '{"format":"atv-remote-devices","version":2,"devices":{}}', '{"format":"atv-remote-devices","version":1,"devices":{"__proto__":{"companion":"x"}}}', '{"format":"atv-remote-devices","version":1,"devices":{"TV":{}}}']) {
        assert.throws(() => importDevices(destination, text));
        assert.equal(destination.getItem('remote_credentials'), before);
    }
});
test('failed active-device write rolls back the device list', () => {
    const destination = storage({ Existing: cred('one') }, cred('one'));
    const before = destination.getItem('remote_credentials');
    const write = destination.setItem;
    let fail = true;
    destination.setItem = (key, value) => {
        if (key === 'atvcreds' && fail) { fail = false; throw new Error('quota'); }
        write(key, value);
    };
    assert.throws(() => importDevices(destination, exportDevices(storage({ New: cred('two') }, cred('two')))));
    assert.equal(destination.getItem('remote_credentials'), before);
    assert.equal(JSON.parse(destination.getItem('atvcreds')).device.identifier, 'one');
});
