"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const body_parser_1 = __importDefault(require("body-parser"));
const net_1 = __importDefault(require("net"));
const os_1 = __importDefault(require("os"));
const registry = __importStar(require("./registry/registry"));
const app = (0, express_1.default)();
const CONFIG_DIR = path_1.default.join(__dirname, 'config');
// --- MIDDLEWARE ---
app.use(body_parser_1.default.json());
app.use(express_1.default.static('public'));
// --- UTILITY FUNCTIONS ---
/** Load YAML config by filename from CONFIG_DIR */
function loadConfig(filename) {
    const configPath = path_1.default.join(CONFIG_DIR, filename); // Build full path to config file
    if (!fs_1.default.existsSync(configPath))
        return null; // Return null if file doesn't exist
    return js_yaml_1.default.load(fs_1.default.readFileSync(configPath, 'utf8')); // Load and parse YAML
}
/** Find command or query in config */
function findCommand(config, command) {
    var _a, _b;
    // Look for command in commands or queries section
    return ((_a = config.commands) === null || _a === void 0 ? void 0 : _a[command]) || ((_b = config.queries) === null || _b === void 0 ? void 0 : _b[command]) || null;
}
/** Get the local subnet (e.g., "192.168.1.0") */
function getLocalSubnet() {
    const interfaces = os_1.default.networkInterfaces(); // Get all network interfaces
    for (let iface of Object.values(interfaces)) {
        if (!iface)
            continue;
        for (let entry of iface) {
            // Only consider IPv4, non-internal addresses
            if (entry.family === 'IPv4' && !entry.internal) {
                const ipParts = entry.address.split('.'); // Split IP into octets
                ipParts[3] = '0'; // Set last octet to 0 for subnet
                return ipParts.join('.'); // Return subnet base
            }
        }
    }
    return '192.168.1.0'; // Fallback subnet
}
/** Check if port 80 is open on a given IP address */
function scanPort80(ip) {
    return new Promise((resolve) => {
        const socket = new net_1.default.Socket();
        socket.setTimeout(300); // Set connection timeout
        socket.once('connect', () => {
            socket.destroy();
            resolve(true); // Port is open
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false); // Timed out, port likely closed
        });
        socket.once('error', () => {
            resolve(false); // Error, port likely closed
        });
        socket.connect(80, ip); // Attempt to connect to port 80
    });
}
/** Device discovery logic */
async function discoverDevice(filename) {
    const config = loadConfig(filename); // Load device config
    if (!config)
        return { found: false };
    const discovery = config.discovery_check;
    if (!discovery)
        return { found: false };
    const base = getLocalSubnet().split('.').slice(0, 3).join('.'); // Get subnet base (e.g. 192.168.1)
    const scanRange = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`); // Generate IPs 1-254
    for (let ip of scanRange) {
        const open = await scanPort80(ip); // Check if port 80 is open
        if (!open)
            continue;
        const url = `http://${ip}:${config.port}${discovery.path}`; // Build discovery URL
        try {
            const response = await (0, axios_1.default)({
                method: discovery.method.toLowerCase(),
                url,
                headers: discovery.headers,
                data: discovery.body,
                timeout: 1500
            });
            // Check if response contains expected validation string
            if (response.data &&
                response.data.includes(discovery.validate_response_contains)) {
                const deviceId = config.device.toLowerCase().replace(/\s+/g, '-'); // Generate device ID
                registry.add(deviceId, {
                    name: config.device,
                    config: filename,
                    ip,
                    last_seen: new Date().toISOString()
                });
                return { found: true, ip }; // Device found
            }
        }
        catch {
            // ignore errors, continue scanning
        }
    }
    return { found: false }; // No device found
}
// --- ROUTES ---
// Return the current device registry as JSON
app.get('/registry', (req, res) => {
    res.json(registry.getAll());
});
// Remove a device from the registry by ID
app.post('/forget-device', (req, res) => {
    const id = req.body.id;
    if (!id) {
        res.status(400).send('Missing device ID');
        return;
    }
    registry.remove(id); // Remove device from registry
    res.send('Device removed');
});
// Send a command to a device using its config file and IP address
app.post('/send/:command', async (req, res) => {
    var _a;
    try {
        const { ip, config: filename, id } = req.query;
        if (!ip || !filename || !id) {
            res.status(400).send('Missing IP, config, or device ID');
            return;
        }
        const config = loadConfig(filename); // Load device config
        if (!config) {
            res.status(404).send('Config file not found');
            return;
        }
        const cmd = findCommand(config, req.params.command); // Find command in config
        if (!cmd) {
            res.status(404).send('Command not found in config');
            return;
        }
        const response = await (0, axios_1.default)({
            method: cmd.method.toLowerCase(),
            url: `http://${ip}:${config.port}${cmd.path}`,
            headers: cmd.headers,
            data: cmd.body,
            timeout: 1000
        });
        // Optionally update last seen timestamp
        if (((_a = config.commands) === null || _a === void 0 ? void 0 : _a[req.params.command]) && registry.updateLastSeen) {
            registry.updateLastSeen(id);
        }
        res.send(response.data); // Send response back to client
    }
    catch (err) {
        console.error(`✗ Error sending ${req.params.command} to ${req.query.ip}:`, err.message);
        res.status(500).send('Failed to send command');
    }
});
// Scan the local subnet for devices matching the config's discovery_check
app.get('/find-device', async (req, res) => {
    const filename = req.query.config;
    if (!filename) {
        res.status(400).json({ error: 'Missing config file' });
        return;
    }
    const config = loadConfig(filename); // Load config for discovery
    if (!config) {
        res.status(404).json({ error: 'Config file not found' });
        return;
    }
    if (!config.discovery_check) {
        res.status(500).json({ error: 'Missing discovery_check in config' });
        return;
    }
    const result = await discoverDevice(filename); // Run discovery
    res.json(result);
});
// Return a list of all device configs, including their IP address if known
app.get('/device-list', (req, res) => {
    const files = fs_1.default.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.yaml')); // List YAML config files
    const devices = files.map(file => {
        const config = loadConfig(file); // Load config for each file
        const regDevice = Object.values(registry.getAll()).find((d) => d.config === file || d.name === config.device);
        return {
            device: config.device || file,
            filename: file,
            ip: (regDevice === null || regDevice === void 0 ? void 0 : regDevice.ip) || '',
            test_command: config.test_command || '',
            test_prep_instructions: config.test_prep_instructions || '',
            test_confirmation: config.test_confirmation || ''
        };
    });
    res.json(devices);
});
// --- START SERVER ---
app.listen(3000, () => {
    console.log('AV Controller running at http://localhost:3000');
});
//# sourceMappingURL=server.js.map