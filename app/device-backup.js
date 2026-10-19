/** Portable pairings only; preferences stay local to each computer. */
const FORMAT = 'atv-remote-devices';
const VERSION = 1;
const CREDS_KEY = 'remote_credentials';
const ACTIVE_KEY = 'atvcreds';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasPairing = value => isObject(value) &&
    typeof (value.companion || value.Companion) === 'string' &&
    (value.companion || value.Companion).length > 0;

function parseBackup(text) {
    const backup = JSON.parse(text);
    if (!isObject(backup) || backup.format !== FORMAT || backup.version !== VERSION ||
        !isObject(backup.devices) || !Object.keys(backup.devices).length ||
        Object.entries(backup.devices).some(([name, creds]) =>
            !name.trim() || ['__proto__', 'constructor', 'prototype'].includes(name) || !hasPairing(creds))) {
        throw new Error('Invalid device backup');
    }
    if (backup.activeCredentials != null && !hasPairing(backup.activeCredentials)) {
        throw new Error('Invalid active device');
    }
    if (backup.activeCredentials && !Object.values(backup.devices).some(creds => sameDevice(creds, backup.activeCredentials))) {
        throw new Error('Active device is missing from backup');
    }
    return backup;
}

function sameDevice(a, b) {
    if (!a || !b) return false;
    const idA = a.device?.identifier || a.identifier;
    const idB = b.device?.identifier || b.identifier;
    if (idA && idB) return idA === idB;
    return Boolean((a.companion || a.Companion) &&
        (a.companion || a.Companion) === (b.companion || b.Companion));
}

function exportDevices(storage) {
    const devices = JSON.parse(storage.getItem(CREDS_KEY) || '{}');
    const activeCredentials = JSON.parse(storage.getItem(ACTIVE_KEY) || 'null') || null;
    const text = JSON.stringify({ format: FORMAT, version: VERSION, devices, activeCredentials }, null, 2);
    parseBackup(text);
    return text;
}

function importDevices(storage, text) {
    const backup = parseBackup(text);
    const originalDevices = storage.getItem(CREDS_KEY);
    const originalActive = storage.getItem(ACTIVE_KEY);
    const devices = JSON.parse(originalDevices || '{}');
    if (!isObject(devices)) throw new Error('Existing device data is invalid');
    let added = 0;
    for (const [name, creds] of Object.entries(backup.devices)) {
        // Preserve existing registrations, including updated addresses and credentials.
        if (Object.values(devices).some(existing => sameDevice(existing, creds))) continue;
        let uniqueName = name;
        let suffix = 1;
        while (Object.hasOwn(devices, uniqueName)) uniqueName = `${name} (imported ${suffix++})`;
        devices[uniqueName] = creds;
        added++;
    }
    const active = JSON.parse(originalActive || 'null');
    const preferred = backup.activeCredentials || Object.values(backup.devices)[0];
    const nextActive = hasPairing(active) ? active : Object.values(devices).find(creds => sameDevice(creds, preferred));
    try {
        storage.setItem(CREDS_KEY, JSON.stringify(devices));
        storage.setItem(ACTIVE_KEY, JSON.stringify(nextActive));
    } catch (error) {
        // A quota/write failure must not silently discard the previous configuration.
        for (const [key, value] of [[CREDS_KEY, originalDevices], [ACTIVE_KEY, originalActive]]) {
            if (value === null) storage.removeItem(key);
            else storage.setItem(key, value);
        }
        throw error;
    }
    return added;
}

module.exports = { parseBackup, exportDevices, importDevices };
