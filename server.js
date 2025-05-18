const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');
const net = require('net');
const os = require('os');
const registry = require('./registry/registry');

const app = express();  // ✅ THIS LINE WAS MISSING
const CONFIG_DIR = path.join(__dirname, 'config');

app.use(bodyParser.json());
app.use(express.static('public'));


app.get('/registry', (req, res) => {
    const all = registry.getAll();
    res.json(all);
});

app.post('/forget-device', (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).send('Missing device ID');
    registry.remove(id);
    res.send('Device removed');
});

app.post('/send/:command', async (req, res) => {
    const { ip, config: filename, id } = req.query;
    if (!ip || !filename || !id) {
        return res.status(400).send('Missing IP, config, or device ID');
    }

    console.log(`→ Sending ${req.params.command} to ${ip} from ${id}`);

    const configPath = path.join(CONFIG_DIR, filename);
    if (!fs.existsSync(configPath)) {
        return res.status(404).send('Config file not found');
    }

    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const cmd = config.commands[req.params.command];
    if (!cmd) {
        return res.status(404).send('Command not found in config');
    }

    try {
        await axios({
            method: cmd.method.toLowerCase(),
            url: `http://${ip}:${config.port}${cmd.path}`,
            headers: cmd.headers,
            data: cmd.body,
            timeout: 1000
        });

        registry.updateLastSeen(id);
        res.send(`Command ${req.params.command} sent to ${ip}`);
    } catch (err) {
        console.error(`✗ Error sending ${req.params.command} to ${ip}:`, err.message);
        res.status(500).send('Failed to send command');
    }
});


function getLocalSubnet() {
    for (let iface of Object.values(os.networkInterfaces())) {
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
        const socket = new net.Socket();
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
    if (!filename) return res.status(400).json({ error: 'Missing config file' });

    const configPath = path.join(CONFIG_DIR, filename);
    if (!fs.existsSync(configPath)) {
        console.log(`⚠️ Config file not found: ${filename}`);
        return res.status(404).json({ error: 'Config file not found' });
    }

    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const discovery = config.discovery_check;
    if (!discovery) {
        console.log(`❌ Missing discovery_check in ${filename}`);
        return res.status(500).json({ error: 'Missing discovery_check in config' });
    }

    const base = getLocalSubnet().split('.').slice(0, 3).join('.');
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

            if (
                response.data &&
                response.data.includes(discovery.validate_response_contains)
            ) {
                const deviceId = config.device.toLowerCase().replace(/\s+/g, '-');
                console.log(`🎯 Match found at ${ip}, saving to registry as ${deviceId}`);
                registry.add(deviceId, {
                    name: config.device,
                    config: filename,
                    ip,
                    last_seen: new Date().toISOString()
                });
                return res.json({ found: true, ip });
            } else {
                console.log(`🟡 Validation failed at ${ip}: string '${discovery.validate_response_contains}' not found`);
            }
        } catch (e) {
            console.error(`❌ Error talking to ${ip}: ${e.message}`);
        }
    }

    console.log('🔚 Discovery complete — no match found');
    res.json({ found: false });
});


app.get('/device-list', (req, res) => {
    console.log('Get device list');
    const files = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.yaml'));
    const devices = files.map(file => {
        const config = yaml.load(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8'));
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