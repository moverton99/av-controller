import fs from 'fs';
import path from 'path';

// Define the path to the data directory and registry file
const DATA_DIR = path.join(__dirname, '..', 'data');
const REGISTRY_PATH = path.join(DATA_DIR, 'devices.json');

// DeviceEntry represents a single device's data in the registry
interface DeviceEntry {
    [key: string]: any; // Allows for flexible device properties
    last_seen?: string; // Optional timestamp for when the device was last seen
}

// RegistryData is a mapping from device ID to DeviceEntry
interface RegistryData {
    [id: string]: DeviceEntry;
}

// Ensure the /data directory exists before using it
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Ensure the registry file exists.
 * If it doesn't, create an empty JSON object in the file.
 */
function ensureFile(): void {
    if (!fs.existsSync(REGISTRY_PATH)) {
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify({}, null, 2));
    }
}

/**
 * Load the registry data from disk.
 * Returns the parsed JSON object.
 */
function load(): RegistryData {
    ensureFile();
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

/**
 * Save the registry data to disk.
 * @param data The registry data object to save
 * @param id The device ID being saved (for logging)
 */
function save(data: RegistryData, id: string): void {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Device ${id} saved to registry`);
}

/**
 * Get all devices in the registry.
 * @returns The entire registry data object
 */
export function getAll(): RegistryData {
    return load();
}

/**
 * Add or update a device in the registry.
 * @param id The device ID
 * @param entry The device data to store
 */
export function add(id: string, entry: DeviceEntry): void {
    const data = load();
    data[id] = entry;
    save(data, id);
}

/**
 * Remove a device from the registry by ID.
 * @param id The device ID to remove
 */
export function remove(id: string): void {
    const data = load();
    delete data[id];
    save(data, id);
}

/**
 * Update the 'last_seen' timestamp for a device.
 * @param id The device ID to update
 */
export function updateLastSeen(id: string): void {
    const data = load();
    if (data[id]) {
        data[id].last_seen = new Date().toISOString();
        save(data, id);
    }
}