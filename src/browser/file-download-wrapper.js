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

/**
 * As it is not possible to use one library in node and browser environments,
 * we have to implementation of simple file download interface.
 * The one for node uses axios, the one for browser XMLHttpRequest.
 *
 * @type {{getLocalFile, getExternalFile}}
 */
module.exports = (() => {
    'use strict';

    /**
     * If url protocol is not http or https return true, else false
     * @param url
     * @returns {boolean}
     */
    const isLocal = (url) => {
        const parsedUrl = new URL(url);
        const protocols = ['http:', 'https:'];
        return !protocols.includes(parsedUrl.protocol);
    };

    /**
     * Executes async request via fetch
     * fetch doesn't allow to download urls with file:// scheme
     *
     * @param url Url
     * @param contentType Content type
     * @returns {Promise}
     */
    const executeRequestAsyncFetch = async (url, contentType) => {
        const response = await fetch(url, {
            cache: 'no-cache',
            headers: {
                Pragma: 'no-cache',
                'Content-Type': contentType,
            }
        });

        if (response.status !== 200 && response.status !== 0) {
            throw new Error(`Response status for url ${url} is invalid: ${response.status}`);
        }

        // Don't check response headers if url is local,
        // because edge extension doesn't provide headers for such url
        if (!isLocal(response.url)) {
            const responseContentType = response.headers.get('Content-Type');
            if (!responseContentType || !responseContentType.includes(contentType)) {
                throw new Error(`Response content type should be: "${contentType}"`);
            }
        }

        const responseText = await response.text();

        return responseText.trim().split(/[\r\n]+/);
    };

    /**
     * Executes async request via XMLHttpRequest
     * XMLHttpRequest is undefined in the service worker
     *
     * @param {string} url Url
     * @param {string} contentType Content type
     * @returns {Promise}
     */
    const executeRequestAsyncXhr = (url, contentType) => {
        return new Promise((resolve, reject) => {
            const onRequestLoad = (response) => {
                if (response.status !== 200 && response.status !== 0) {
                    reject(new Error(`Response status for url ${url} is invalid: ${response.status}`));
                }

                const responseText = response.responseText ? response.responseText : response.data;

                // Don't check response headers if url is local,
                // because edge extension doesn't provide headers for such url
                if (!isLocal(response.responseURL)) {
                    const responseContentType = response.getResponseHeader('Content-Type');
                    if (!responseContentType || !responseContentType.includes(contentType)) {
                        reject(new Error(`Response content type should be: "${contentType}"`));
                    }
                }
                const lines = responseText.trim().split(/[\r\n]+/);
                resolve(lines);
            };

            const request = new XMLHttpRequest();

            try {
                request.open('GET', url);
                request.setRequestHeader('Pragma', 'no-cache');
                request.overrideMimeType(contentType);
                request.mozBackgroundRequest = true;
                request.onload = function () {
                    onRequestLoad(request);
                };
                request.onerror = () => reject(new Error(`Request error happened: ${request.statusText || 'status text empty'}`));
                request.onabort = () => reject(new Error(`Request was aborted with status text: ${request.statusText}`));
                request.ontimeout = () => reject(new Error(`Request timed out with status text: ${request.statusText}`));

                request.send(null);
            } catch (ex) {
                reject(ex);
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
        return executeRequestAsyncFetch(url, 'text/plain');
    };

    /**
     * Get filter rules from local path
     *
     * @param {string} url local path
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const getLocalFile = (url) => {
        if (typeof XMLHttpRequest !== 'undefined') {
            return executeRequestAsyncXhr(url, 'text/plain');
        }
        if (typeof fetch !== 'undefined') {
            return executeRequestAsyncFetch(url, 'text/plain');
        }
        throw new Error('XMLHttpRequest or fetch are undefined, getting local files inside service worker is not working');
    };

    return {
        getLocalFile: getLocalFile,
        getExternalFile: getExternalFile,
    };
})();
