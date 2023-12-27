/* eslint-disable no-console */
import express from 'express';
import path from 'path';
import { Server } from 'http';

const app = express();
let serverInstance: Server;

// Use Express.js static middleware to serve static files
const root = path.resolve(__dirname, '../fixtures');
app.use('/fixtures', express.static(root));

/**
 * Start server.
 * @param port Port to listen.
 */
const start = (port = 3000): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
        try {
            serverInstance = app.listen(port, () => {
                console.log(`Server is running at http://localhost:${port}`);
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

const server = { start, stop };
export { server };
