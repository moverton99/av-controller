import express, { Request, Response } from 'express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import bodyParser from 'body-parser';
import net from 'net';
import os from 'os';
import * as registry from './registry/registry';

const app = express();
const CONFIG_DIR = path.join(__dirname, 'config');

// --- MIDDLEWARE ---
app.use(bodyParser.json());
app.use(express.static('public'));

// --- UTILITY FUNCTIONS ---

/** Load YAML config by filename from CONFIG_DIR */
function loadConfig(filename: string): any | null {
    const configPath = path.join(CONFIG_DIR, filename); // Build full path to config file
    if (!fs.existsSync(configPath)) return null; // Return null if file doesn't exist
    return yaml.load(fs.readFileSync(configPath, 'utf8')) as any; // Load and parse YAML
}

/** Find command or query in config */
function findCommand(config: any, command: string): any | null {
    // Look for command in commands or queries section
    return config.commands?.[command] || config.queries?.[command] || null;
}

/** Get the local subnet (e.g., "192.168.1.0") */
function getLocalSubnet(): string {
    const interfaces = os.networkInterfaces(); // Get all network interfaces
    for (let iface of Object.values(interfaces)) {
        if (!iface) continue;
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
function scanPort80(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
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
async function discoverDevice(filename: string): Promise<{ found: boolean, ip?: string }> {
    const config = loadConfig(filename); // Load device config
    if (!config) return { found: false };
    const discovery = config.discovery_check;
    if (!discovery) return { found: false };

    const base = getLocalSubnet().split('.').slice(0, 3).join('.'); // Get subnet base (e.g. 192.168.1)
    const scanRange = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`); // Generate IPs 1-254

    for (let ip of scanRange) {
        const open = await scanPort80(ip); // Check if port 80 is open
        if (!open) continue;
        const url = `http://${ip}:${config.port}${discovery.path}`; // Build discovery URL
        try {
            const response = await axios({
                method: discovery.method.toLowerCase(),
                url,
                headers: discovery.headers,
                data: discovery.body,
                timeout: 1500
            });
            // Check if response contains expected validation string
            if (
                response.data &&
                response.data.includes(discovery.validate_response_contains)
            ) {
                const deviceId = config.device.toLowerCase().replace(/\s+/g, '-'); // Generate device ID
                registry.add(deviceId, {
                    name: config.device,
                    config: filename,
                    ip,
                    last_seen: new Date().toISOString()
                });
                return { found: true, ip }; // Device found
            }
        } catch {
            // ignore errors, continue scanning
        }
    }
    return { found: false }; // No device found
}

// --- ROUTES ---

// Return the current device registry as JSON
app.get('/registry', (req: Request, res: Response) => {
    res.json(registry.getAll());
});

// Remove a device from the registry by ID
app.post('/forget-device', (req: Request, res: Response): void => {
    const id = req.body.id as string;
    if (!id) {
        res.status(400).send('Missing device ID');
        return;
    }
    registry.remove(id); // Remove device from registry
    res.send('Device removed');
});

// Send a command to a device using its config file and IP address
app.post('/send/:command', async (req: Request, res: Response): Promise<void> => {
    try {
        const { ip, config: filename, id } = req.query as { ip?: string; config?: string; id?: string };
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
        const response = await axios({
            method: cmd.method.toLowerCase(),
            url: `http://${ip}:${config.port}${cmd.path}`,
            headers: cmd.headers,
            data: cmd.body,
            timeout: 1000
        });
        // Optionally update last seen timestamp
        if (config.commands?.[req.params.command] && registry.updateLastSeen) {
            registry.updateLastSeen(id);
        }
        res.send(response.data); // Send response back to client
    } catch (err: any) {
        console.error(`✗ Error sending ${req.params.command} to ${req.query.ip}:`, err.message);
        res.status(500).send('Failed to send command');
    }
});

// Scan the local subnet for devices matching the config's discovery_check
app.get('/find-device', async (req: Request, res: Response): Promise<void> => {
    const filename = req.query.config as string;
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
app.get('/device-list', (req: Request, res: Response) => {
    const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.yaml')); // List YAML config files
    const devices = files.map(file => {
        const config = loadConfig(file); // Load config for each file
        const regDevice = Object.values(registry.getAll()).find(
            (d: any) => d.config === file || d.name === config.device
        );
        return {
            device: config.device || file,
            filename: file,
            ip: regDevice?.ip || '',
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