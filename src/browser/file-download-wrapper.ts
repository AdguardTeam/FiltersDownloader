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
 * Set of network protocols. A URL with one of these protocols is a network URL.
 */
const networkProtocols = new Set(['http:', 'https:']);

/**
 * URL types used to decide which response headers are available.
 */
type UrlType = 'local' | 'network' | 'unknown';

/**
 * Classifies a URL as local, network, or unknown.
 *
 * A URL is local when its protocol is not http or https.
 * A URL is network when its protocol is http or https.
 * An empty or unparseable URL is unknown.
 *
 * @param url URL address to check.
 *
 * @returns URL type.
 */
const getUrlType = (url: string): UrlType => {
    try {
        const parsedUrl = new URL(url);
        return networkProtocols.has(parsedUrl.protocol) ? 'network' : 'local';
    } catch {
        return 'unknown';
    }
};

/**
 * Delay before the single retry attempt for an external file download, in milliseconds.
 */
const EXTERNAL_FILE_RETRY_DELAY_MS = 1000;

/**
 * Error thrown when a network request fails.
 */
class NetworkError extends Error {
    /**
     * Creates a network error.
     *
     * @param url URL that failed to download.
     * @param cause Original error.
     */
    constructor(url: string, cause: unknown) {
        super(`Network error while downloading '${url}'`, { cause });
        this.name = 'NetworkError';
    }
}

/**
 * Returns the message of an error, unwrapping the cause of a `NetworkError`.
 *
 * @param error Error to read.
 *
 * @returns Error message.
 */
const getErrorMessage = (error: unknown): string => {
    const originalError = error instanceof NetworkError ? error.cause : error;
    return originalError instanceof Error ? originalError.message : String(originalError);
};

/**
 * Reads response headers and validates the content type.
 *
 * Headers are ignored for local urls, because the edge extension doesn't
 * provide headers for such urls.
 *
 * @param getHeader Returns the value of the response header by name.
 * @param url Response url.
 *
 * @returns Captured headers, or undefined if the url is local or
 * the Last-Modified header is absent.
 *
 * @throws Error if the response content type is not supported.
 */
const getResponseHeaders = (
    getHeader: (name: string) => string | null,
    url: string,
): FileDownloadHeaders | undefined => {
    const urlType = getUrlType(url);

    // A local URL may not provide headers, e.g. in the edge extension.
    if (urlType === 'local') {
        return undefined;
    }

    // An unknown URL can come from an XHR wrapper that hides the response URL.
    // Check the Content-Type only when the header is available.
    const responseContentType = getHeader('Content-Type');
    const shouldCheckContentType = urlType === 'network'
        || (urlType === 'unknown' && responseContentType !== null);
    if (shouldCheckContentType && !isContentTypeSupported(responseContentType)) {
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
    let response: Response;
    try {
        response = await fetch(url, {
            cache: 'no-cache',
        });
    } catch (error) {
        throw new NetworkError(url, error);
    }

    if (response.status !== 200 && response.status !== 0) {
        throw new Error(`Response status for url ${url} is invalid: ${response.status}`);
    }

    const headers = getResponseHeaders(
        (name) => response.headers.get(name),
        response.url,
    );

    let content: string;
    try {
        content = await response.text();
    } catch (error) {
        throw new NetworkError(url, error);
    }

    return { content, headers };
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
        try {
            if (response.status !== 200 && response.status !== 0) {
                reject(new Error(`Response status for url ${url} is invalid: ${response.status}`));
                return;
            }

            const content = response.responseText
                ? response.responseText
                // @ts-ignore
                : response.data;

            const headers = getResponseHeaders(
                (name) => response.getResponseHeader(name),
                response.responseURL,
            );

            resolve({ content, headers });
        } catch (error) {
            reject(error);
        }
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
 * Retries the download once after a `NetworkError`. Only failures of the
 * network calls are treated as network errors. Errors for an invalid HTTP
 * status or an unsupported content type are propagated immediately.
 *
 * @param url Filter file absolute URL or relative path.
 * @returns A promise that returns file content and headers when resolved
 * and error if rejected.
 */
const getExternalFile = async (url: string): Promise<FileDownloadResult> => {
    let firstError: unknown;

    try {
        return await executeRequestAsyncFetch(url);
    } catch (error) {
        if (!(error instanceof NetworkError)) {
            throw error;
        }
        firstError = error.cause;
    }

    await new Promise<void>((resolve) => {
        setTimeout(resolve, EXTERNAL_FILE_RETRY_DELAY_MS);
    });

    try {
        return await executeRequestAsyncFetch(url);
    } catch (retryError) {
        const firstMessage = getErrorMessage(firstError);
        const retryMessage = getErrorMessage(retryError);
        const errorMessage = retryMessage === firstMessage
            ? firstMessage
            : `${firstMessage}. Retry error: ${retryMessage}`;

        throw new Error(
            `Failed to request url '${url}' after retry: ${errorMessage}`,
            { cause: firstError },
        );
    }
};

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
    EXTERNAL_FILE_RETRY_DELAY_MS,
    getLocalFile,
    getExternalFile,
    getExternalFileHeaders,
};
