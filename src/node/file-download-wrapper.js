/**
 * This file is part of Adguard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * Adguard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Adguard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');

/**
 * As it is not possible to use one library in node and browser environments,
 * we have to implementation of simple file download interface.
 * The one for node uses axios, the one for browser XMLHttpRequest.
 *
 * @type {{getLocalFile, getExternalFile}}
 */
module.exports = (() => {
    /**
     * Executes async request
     *
     * @param url Url
     * @returns {Promise}
     */
    const executeRequestAsync = (url) => axios({
        method: 'get',
        url,
        headers: {
            Pragma: 'no-cache',
        },
        validateStatus: null,
    });

    /**
     * Downloads filter rules from external url
     *
     * @param {string} url Filter file absolute URL or relative path
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const getExternalFile = (url) => {
        const contentType = 'text/plain';

        return new Promise((resolve, reject) => {
            executeRequestAsync(url).then((response) => {
                if (response.status !== 200 && response.status !== 0) {
                    reject(new Error(`Response status for url ${url} is invalid: ${response.status}`));
                }

                const responseContentType = response.headers['content-type'];
                if (!responseContentType || !responseContentType.includes(contentType)) {
                    reject(new Error(`Response content type should be: "${contentType}"`));
                }

                const responseText = response.responseText ? response.responseText : response.data;

                resolve(responseText.trim().split(/[\r\n]+/));
            }).catch((err) => {
                reject(err);
            });
        });
    };

    /**
     * Get filter rules from local path
     *
     * @param {string} url local path
     * @param {?string} filterUrlOrigin origin path
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const getLocalFile = (url, filterUrlOrigin) => {
        const file = fs.readFileSync(path.resolve(filterUrlOrigin, url)).toString();
        const lines = file.trim().split(/[\r\n]+/);
        return Promise.resolve(lines);
    };

    return {
        getLocalFile,
        getExternalFile,
    };
})();
