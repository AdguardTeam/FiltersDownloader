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

/* global require */
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
    "use strict";

    /**
     * Executes async request
     *
     * @param url Url
     * @param contentType Content type
     * @returns {Promise}
     */
    const executeRequestAsync = (url, contentType) => {
        return axios({
            method: 'get',
            url: encodeURI(url),
            headers: {
                'Content-type': contentType,
                'Pragma': 'no-cache'
            }
        });
    };

    /**
     * Downloads filter rules from external url
     *
     * @param {string} url Filter file absolute URL or relative path
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const getExternalFile = (url) => {
        return executeRequestAsync(url, 'text/plain').then((response) => {
            if (response.status !== 200 && response.status !== 0) {
                throw new Error("Response status is invalid: " + response.status);
            }

            const responseText = response.responseText ? response.responseText : response.data;

            if (!responseText) {
                throw new Error("Response is empty");
            }

            const lines = responseText.trim().split(/[\r\n]+/);
            return Promise.resolve(lines);
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
        getLocalFile: getLocalFile,
        getExternalFile: getExternalFile
    }
})();