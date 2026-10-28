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

import path from 'path';
import fs from 'fs';

import { isContentTypeSupported, getContentTypeError } from '../common/content-type';
import { type FileDownloadHeaders, type FileDownloadResult } from '../common/types';
import { parseUrlCredentials } from '../common/url';

/**
 * Result of a prepared HTTP request.
 */
interface RequestResult {
    /**
     * Response of the request.
     */
    response: Response;

    /**
     * URL that was passed to `fetch`, without the userinfo component.
     */
    url: string;
}

/**
 * Executes async request.
 *
 * Native `fetch` throws a `TypeError` when a URL contains credentials, so the
 * credentials are removed from the URL and sent in the `Authorization: Basic`
 * header instead.
 *
 * @param url Url.
 * @param method HTTP method.
 *
 * @returns Promise with the response and the sanitized request URL.
 *
 * @throws Error with the original error as `cause` if the request fails.
 */
const executeRequestAsync = async (url: string, method: 'GET' | 'HEAD'): Promise<RequestResult> => {
    const { url: sanitizedUrl, credentials } = parseUrlCredentials(url);
    const headers: Record<string, string> = {
        Pragma: 'no-cache',
    };

    if (credentials) {
        const userinfo = `${credentials.username}:${credentials.password}`;
        headers.Authorization = `Basic ${Buffer.from(userinfo).toString('base64')}`;
    }

    try {
        const response = await fetch(sanitizedUrl, {
            method,
            headers,
        });

        return { response, url: sanitizedUrl };
    } catch (error) {
        throw new Error(`Failed to request url '${sanitizedUrl}'`, { cause: error });
    }
};

/**
 * Downloads filter rules from external url.
 *
 * @param url Filter file absolute URL.
 * @returns A promise that returns file content and headers when resolved
 * and error if rejected.
 */
const getExternalFile = async (url: string): Promise<FileDownloadResult> => {
    const { response, url: sanitizedUrl } = await executeRequestAsync(url, 'GET');

    if (response.status !== 200) {
        throw new Error(`Response status for url ${sanitizedUrl} is invalid: ${response.status}`);
    }

    if (!isContentTypeSupported(response.headers.get('Content-Type'))) {
        throw getContentTypeError();
    }

    const content = await response.text();

    // Capture Last-Modified header
    const headers: FileDownloadHeaders = {};
    const lastModified = response.headers.get('Last-Modified');
    if (lastModified) {
        headers.lastModified = lastModified;
    }

    return {
        content,
        headers: Object.keys(headers).length > 0
            ? headers
            : undefined,
    };
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
        const { response } = await executeRequestAsync(url, 'HEAD');

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
