function appendLog(msg: string, isError = false): void {
    const div = document.getElementById('log')!;
    const line = document.createElement('div');
    const timestamp = new Date().toISOString().slice(11, 19);
    line.textContent = `[${timestamp}] ${msg}`;
    if (isError) line.style.color = 'red';
    div.appendChild(line);
    div.scrollTop = div.scrollHeight;
}

async function loadDeviceTypes(): Promise<void> {
    appendLog("🔍 Loading device types...");
    try {
        const res = await fetch('/device-list');
        const types = await res.json();
        const select = document.getElementById('deviceList') as HTMLSelectElement;
        select.innerHTML = '';
        types.forEach((t: any) => {
            const opt = document.createElement('option');
            opt.value = t.filename;
            opt.textContent = t.device;
            opt.dataset.testCommand = t.test_command;
            opt.dataset.testPrep = t.test_prep_instructions;
            opt.dataset.testConfirm = t.test_confirmation;
            select.appendChild(opt);
        });
        document.getElementById('device-dialog')!.style.display = 'block';
        appendLog(`✓ Loaded ${types.length} device type(s).`);
    } catch (err) {
        appendLog(`✗ Failed to load device types: ${err}`, true);
    }
}

async function startDiscovery(): Promise<void> {
    const select = document.getElementById('deviceList') as HTMLSelectElement;
    const filename = select.value;
    const prep = select.selectedOptions[0].dataset.testPrep || '';

    if (!confirm(prep)) {
        appendLog("⚠️ Discovery cancelled by user.");
        return;
    }

    appendLog(`🔎 Starting discovery for ${filename}...`);
    try {
        const res = await fetch(`/find-device?config=${filename}`);
        const data = await res.json();
        if (data.found) {
            appendLog(`✓ Device found at ${data.ip}. Saved to registry.`);
            alert('Device found and saved.');
            location.reload();
        } else {
            appendLog(`✗ Device not found.`);
            alert('Device not found.');
        }
    } catch (err) {
        appendLog(`✗ Error during discovery: ${err}`, true);
        alert('An error occurred during discovery.');
    }
}

async function loadRegistry(): Promise<void> {
    appendLog("📦 Loading device registry...");
    try {
        const res = await fetch('/registry');
        const registry = await res.json();
        const container = document.getElementById('deviceListContainer')!;
        container.innerHTML = '';

        Object.entries(registry).forEach(([id, device]: [string, any]) => {
            const div = document.createElement('div');
            div.className = 'device';

            const title = document.createElement('h3');
            title.textContent = `${device.name} (${id})`;
            div.appendChild(title);

            ['power_on', 'power_off'].forEach(cmd => {
                const btn = document.createElement('button');
                btn.textContent = cmd;
                btn.onclick = () => sendCommand(id, device.ip, device.config, cmd);
                div.appendChild(btn);
            });

            const forget = document.createElement('button');
            forget.textContent = 'Forget';
            forget.onclick = async () => {
                appendLog(`🗑 Forgetting device ${id}...`);
                await fetch(`/forget-device?id=${id}`, { method: 'POST' });
                appendLog(`✓ Device ${id} removed.`);
                location.reload();
            };
            div.appendChild(forget);

            container.appendChild(div);
        });

        appendLog(`✓ Loaded ${Object.keys(registry).length} device(s).`);
    } catch (err) {
        appendLog(`✗ Failed to load registry: ${err}`, true);
    }
}

async function sendCommand(id: string, ip: string, config: string, command: string): Promise<void> {
    const url = `/send/${command}?id=${id}&ip=${ip}&config=${config}`;
    appendLog(`→ Sending '${command}' to ${id}`);
    try {
        const res = await fetch(url, { method: 'POST' });
        const text = await res.text();
        appendLog(`✓ ${command} succeeded: ${text}`);
    } catch (err) {
        appendLog(`✗ ${command} failed: ${err}`, true);
    }
}

// Expose functions globally for HTML
(window as any).startDiscovery = startDiscovery;

loadRegistry();
