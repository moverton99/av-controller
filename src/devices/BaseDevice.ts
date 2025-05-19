import axios, { AxiosRequestHeaders } from 'axios';

export type DeviceActionResult = {
    status: 'success' | 'fail' | 'no-reply';
    message?: string;
    data?: any;
};

export class BaseDevice {
    async powerOn(): Promise<DeviceActionResult> {
        throw new Error('powerOn() not implemented');
    }

    async powerOff(): Promise<DeviceActionResult> {
        throw new Error('powerOff() not implemented');
    }

    async getPowerState(): Promise<'on' | 'off' | 'unknown'> {
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
    protected async postToDevice(
        ip: string,
        path: string,
        payload: string,
        port: number = 80,
        headers?: AxiosRequestHeaders,
        timeout: number = 2000
    ): Promise<string> {
        const url = `http://${ip}:${port}${path}`;
        try {
            const response = await axios.post(url, payload, {
                headers: headers || { 'Content-Type': 'application/xml' },
                timeout,
                responseType: 'text'
            });
            return response.data;
        } catch (error: any) {
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
    protected async getFromDevice(
        ip: string,
        path: string,
        port: number = 80,
        headers?: AxiosRequestHeaders,
        timeout: number = 2000
    ): Promise<string> {
        const url = `http://${ip}:${port}${path}`;
        try {
            const response = await axios.get(url, {
                headers: headers || {},
                timeout,
                responseType: 'text'
            });
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to GET from device at ${url}: ${error.message}`);
        }
    }
}