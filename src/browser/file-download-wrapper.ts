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
import { type FileDownloadHeaders, type FileDownloadResult } from '../common/types';

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
 * Extracts response headers from a file download response.
 *
 * Local URLs are not checked for a supported content type and do not provide
 * the Last-Modified header.
 *
 * @param getHeader Function that returns a response header value by name.
 * @param url Response URL.
 *
 * @returns Headers with the Last-Modified value, or undefined if the header is absent.
 *
 * @throws Error if the content type of a non-local URL is not supported.
 */
const getResponseHeaders = (
    getHeader: (name: string) => string | null,
    url: string,
): FileDownloadHeaders | undefined => {
    if (isLocal(url)) {
        return undefined;
    }

    const responseContentType = getHeader('Content-Type');
    if (!isContentTypeSupported(responseContentType)) {
        throw getContentTypeError();
    }

    const lastModified = getHeader('Last-Modified');
    if (lastModified) {
        return { lastModified };
    }

    return undefined;
};

/**
 * Executes async request via fetch.
 * Fetch doesn't allow downloading urls with file:// scheme.
 *
 * @param url URL.
 *
 * @returns Promise which will be resolved with file content and headers.
 */
const executeRequestAsyncFetch = async (url: string): Promise<FileDownloadResult> => {
    const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
            'Content-Type': PREFERRED_CONTENT_TYPE,
        },
    });

    if (response.status !== 200 && response.status !== 0) {
        throw new Error(`Response status for url ${url} is invalid: ${response.status}`);
    }

    // Don't check response headers if url is local,
    // because the edge extension doesn't provide headers for such url
    const headers = getResponseHeaders(
        (name) => response.headers.get(name),
        response.url,
    );

    const content = await response.text();

    return {
        content,
        headers,
    };
};

/**
 * Executes an asynchronous XMLHttpRequest to retrieve the content of a file
 * from the given URL.
 *
 * @param url The URL of the file to retrieve.
 * @returns A Promise that resolves to file content and headers.
 * @throws Throws an error if the response status is invalid,
 * the Content-Type is unsupported, or if there's an error during the request.
 */
const executeRequestAsyncXhr = (url: string): Promise<FileDownloadResult> => new Promise((resolve, reject) => {
    const onRequestLoad = (response: XMLHttpRequest): void => {
        if (response.status !== 200 && response.status !== 0) {
            reject(new Error(`Response status for url ${url} is invalid: ${response.status}`));
            return;
        }

        // @ts-ignore
        const content = response.responseText ?? response.data;

        let headers: FileDownloadHeaders | undefined;
        try {
            headers = getResponseHeaders(
                (name) => response.getResponseHeader(name),
                response.responseURL,
            );
        } catch (error) {
            reject(error);
            return;
        }

        resolve({
            content,
            headers,
        });
    };

    const request = new XMLHttpRequest();

    try {
        request.open('GET', url);
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
 * @returns A promise that returns file content and headers when resolved
 * and error if rejected.
 */
const getExternalFile = (url: string): Promise<FileDownloadResult> => executeRequestAsyncFetch(url);

/**
 * Retrieves a local file content asynchronously using XMLHttpRequest or fetch API.
 *
 * @param url The URL of the local file to retrieve.
 * @returns A Promise that resolves to file content and headers.
 * @throws Throws an error if neither XMLHttpRequest nor fetch is available or
 * if getting local files inside a service worker is not supported.
 */
const getLocalFile = (url: string): Promise<FileDownloadResult> => {
    if (typeof XMLHttpRequest !== 'undefined') {
        return executeRequestAsyncXhr(url);
    }
    if (typeof fetch !== 'undefined') {
        return executeRequestAsyncFetch(url);
    }
    throw new Error('XMLHttpRequest or fetch are undefined, getting local files inside service worker is not working');
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
        const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-cache',
        });

        if (response.status !== 200) {
            return undefined;
        }

        const lastModified = response.headers.get('Last-Modified');
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
