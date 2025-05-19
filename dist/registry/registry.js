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
const DATA_DIR = path_1.default.join(__dirname, '..', 'data');
const REGISTRY_PATH = path_1.default.join(DATA_DIR, 'devices.json');
// Ensure the /data directory exists
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
function ensureFile() {
    if (!fs_1.default.existsSync(REGISTRY_PATH)) {
        fs_1.default.writeFileSync(REGISTRY_PATH, JSON.stringify({}, null, 2));
    }
}
function load() {
    ensureFile();
    return JSON.parse(fs_1.default.readFileSync(REGISTRY_PATH, 'utf8'));
}
function save(data, id) {
    fs_1.default.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
    console.log(`✓ Device ${id} saved to registry`);
}
function getAll() {
    return load();
}
function add(id, entry) {
    const data = load();
    data[id] = entry;
    save(data, id);
}
function remove(id) {
    const data = load();
    delete data[id];
    save(data, id);
}
function updateLastSeen(id) {
    const data = load();
    if (data[id]) {
        data[id].last_seen = new Date().toISOString();
        save(data, id);
    }
}
//# sourceMappingURL=registry.js.map