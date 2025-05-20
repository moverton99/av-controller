"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YamahaYNCA = void 0;
const ReceiverDevice_1 = require("../ReceiverDevice");
class YamahaYNCA extends ReceiverDevice_1.ReceiverDevice {
    constructor(ip, port = 80) {
        super();
        this.ip = ip;
        this.port = port;
    }
    async power(state) {
        let powerValue;
        if (state === 'on')
            powerValue = 'On';
        else if (state === 'off')
            powerValue = 'Standby';
        else if (state === 'toggle')
            powerValue = 'On'; // Yamaha protocol may not support toggle directly
        else
            return { status: 'fail', message: 'Invalid power state' };
        const payload = `<?xml version="1.0" encoding="utf-8"?>
<YAMAHA_AV cmd="PUT">
  <Main_Zone>
    <Power_Control>
      <Power>${powerValue}</Power>
    </Power_Control>
  </Main_Zone>
</YAMAHA_AV>`;
        try {
            const response = await this.postToDevice(this.ip, '/YamahaRemoteControl/ctrl', payload, this.port, { 'Content-Type': 'application/xml' });
            if (response.includes('RC="0"')) {
                return { status: 'success' };
            }
            else {
                return { status: 'fail', message: 'Receiver returned error', data: response };
            }
        }
        catch (err) {
            return { status: 'no-reply', message: err.message };
        }
    }
    async volume(action) {
        let payload;
        if (action === 'up' || action === 'down') {
            const val = action === 'up' ? 'Up 1 dB' : 'Down 1 dB';
            payload = `<?xml version="1.0" encoding="utf-8"?>
<YAMAHA_AV cmd="PUT">
  <Main_Zone>
    <Volume>
      <Lvl>
        <Val>${val}</Val>
      </Lvl>
    </Volume>
  </Main_Zone>
</YAMAHA_AV>`;
        }
        else if (action === 'mute' || action === 'unmute') {
            const muteVal = action === 'mute' ? 'On' : 'Off';
            payload = `<?xml version="1.0" encoding="utf-8"?>
<YAMAHA_AV cmd="PUT">
  <Main_Zone>
    <Volume>
      <Mute>${muteVal}</Mute>
    </Volume>
  </Main_Zone>
</YAMAHA_AV>`;
        }
        else if (action === 'togglemute') {
            // Yamaha protocol may not support toggle directly; you would need to get state and set the opposite
            return { status: 'fail', message: 'togglemute not implemented' };
        }
        else {
            return { status: 'fail', message: 'Invalid volume action' };
        }
        try {
            const response = await this.postToDevice(this.ip, '/YamahaRemoteControl/ctrl', payload, this.port, { 'Content-Type': 'application/xml' });
            if (response.includes('RC="0"')) {
                return { status: 'success' };
            }
            else {
                return { status: 'fail', message: 'Receiver returned error', data: response };
            }
        }
        catch (err) {
            return { status: 'no-reply', message: err.message };
        }
    }
    async input(input) {
        const payload = `<?xml version="1.0" encoding="utf-8"?>
<YAMAHA_AV cmd="PUT">
  <Main_Zone>
    <Input>
      <Input_Sel>${input}</Input_Sel>
    </Input>
  </Main_Zone>
</YAMAHA_AV>`;
        try {
            const response = await this.postToDevice(this.ip, '/YamahaRemoteControl/ctrl', payload, this.port, { 'Content-Type': 'application/xml' });
            if (response.includes('RC="0"')) {
                return { status: 'success' };
            }
            else {
                return { status: 'fail', message: 'Receiver returned error', data: response };
            }
        }
        catch (err) {
            return { status: 'no-reply', message: err.message };
        }
    }
    async surround(mode) {
        const payload = `<?xml version="1.0" encoding="utf-8"?>
<YAMAHA_AV cmd="PUT">
  <Main_Zone>
    <Surround>
      <Program_Sel>
        <Current>${mode}</Current>
      </Program_Sel>
    </Surround>
  </Main_Zone>
</YAMAHA_AV>`;
        try {
            const response = await this.postToDevice(this.ip, '/YamahaRemoteControl/ctrl', payload, this.port, { 'Content-Type': 'application/xml' });
            if (response.includes('RC="0"')) {
                return { status: 'success' };
            }
            else {
                return { status: 'fail', message: 'Receiver returned error', data: response };
            }
        }
        catch (err) {
            return { status: 'no-reply', message: err.message };
        }
    }
    async getVolume() {
        const payload = `<?xml version="1.0" encoding="utf-8"?>
<YAMAHA_AV cmd="GET">
  <Main_Zone>
    <Volume>
      <Lvl>GetParam</Lvl>
    </Volume>
  </Main_Zone>
</YAMAHA_AV>`;
        try {
            const response = await this.postToDevice(this.ip, '/YamahaRemoteControl/ctrl', payload, this.port, { 'Content-Type': 'application/xml' });
            const match = response.match(/<Val>(-?\d+)<\/Val>\s*<Exp>(\d+)<\/Exp>/);
            if (match) {
                const val = parseInt(match[1], 10);
                const exp = parseInt(match[2], 10);
                const volume = val / Math.pow(10, exp);
                return { status: 'success', data: { volume } };
            }
            return { status: 'fail', message: 'Could not parse volume', data: response };
        }
        catch (err) {
            return { status: 'no-reply', message: err.message };
        }
    }
    async getPowerState() {
        const payload = `<?xml version="1.0" encoding="utf-8"?>
<YAMAHA_AV cmd="GET">
  <Main_Zone>
    <Power_Control>
      <Power>GetParam</Power>
    </Power_Control>
  </Main_Zone>
</YAMAHA_AV>`;
        try {
            const response = await this.postToDevice(this.ip, '/YamahaRemoteControl/ctrl', payload, this.port, { 'Content-Type': 'application/xml' });
            const match = response.match(/<Power>(.*?)<\/Power>/);
            if (match) {
                const state = match[1].toLowerCase();
                if (state === 'on')
                    return 'on';
                if (state === 'standby' || state === 'off')
                    return 'off';
            }
            return 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
}
exports.YamahaYNCA = YamahaYNCA;
//# sourceMappingURL=YamahaYNCA.js.map