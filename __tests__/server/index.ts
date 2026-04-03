/* eslint-disable no-console */
import express from 'express';
import path from 'path';
import { type AddressInfo } from 'net';
import { type Server } from 'http';

const app = express();
let serverInstance: Server;

// Use Express.js static middleware to serve static files
const root = path.resolve(__dirname, '../fixtures');
app.use('/fixtures', express.static(root));

/**
 * Returns the base URL of the running server (e.g. "http://localhost:12345").
 *
 * @returns Base URL string.
 *
 * @throws Error if the server is not running.
 */
const baseUrl = (): string => {
    if (!serverInstance) {
        throw new Error('Server is not running');
    }
    const addr = serverInstance.address() as AddressInfo;
    return `http://localhost:${addr.port}`;
};

/**
 * Start server on a random available port.
 *
 * @param port Port to listen (0 = OS-assigned).
 */
const start = (port = 0): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        try {
            serverInstance = app.listen(port, () => {
                console.log(`Server is running at ${baseUrl()}`);
                resolve();
            });
        } catch (e) {
            reject(e);
        }
    });
};

/**
 * Stop server.
 */
const stop = (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        if (!serverInstance) {
            reject(new Error('Server is not running'));
        } else {
            serverInstance.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Server has been stopped');
                    resolve();
                }
            });
        }
    });
};

const server = { start, stop, baseUrl };
export { server };
