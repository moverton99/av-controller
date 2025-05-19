import { BaseDevice, DeviceActionResult } from './BaseDevice';

export class ReceiverDevice extends BaseDevice {
    /**
     * Set the power state of the receiver.
     * @param state "on", "off", or "toggle"
     */
    async power(state: 'on' | 'off' | 'toggle'): Promise<DeviceActionResult> {
        throw new Error('power() not implemented');
    }

    /**
     * Control volume and mute state.
     * @param action "up", "down", "mute", "unmute", or "togglemute"
     */
    async volume(action: 'up' | 'down' | 'mute' | 'unmute' | 'togglemute'): Promise<DeviceActionResult> {
        throw new Error('volume() not implemented');
    }

    /**
     * Change input source.
     * @param input "HDMI1", "Bluetooth", "NET RADIO", etc.
     */
    async input(input: 'HDMI1' | 'Bluetooth' | 'NET RADIO'): Promise<DeviceActionResult> {
        throw new Error('input() not implemented');
    }

    /**
     * Change surround mode.
     * @param mode "Straight", "Movie", "Stereo", etc.
     */
    async surround(mode: 'Straight' | 'Movie' | 'Stereo'): Promise<DeviceActionResult> {
        throw new Error('surround() not implemented');
    }
}