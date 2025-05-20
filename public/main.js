"use strict";
// Append a log message to the log div, with optional error styling
function appendLog(msg, isError = false) {
    const div = document.getElementById('log'); // Get the log container
    const line = document.createElement('div'); // Create a new div for the log line
    const timestamp = new Date().toISOString().slice(11, 19); // Get current time (HH:MM:SS)
    line.textContent = `[${timestamp}] ${msg}`; // Format log line
    if (isError)
        line.style.color = 'red'; // Color errors red
    div.appendChild(line); // Add log line to log container
    div.scrollTop = div.scrollHeight; // Scroll to bottom
}
// Load device types from the server and populate the device select dropdown
async function loadDeviceTypes() {
    appendLog("🔍 Loading device types...");
    try {
        const res = await fetch('/device-list'); // Fetch device list from server
        const types = await res.json(); // Parse JSON response
        const select = document.getElementById('deviceList');
        select.innerHTML = ''; // Clear existing options
        types.forEach((t) => {
            const opt = document.createElement('option'); // Create option for each device type
            opt.value = t.filename;
            opt.textContent = t.device;
            // Store extra info as data attributes for later use
            opt.dataset.testCommand = t.test_command;
            opt.dataset.testPrep = t.test_prep_instructions;
            opt.dataset.testConfirm = t.test_confirmation;
            select.appendChild(opt);
        });
        document.getElementById('device-dialog').style.display = 'block'; // Show device dialog
        appendLog(`✓ Loaded ${types.length} device type(s).`);
    }
    catch (err) {
        appendLog(`✗ Failed to load device types: ${err}`, true);
    }
}
// Start device discovery for the selected device type
async function startDiscovery() {
    const select = document.getElementById('deviceList');
    const filename = select.value;
    const prep = select.selectedOptions[0].dataset.testPrep || '';
    // Ask user to confirm any preparation instructions
    if (!confirm(prep)) {
        appendLog("⚠️ Discovery cancelled by user.");
        return;
    }
    appendLog(`🔎 Starting discovery for ${filename}...`);
    try {
        const res = await fetch(`/find-device?config=${filename}`); // Start discovery on server
        const data = await res.json(); // Parse response
        if (data.found) {
            appendLog(`✓ Device found at ${data.ip}. Saved to registry.`);
            alert('Device found and saved.');
            location.reload(); // Reload page to update UI
        }
        else {
            appendLog(`✗ Device not found.`);
            alert('Device not found.');
        }
    }
    catch (err) {
        appendLog(`✗ Error during discovery: ${err}`, true);
        alert('An error occurred during discovery.');
    }
}
// Load the device registry and display each device with controls
async function loadRegistry() {
    appendLog("📦 Loading device registry...");
    try {
        const res = await fetch('/registry'); // Fetch registry from server
        const registry = await res.json(); // Parse registry JSON
        const container = document.getElementById('deviceListContainer');
        container.innerHTML = ''; // Clear previous device list
        Object.entries(registry).forEach(([id, device]) => {
            const div = document.createElement('div');
            div.className = 'device';
            const title = document.createElement('h3');
            title.textContent = `${device.name} (${id})`;
            div.appendChild(title);
            // Volume display
            const volumeDisplay = document.createElement('div');
            volumeDisplay.textContent = 'Volume: ...';
            div.appendChild(volumeDisplay);
            // Fetch and display current volume for this device
            fetch(`/send/get_volume?id=${id}&ip=${device.ip}&config=${device.config}`, { method: 'POST' })
                .then(res => res.text())
                .then(xml => {
                // Parse XML to extract volume value using regex
                const match = xml.match(/<Val>(-?\d+)<\/Val>\s*<Exp>(\d+)<\/Exp>/);
                if (match) {
                    const val = parseInt(match[1], 10);
                    const exp = parseInt(match[2], 10);
                    const volume = val / Math.pow(10, exp); // Calculate volume in dB
                    volumeDisplay.textContent = `Volume: ${volume} dB`;
                }
                else {
                    volumeDisplay.textContent = 'Volume: (unavailable)';
                }
            })
                .catch(() => {
                volumeDisplay.textContent = 'Volume: (error)';
            });
            // Add power control buttons
            ['power_on', 'power_off'].forEach(cmd => {
                const btn = document.createElement('button');
                btn.textContent = cmd;
                btn.onclick = () => sendCommand(id, device.ip, device.config, cmd); // Send command on click
                div.appendChild(btn);
            });
            // Add forget button to remove device from registry
            const forget = document.createElement('button');
            forget.textContent = 'Forget';
            forget.onclick = async () => {
                appendLog(`🗑 Forgetting device ${id}...`);
                await fetch(`/forget-device?id=${id}`, { method: 'POST' }); // Remove device on server
                appendLog(`✓ Device ${id} removed.`);
                location.reload(); // Reload UI
            };
            div.appendChild(forget);
            container.appendChild(div); // Add device div to container
        });
        appendLog(`✓ Loaded ${Object.keys(registry).length} device(s).`);
    }
    catch (err) {
        appendLog(`✗ Failed to load registry: ${err}`, true);
    }
}
// Send a command to a device and log the result
async function sendCommand(id, ip, config, command) {
    const url = `/send/${command}?id=${id}&ip=${ip}&config=${config}`;
    appendLog(`→ Sending '${command}' to ${id}`);
    try {
        const res = await fetch(url, { method: 'POST' }); // Send command to server
        const text = await res.text(); // Get response text
        appendLog(`✓ ${command} succeeded: ${text}`);
    }
    catch (err) {
        appendLog(`✗ ${command} failed: ${err}`, true);
    }
}
// Expose startDiscovery globally for HTML button onclick
window.startDiscovery = startDiscovery;
// On page load, load device types and registry
window.onload = () => {
    loadDeviceTypes();
    loadRegistry();
};
//# sourceMappingURL=main.js.map