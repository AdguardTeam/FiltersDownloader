/**
 * This file is part of AdGuard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * AdGuard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdGuard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with AdGuard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

import axios from 'axios';
import path from 'path';
import fs from 'fs';

import { isContentTypeSupported, getContentTypeError } from '../common/content-type';
import { type FileDownloadHeaders, type FileDownloadResult } from '../common/types';

/**
 * Executes async request.
 *
 * @param url Url.
 *
 * @returns Promise with request.
 */
const executeRequestAsync = (url: string): Promise<any> => axios({
    method: 'get',
    url,
    headers: {
        Pragma: 'no-cache',
    },
    validateStatus: null,
});

/**
 * Downloads filter rules from external url.
 *
 * @param url Filter file absolute URL or relative path.
 * @returns A promise that returns file content and headers when resolved
 * and error if rejected.
 */
const getExternalFile = (url: string): Promise<FileDownloadResult> => {
    return new Promise((resolve, reject) => {
        executeRequestAsync(url)
            .then((response) => {
                if (response.status !== 200 && response.status !== 0) {
                    reject(new Error(`Response status for url ${url} is invalid: ${response.status}`));
                }

                const responseContentType = response.headers['content-type'];

                if (!isContentTypeSupported(responseContentType)) {
                    reject(getContentTypeError());
                }

                const content = response.responseText ? response.responseText : response.data;

                // Capture Last-Modified header
                const headers: FileDownloadHeaders = {};
                const lastModified = response.headers['last-modified'];
                if (lastModified) {
                    headers.lastModified = lastModified;
                }

                resolve({
                    content,
                    headers: Object.keys(headers).length > 0
                        ? headers
                        : undefined,
                });
            }).catch((error) => {
                const updatedError = new Error(`Failed to request url '${url}'`, { cause: error });
                reject(updatedError);
            });
    });
};

/**
 * Get filter rules from the local path.
 *
 * @param url Local path.
 * @returns A promise that returns file content and headers when resolved
 * and error if rejected.
 */
const getLocalFile = async (url: string): Promise<FileDownloadResult> => {
    const content = await fs.promises.readFile(path.resolve(url), 'utf-8');
    return {
        content,
        headers: undefined,
    };
};

/**
 * Fetches only the HTTP response headers for the given URL via a HEAD request.
 *
 * @param url Filter file absolute URL.
 *
 * @returns A promise that resolves with the headers, or undefined if unavailable.
 */
const getExternalFileHeaders = async (url: string): Promise<FileDownloadHeaders | undefined> => {
    try {
        const response = await axios({
            method: 'head',
            url,
            headers: {
                Pragma: 'no-cache',
            },
            validateStatus: null,
        });

        if (response.status !== 200) {
            return undefined;
        }

        const lastModified = response.headers['last-modified'];
        if (lastModified) {
            return { lastModified };
        }
    } catch {
        // Silently return undefined if the HEAD request fails.
    }

    return undefined;
};

export {
    getLocalFile,
    getExternalFile,
    getExternalFileHeaders,
};
