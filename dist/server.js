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
app.use(body_parser_1.default.json());
app.use(express_1.default.static('public'));
app.get('/registry', (req, res) => {
    const all = registry.getAll();
    res.json(all);
});
app.post('/forget-device', (req, res) => {
    const id = req.body.id;
    if (!id) {
        res.status(400).send('Missing device ID');
        return;
    }
    registry.remove(id);
    res.send('Device removed');
});
app.post('/send/:command', async (req, res) => {
    var _a, _b;
    try {
        const { ip, config: filename, id } = req.query;
        if (!ip || !filename || !id) {
            res.status(400).send('Missing IP, config, or device ID');
            return;
        }
        const configPath = path_1.default.join(CONFIG_DIR, filename);
        if (!fs_1.default.existsSync(configPath)) {
            res.status(404).send('Config file not found');
            return;
        }
        const config = js_yaml_1.default.load(fs_1.default.readFileSync(configPath, 'utf8'));
        // Look for the command in both commands and queries
        let cmd = (_a = config.commands) === null || _a === void 0 ? void 0 : _a[req.params.command];
        if (!cmd && config.queries) {
            cmd = config.queries[req.params.command];
        }
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
        // Optionally update last seen for commands
        if (((_b = config.commands) === null || _b === void 0 ? void 0 : _b[req.params.command]) && registry.updateLastSeen) {
            registry.updateLastSeen(id);
        }
        res.send(response.data);
    }
    catch (err) {
        console.error(`✗ Error sending ${req.params.command} to ${req.query.ip}:`, err.message);
        res.status(500).send('Failed to send command');
    }
});
function getLocalSubnet() {
    const interfaces = os_1.default.networkInterfaces();
    for (let iface of Object.values(interfaces)) {
        if (!iface)
            continue;
        for (let entry of iface) {
            if (entry.family === 'IPv4' && !entry.internal) {
                const ipParts = entry.address.split('.');
                ipParts[3] = '0';
                return ipParts.join('.');
            }
        }
    }
    return '192.168.1.0'; // fallback
}
function scanPort80(ip) {
    return new Promise((resolve) => {
        const socket = new net_1.default.Socket();
        socket.setTimeout(300);
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.once('error', () => {
            resolve(false);
        });
        socket.connect(80, ip);
    });
}
app.get('/find-device', async (req, res) => {
    console.log('🔍 Begin device discovery');
    const filename = req.query.config;
    if (!filename) {
        res.status(400).json({ error: 'Missing config file' });
        return;
    }
    const configPath = path_1.default.join(CONFIG_DIR, filename);
    if (!fs_1.default.existsSync(configPath)) {
        console.log(`⚠️ Config file not found: ${filename}`);
        res.status(404).json({ error: 'Config file not found' });
        return;
    }
    const config = js_yaml_1.default.load(fs_1.default.readFileSync(configPath, 'utf8'));
    const discovery = config.discovery_check;
    if (!discovery) {
        console.log(`❌ Missing discovery_check in ${filename}`);
        res.status(500).json({ error: 'Missing discovery_check in config' });
        return;
    }
    const base = getLocalSubnet().split('.').slice(0, 3).join('.');
    const scanRange = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`);
    for (let ip of scanRange) {
        console.log(`📡 Scanning ${ip}...`);
        const open = await scanPort80(ip);
        if (!open)
            continue;
        console.log(`✅ Port 80 open at ${ip}`);
        const url = `http://${ip}:${config.port}${discovery.path}`;
        console.log(`→ Sending discovery request to: ${url}`);
        try {
            const response = await (0, axios_1.default)({
                method: discovery.method.toLowerCase(),
                url,
                headers: discovery.headers,
                data: discovery.body,
                timeout: 1500
            });
            if (response === null || response === void 0 ? void 0 : response.data) {
                console.log(`← Received response from ${ip}:\n${response.data.slice(0, 200)}...`);
            }
            if (response.data &&
                response.data.includes(discovery.validate_response_contains)) {
                const deviceId = config.device.toLowerCase().replace(/\s+/g, '-');
                console.log(`🎯 Match found at ${ip}, saving to registry as ${deviceId}`);
                registry.add(deviceId, {
                    name: config.device,
                    config: filename,
                    ip,
                    last_seen: new Date().toISOString()
                });
                res.json({ found: true, ip });
                return;
            }
            else {
                console.log(`🟡 Validation failed at ${ip}: string '${discovery.validate_response_contains}' not found`);
            }
        }
        catch (e) {
            console.error(`❌ Error talking to ${ip}: ${e.message}`);
        }
    }
    console.log('🔚 Discovery complete — no match found');
    res.json({ found: false });
    return;
});
app.get('/device-list', (req, res) => {
    console.log('Get device list');
    const files = fs_1.default.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.yaml'));
    const devices = files.map(file => {
        const config = js_yaml_1.default.load(fs_1.default.readFileSync(path_1.default.join(CONFIG_DIR, file), 'utf8'));
        return {
            device: config.device || file,
            filename: file,
            test_command: config.test_command || '',
            test_prep_instructions: config.test_prep_instructions || '',
            test_confirmation: config.test_confirmation || ''
        };
    });
    res.json(devices);
});
app.listen(3000, () => {
    console.log('AV Controller running at http://localhost:3000');
});
//# sourceMappingURL=server.js.map