app.get('/find-device', async (req, res) => {
    const filename = req.query.config;
    if (!filename) return res.status(400).json({ error: 'Missing config file' });
  
    const configPath = path.join(CONFIG_DIR, filename);
    if (!fs.existsSync(configPath)) return res.status(404).json({ error: 'Config file not found' });
  
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const discovery = config.discovery_check;
    if (!discovery) return res.status(500).json({ error: 'Missing discovery_check in config' });
  
    const base = getLocalSubnet().split('.').slice(0, 3).join('.');
    const scanRange = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`);
  
    for (let ip of scanRange) {
      const open = await scanPort80(ip);
      if (!open) continue;
  
      try {
        const response = await axios({
          method: discovery.method.toLowerCase(),
          url: `http://${ip}:${config.port}${discovery.path}`,
          headers: discovery.headers,
          data: discovery.body,
          timeout: 1000
        });
  
        if (
          response.data &&
          response.data.includes(discovery.validate_response_contains)
        ) {
          return res.json({ found: true, ip });
        }
      } catch (e) {
        // continue silently
      }
    }
  
    res.json({ found: false });
  });
  