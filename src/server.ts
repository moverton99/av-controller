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
const CONFIG_DIR = path.join(__dirname, 'config'); // Path to the config directory

// Middleware to parse JSON request bodies
app.use(bodyParser.json());
// Serve static files from the 'public' directory
app.use(express.static('public'));

// --- ROUTES ---

// Return the current device registry as JSON
app.get('/registry', (req: Request, res: Response) => {
    const all = registry.getAll();
    res.json(all);
});

// Remove a device from the registry by ID
app.post('/forget-device', (req: Request, res: Response): void => {
    const id = req.body.id as string;
    if (!id) {
        res.status(400).send('Missing device ID');
        return;
    }
    registry.remove(id);
    res.send('Device removed');
});

// Send a command to a device using its config file and IP address
app.post('/send/:command', async (req: Request, res: Response): Promise<void> => {
    try {
        // Extract query parameters from the request
        const { ip, config: filename, id } = req.query as { ip?: string; config?: string; id?: string };
        if (!ip || !filename || !id) {
            res.status(400).send('Missing IP, config, or device ID');
            return;
        }

        // Build the full path to the config file
        const configPath = path.join(CONFIG_DIR, filename);
        if (!fs.existsSync(configPath)) {
            res.status(404).send('Config file not found');
            return;
        }

        // Load the YAML config for the device
        const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;

        // Look for the command in both commands and queries sections of the config
        let cmd = config.commands?.[req.params.command];
        if (!cmd && config.queries) {
            cmd = config.queries[req.params.command];
        }
        if (!cmd) {
            res.status(404).send('Command not found in config');
            return;
        }

        // Send the command to the device using axios
        const response = await axios({
            method: cmd.method.toLowerCase(),
            url: `http://${ip}:${config.port}${cmd.path}`,
            headers: cmd.headers,
            data: cmd.body,
            timeout: 1000
        });

        // Optionally update the device's last seen timestamp in the registry
        if (config.commands?.[req.params.command] && registry.updateLastSeen) {
            registry.updateLastSeen(id);
        }

        res.send(response.data);
    } catch (err: any) {
        console.error(`✗ Error sending ${req.params.command} to ${req.query.ip}:`, err.message);
        res.status(500).send('Failed to send command');
    }
});

// --- UTILITY FUNCTIONS ---

/**
 * Get the local subnet (e.g., "192.168.1.0") for device discovery.
 * os.networkInterfaces() returns an object describing each network interface on the system.
 */
function getLocalSubnet(): string {
    const interfaces = os.networkInterfaces(); // Get all network interfaces on the machine
    for (let iface of Object.values(interfaces)) {
        if (!iface) continue;
        for (let entry of iface) {
            // entry.family === 'IPv4' checks for IPv4 addresses
            // entry.internal === false ensures it's not a loopback/internal address
            if (entry.family === 'IPv4' && !entry.internal) {
                const ipParts = entry.address.split('.');
                ipParts[3] = '0';
                return ipParts.join('.');
            }
        }
    }
    return '192.168.1.0'; // fallback subnet if none found
}

/**
 * Check if port 80 is open on a given IP address.
 * Uses the 'net' module to attempt a TCP connection.
 */
function scanPort80(ip: string): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(300); // Set a timeout for the connection attempt
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
        socket.connect(80, ip); // Attempt to connect to port 80 on the given IP
    });
}

// --- DEVICE DISCOVERY ---

/**
 * Scan the local subnet for devices matching the config's discovery_check.
 * For each IP, checks if port 80 is open, then sends a discovery request.
 */
app.get('/find-device', async (req: Request, res: Response): Promise<void> => {
    console.log('🔍 Begin device discovery');

    const filename = req.query.config as string;
    if (!filename) {
        res.status(400).json({ error: 'Missing config file' });
        return;
    }

    const configPath = path.join(CONFIG_DIR, filename);
    if (!fs.existsSync(configPath)) {
        console.log(`⚠️ Config file not found: ${filename}`);
        res.status(404).json({ error: 'Config file not found' });
        return;
    }

    // Load the YAML config for the device
    const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;
    const discovery = config.discovery_check;
    if (!discovery) {
        console.log(`❌ Missing discovery_check in ${filename}`);
        res.status(500).json({ error: 'Missing discovery_check in config' });
        return;
    }

    // Get the base subnet (e.g., "192.168.1")
    const base = getLocalSubnet().split('.').slice(0, 3).join('.');
    // Generate a list of all possible IPs in the subnet (1-254)
    const scanRange = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`);

    for (let ip of scanRange) {
        console.log(`📡 Scanning ${ip}...`);
        const open = await scanPort80(ip);
        if (!open) continue;

        console.log(`✅ Port 80 open at ${ip}`);
        const url = `http://${ip}:${config.port}${discovery.path}`;
        console.log(`→ Sending discovery request to: ${url}`);

        try {
            const response = await axios({
                method: discovery.method.toLowerCase(),
                url,
                headers: discovery.headers,
                data: discovery.body,
                timeout: 1500
            });

            if (response?.data) {
                console.log(`← Received response from ${ip}:\n${response.data.slice(0, 200)}...`);
            }

            // Check if the response contains the expected validation string
            if (
                response.data &&
                response.data.includes(discovery.validate_response_contains)
            ) {
                // Generate a device ID from the config's device name
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
            } else {
                console.log(`🟡 Validation failed at ${ip}: string '${discovery.validate_response_contains}' not found`);
            }
        } catch (e: any) {
            console.error(`❌ Error talking to ${ip}: ${e.message}`);
        }
    }

    console.log('🔚 Discovery complete — no match found');
    res.json({ found: false });
    return;
});

// --- DEVICE LIST ---

/**
 * Return a list of all device configs, including their IP address if known.
 */
app.get('/device-list', (req: Request, res: Response) => {
    console.log('Get device list');
    const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.yaml'));
    const devices = files.map(file => {
        // Load the YAML config for each device
        const config = yaml.load(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8')) as any;
        // Try to get the device from the registry by config filename or device name
        const regDevice = Object.values(registry.getAll()).find(
            (d: any) => d.config === file || d.name === config.device
        );
        return {
            device: config.device || file,
            filename: file,
            ip: regDevice?.ip || '', // Add IP address if found in registry
            test_command: config.test_command || '',
            test_prep_instructions: config.test_prep_instructions || '',
            test_confirmation: config.test_confirmation || ''
        };
    });
    res.json(devices);
});

// --- START SERVER ---

// Start the Express server on port 3000
app.listen(3000, () => {
    console.log('AV Controller running at http://localhost:3000');
});