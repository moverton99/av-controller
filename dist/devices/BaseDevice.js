"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseDevice = void 0;
const axios_1 = __importDefault(require("axios"));
class BaseDevice {
    async powerOn() {
        throw new Error('powerOn() not implemented');
    }
    async powerOff() {
        throw new Error('powerOff() not implemented');
    }
    async getPowerState() {
        throw new Error('getPowerState() not implemented');
    }
    /**
     * Utility method to POST to a device over HTTP.
     * @param ip The IP address of the device (required)
     * @param path The HTTP path (required)
     * @param payload The request body (required)
     * @param port The port to use (default: 80)
     * @param headers Optional HTTP headers
     * @param timeout Optional timeout in milliseconds (default: 2000)
     * @returns The response data as a string
     */
    async postToDevice(ip, path, payload, port = 80, headers, timeout = 2000) {
        const url = `http://${ip}:${port}${path}`;
        try {
            const response = await axios_1.default.post(url, payload, {
                headers: headers || { 'Content-Type': 'application/xml' },
                timeout,
                responseType: 'text'
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to POST to device at ${url}: ${error.message}`);
        }
    }
    /**
     * Utility method to GET from a device over HTTP.
     * @param ip The IP address of the device (required)
     * @param path The HTTP path (required)
     * @param port The port to use (default: 80)
     * @param headers Optional HTTP headers
     * @param timeout Optional timeout in milliseconds (default: 2000)
     * @returns The response data as a string
     */
    async getFromDevice(ip, path, port = 80, headers, timeout = 2000) {
        const url = `http://${ip}:${port}${path}`;
        try {
            const response = await axios_1.default.get(url, {
                headers: headers || {},
                timeout,
                responseType: 'text'
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to GET from device at ${url}: ${error.message}`);
        }
    }
}
exports.BaseDevice = BaseDevice;
//# sourceMappingURL=BaseDevice.js.map