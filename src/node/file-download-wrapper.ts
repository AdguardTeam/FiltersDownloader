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
 * @returns A promise that returns {string} with rules when if resolved and
 * {Error} if rejected.
 */
const getExternalFile = (url: string): Promise<string[]> => {
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

                const responseText = response.responseText ? response.responseText : response.data;

                const lines = responseText
                    .trim()
                    .split(/[\r\n]+/);

                resolve(lines);
            }).catch((err) => {
                reject(err);
            });
    });
};

/**
 * Get filter rules from local path.
 *
 * @param url Local path.
 * @param filterUrlOrigin Origin path.
 * @returns A promise that returns {string} with rules when if resolved and
 * {Error} if rejected.
 */
const getLocalFile = (url: string, filterUrlOrigin: string): Promise<string[]> => {
    const file = fs.readFileSync(path.resolve(filterUrlOrigin, url)).toString();
    const lines = file.trim().split(/[\r\n]+/);
    return Promise.resolve(lines);
};

export {
    getLocalFile,
    getExternalFile,
};
