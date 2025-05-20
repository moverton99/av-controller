"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiverDevice = void 0;
const BaseDevice_1 = require("./BaseDevice");
class ReceiverDevice extends BaseDevice_1.BaseDevice {
    /**
     * Set the power state of the receiver.
     * @param state "on", "off", or "toggle"
     */
    async power(state) {
        throw new Error('power() not implemented');
    }
    /**
     * Control volume and mute state.
     * @param action "up", "down", "mute", "unmute", or "togglemute"
     */
    async volume(action) {
        throw new Error('volume() not implemented');
    }
    /**
     * Change input source.
     * @param input "HDMI1", "Bluetooth", "NET RADIO", etc.
     */
    async input(input) {
        throw new Error('input() not implemented');
    }
    /**
     * Change surround mode.
     * @param mode "Straight", "Movie", "Stereo", etc.
     */
    async surround(mode) {
        throw new Error('surround() not implemented');
    }
}
exports.ReceiverDevice = ReceiverDevice;
//# sourceMappingURL=ReceiverDevice.js.map