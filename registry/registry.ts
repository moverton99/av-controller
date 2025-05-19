import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const REGISTRY_PATH = path.join(DATA_DIR, 'devices.json');

interface DeviceEntry {
    [key: string]: any;
    last_seen?: string;
}

interface RegistryData {
    [id: string]: DeviceEntry;
}

// Ensure the /data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureFile(): void {
    if (!fs.existsSync(REGISTRY_PATH)) {
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify({}, null, 2));
    }
}

function load(): RegistryData {
    ensureFile();
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function save(data: RegistryData, id: string): void {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Device ${id} saved to registry`);
}

export function getAll(): RegistryData {
    return load();
}

export function add(id: string, entry: DeviceEntry): void {
    const data = load();
    data[id] = entry;
    save(data, id);
}

export function remove(id: string): void {
    const data = load();
    delete data[id];
    save(data, id);
}

export function updateLastSeen(id: string): void {
    const data = load();
    if (data[id]) {
        data[id].last_seen = new Date().toISOString();
        save(data, id);
    }
}