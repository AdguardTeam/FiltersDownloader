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
import {
    isContentTypeSupported,
    getContentTypeError,
    PREFERRED_CONTENT_TYPE,
} from '../common/content-type';

/**
 * Set of network protocols. Used to check if url is local.
 */
const networkProtocols = new Set(['http:', 'https:']);

/**
 * If url protocol is not http or https return true, else false.
 *
 * @param url URL address to check.
 *
 * @returns Tue if provided address is local.
 */
const isLocal = (url: string): boolean => {
    const parsedUrl = new URL(url);
    return !networkProtocols.has(parsedUrl.protocol);
};

/**
 * Executes async request via fetch.
 * Fetch doesn't allow downloading urls with file:// scheme.
 *
 * @param url URL.
 *
 * @returns Promise which will be resolved with string content of request
 * divided by '/r?/n'.
 */
const executeRequestAsyncFetch = async (url: string): Promise<string> => {
    const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
            Pragma: 'no-cache',
            'Content-Type': PREFERRED_CONTENT_TYPE,
        },
    });

    if (response.status !== 200 && response.status !== 0) {
        throw new Error(`Response status for url ${url} is invalid: ${response.status}`);
    }

    // Don't check response headers if url is local,
    // because the edge extension doesn't provide headers for such url
    if (!isLocal(response.url)) {
        const responseContentType = response.headers.get('Content-Type');
        if (!isContentTypeSupported(responseContentType)) {
            throw getContentTypeError();
        }
    }

    return response.text();
};

/**
 * Executes an asynchronous XMLHttpRequest to retrieve the content of a file
 * from the given URL.
 *
 * @param url The URL of the file to retrieve.
 * @returns A Promise that resolves to a string representing data from the file.
 * @throws Throws an error if the response status is invalid,
 * the Content-Type is unsupported, or if there's an error during the request.
 */
const executeRequestAsyncXhr = (url: string): Promise<string> => new Promise((resolve, reject) => {
    const onRequestLoad = (response: XMLHttpRequest): void => {
        if (response.status !== 200 && response.status !== 0) {
            reject(new Error(`Response status for url ${url} is invalid: ${response.status}`));
        }

        const responseText = response.responseText
            ? response.responseText
            // @ts-ignore
            : response.data;

        // Don't check response headers if url is local,
        // because the edge extension doesn't provide headers for such url
        if (!isLocal(response.responseURL)) {
            const responseContentType = response.getResponseHeader('Content-Type');
            if (!isContentTypeSupported(responseContentType)) {
                reject(getContentTypeError());
            }
        }

        resolve(responseText);
    };

    const request = new XMLHttpRequest();

    try {
        request.open('GET', url);
        request.setRequestHeader('Pragma', 'no-cache');
        request.overrideMimeType(PREFERRED_CONTENT_TYPE);
        // @ts-ignore
        request.mozBackgroundRequest = true;
        // eslint-disable-next-line func-names
        request.onload = (): void => {
            onRequestLoad(request);
        };
        request.onerror = (): void => reject(
            new Error(`Request error happened: ${request.statusText || 'status text empty'}`),
        );
        request.onabort = (): void => reject(
            new Error(`Request was aborted with status text: ${request.statusText}`),
        );
        request.ontimeout = (): void => reject(
            new Error(`Request timed out with status text: ${request.statusText}`),
        );

        request.send(null);
    } catch (ex) {
        reject(ex);
    }
});

/**
 * Downloads filter rules from external url.
 *
 * @param url Filter file absolute URL or relative path.
 * @returns A promise that returns string of rules when resolved
 * and error if rejected.
 */
const getExternalFile = (url: string): Promise<string> => executeRequestAsyncFetch(url);

/**
 * Retrieves a local file content asynchronously using XMLHttpRequest or fetch API.
 *
 * @param url The URL of the local file to retrieve.
 * @returns A Promise that resolves to string representing the content of the file.
 * @throws Throws an error if neither XMLHttpRequest nor fetch is available or
 * if getting local files inside a service worker is not supported.
 */
const getLocalFile = (url: string): Promise<string> => {
    if (typeof XMLHttpRequest !== 'undefined') {
        return executeRequestAsyncXhr(url);
    }
    if (typeof fetch !== 'undefined') {
        return executeRequestAsyncFetch(url);
    }
    throw new Error('XMLHttpRequest or fetch are undefined, getting local files inside service worker is not working');
};

export {
    getLocalFile,
    getExternalFile,
};
