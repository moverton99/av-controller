"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAll = getAll;
exports.add = add;
exports.remove = remove;
exports.updateLastSeen = updateLastSeen;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Define the path to the data directory and registry file
const DATA_DIR = path_1.default.join(__dirname, '..', 'data');
const REGISTRY_PATH = path_1.default.join(DATA_DIR, 'devices.json');
// Ensure the /data directory exists before using it
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
/**
 * Ensure the registry file exists.
 * If it doesn't, create an empty JSON object in the file.
 */
function ensureFile() {
    if (!fs_1.default.existsSync(REGISTRY_PATH)) {
        fs_1.default.writeFileSync(REGISTRY_PATH, JSON.stringify({}, null, 2));
    }
}
/**
 * Load the registry data from disk.
 * Returns the parsed JSON object.
 */
function load() {
    ensureFile();
    return JSON.parse(fs_1.default.readFileSync(REGISTRY_PATH, 'utf8'));
}
/**
 * Save the registry data to disk.
 * @param data The registry data object to save
 * @param id The device ID being saved (for logging)
 */
function save(data, id) {
    fs_1.default.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Device ${id} saved to registry`);
}
/**
 * Get all devices in the registry.
 * @returns The entire registry data object
 */
function getAll() {
    return load();
}
/**
 * Add or update a device in the registry.
 * @param id The device ID
 * @param entry The device data to store
 */
function add(id, entry) {
    const data = load();
    data[id] = entry;
    save(data, id);
}
/**
 * Remove a device from the registry by ID.
 * @param id The device ID to remove
 */
function remove(id) {
    const data = load();
    delete data[id];
    save(data, id);
}
/**
 * Update the 'last_seen' timestamp for a device.
 * @param id The device ID to update
 */
function updateLastSeen(id) {
    const data = load();
    if (data[id]) {
        data[id].last_seen = new Date().toISOString();
        save(data, id);
    }
}
//# sourceMappingURL=registry.js.map