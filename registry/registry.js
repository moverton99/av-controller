const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REGISTRY_PATH = path.join(DATA_DIR, 'devices.json');

// Ensure the /data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile() {
    if (!fs.existsSync(REGISTRY_PATH)) {
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify({}, null, 2));
    }
}

function load() {
    ensureFile();
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function save(data) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Device ${id} saved to registry`);
}

function getAll() {
    return load();
}

function add(id, entry) {
    const data = load();
    data[id] = entry;
    save(data);
}

function remove(id) {
    const data = load();
    delete data[id];
    save(data);
}

function updateLastSeen(id) {
    const data = load();
    if (data[id]) {
        data[id].last_seen = new Date().toISOString();
        save(data);
    }
}

module.exports = {
    getAll,
    add,
    remove,
    updateLastSeen
};
