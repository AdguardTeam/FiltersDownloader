import {
    afterEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest';

import {
    getExternalFileHeaders,
    getLocalFile,
} from '../../src/browser/file-download-wrapper';
import { FiltersDownloader } from '../../src/index.browser';
import { PREFERRED_CONTENT_TYPE } from '../../src/common/content-type';

const LOCAL_URL = 'file:///filter.txt';
const NETWORK_URL = 'https://example.com/filter.txt';
const LAST_MODIFIED = 'Wed, 2 Jan 2026 07:28:00 GMT';

interface FetchResponseOptions {
    url: string;
    status?: number;
    content?: string;
    headers?: Record<string, string>;
}

/**
 * Creates a partial fetch response for tests.
 *
 * @param options Response options.
 *
 * @returns Partial fetch response.
 */
const createFetchResponse = (options: FetchResponseOptions): Partial<Response> => ({
    status: options.status ?? 200,
    url: options.url,
    headers: new Headers(options.headers ?? {}),
    text: async (): Promise<string> => options.content ?? '',
});

/**
 * Stubs the global fetch function.
 *
 * @param response Response to return.
 *
 * @returns Fetch mock.
 */
const mockFetch = (response: Partial<Response>): Mock => {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
};

interface XhrOptions {
    responseText?: string;
    data?: unknown;
    responseURL?: string;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
}

interface XhrStub extends Partial<XMLHttpRequest> {
    data?: unknown;
}

interface XhrMock {
    open: Mock;
    setRequestHeader: Mock;
    overrideMimeType: Mock;
}

/**
 * Stubs the global XMLHttpRequest constructor.
 *
 * @param options XHR response options.
 *
 * @returns Mocked XHR methods.
 */
const mockXhr = (options: XhrOptions = {}): XhrMock => {
    const headerEntries = Object.entries(options.headers ?? {});
    const open = vi.fn();
    const setRequestHeader = vi.fn();
    const overrideMimeType = vi.fn();
    const send = vi.fn();

    const xhr: XhrStub = {
        status: options.status ?? 200,
        statusText: options.statusText ?? '',
        responseText: options.responseText ?? '',
        responseURL: options.responseURL ?? LOCAL_URL,
        data: options.data,
        open,
        setRequestHeader,
        overrideMimeType,
        send,
        getResponseHeader: (name: string): string | null => {
            const entry = headerEntries.find(([key]) => key.toLowerCase() === name.toLowerCase());
            return entry ? entry[1] : null;
        },
    };

    send.mockImplementation(() => {
        xhr.onload?.call(xhr as XMLHttpRequest, {} as ProgressEvent);
    });

    /**
     * Mock XMLHttpRequest constructor.
     *
     * @returns Mocked XHR instance.
     */
    function MockXMLHttpRequest(): XhrStub {
        return xhr;
    }

    vi.stubGlobal('XMLHttpRequest', vi.fn(MockXMLHttpRequest));

    return { open, setRequestHeader, overrideMimeType };
};

describe('browser file download wrapper', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('executeRequestAsyncFetch', () => {
        it('sends a GET request with no-cache and without the Pragma header', async () => {
            vi.stubGlobal('XMLHttpRequest', undefined);
            const fetchMock = mockFetch(createFetchResponse({
                url: LOCAL_URL,
                content: '||example.com^',
            }));

            const result = await getLocalFile(LOCAL_URL);

            expect(result).toEqual({ content: '||example.com^', headers: undefined });
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(requestUrl).toBe(LOCAL_URL);
            expect(requestOptions.cache).toBe('no-cache');
            expect(requestOptions.headers).toEqual({ 'Content-Type': PREFERRED_CONTENT_TYPE });
            expect(requestOptions.headers).not.toHaveProperty('Pragma');
        });
    });

    describe('getExternalFileHeaders', () => {
        it('sends a HEAD request with no-cache and without the Pragma header', async () => {
            const fetchMock = mockFetch(createFetchResponse({
                url: NETWORK_URL,
                headers: { 'Last-Modified': LAST_MODIFIED },
            }));

            const result = await getExternalFileHeaders(NETWORK_URL);

            expect(result).toEqual({ lastModified: LAST_MODIFIED });

            const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(requestUrl).toBe(NETWORK_URL);
            expect(requestOptions.method).toBe('HEAD');
            expect(requestOptions.cache).toBe('no-cache');
            expect(requestOptions.headers).toBeUndefined();
        });
    });

    describe('executeRequestAsyncXhr', () => {
        it('does not set the Pragma header and keeps overrideMimeType', async () => {
            const { open, setRequestHeader, overrideMimeType } = mockXhr({
                responseText: '||example.com^',
            });

            const result = await getLocalFile(LOCAL_URL);

            expect(result).toEqual({ content: '||example.com^', headers: undefined });
            expect(open).toHaveBeenCalledWith('GET', LOCAL_URL);
            expect(setRequestHeader).not.toHaveBeenCalled();
            expect(overrideMimeType).toHaveBeenCalledWith(PREFERRED_CONTENT_TYPE);
        });

        it('returns an empty string when responseText is empty', async () => {
            mockXhr({
                responseText: '',
                data: undefined,
            });

            const result = await getLocalFile(LOCAL_URL);

            expect(result.content).toBe('');
            expect(result.headers).toBeUndefined();
        });

        it('rejects when the response Content-Type is unsupported for a network URL', async () => {
            mockXhr({
                responseURL: NETWORK_URL,
                headers: { 'Content-Type': 'application/json' },
            });

            await expect(getLocalFile(NETWORK_URL)).rejects.toThrow(
                'Response content type should be one of',
            );
        });

        it('captures Last-Modified for a network URL', async () => {
            mockXhr({
                responseURL: NETWORK_URL,
                headers: {
                    'Content-Type': PREFERRED_CONTENT_TYPE,
                    'Last-Modified': LAST_MODIFIED,
                },
            });

            await expect(getLocalFile(NETWORK_URL)).resolves.toEqual({
                content: '',
                headers: { lastModified: LAST_MODIFIED },
            });
        });

        it('resolves the browser entry point with empty content when allowEmptyResponse is true', async () => {
            mockXhr({
                responseText: '',
                data: undefined,
                responseURL: 'file:///empty.txt',
            });

            const result = await FiltersDownloader.download(
                'file:///empty.txt',
                {},
                { allowEmptyResponse: true },
            );

            expect(result.join('').trim()).toBe('');
        });
    });

    describe('getResponseHeaders', () => {
        it.each([
            { label: 'network URL', responseUrl: NETWORK_URL, shouldReject: true },
            { label: 'local URL', responseUrl: LOCAL_URL, shouldReject: false },
        ])('checks the Content-Type for a $label', async ({ responseUrl, shouldReject }) => {
            vi.stubGlobal('XMLHttpRequest', undefined);
            mockFetch(createFetchResponse({
                url: responseUrl,
                headers: { 'Content-Type': 'application/json' },
            }));

            const request = getLocalFile(LOCAL_URL);

            if (shouldReject) {
                await expect(request).rejects.toThrow('Response content type should be one of');
            } else {
                await expect(request).resolves.toEqual({ content: '', headers: undefined });
            }
        });

        it.each([
            {
                label: 'network URL',
                responseUrl: NETWORK_URL,
                expectedHeaders: { lastModified: LAST_MODIFIED },
            },
            {
                label: 'local URL',
                responseUrl: LOCAL_URL,
                expectedHeaders: undefined,
            },
        ])('captures Last-Modified only for a $label', async ({ responseUrl, expectedHeaders }) => {
            vi.stubGlobal('XMLHttpRequest', undefined);
            mockFetch(createFetchResponse({
                url: responseUrl,
                headers: {
                    'Content-Type': PREFERRED_CONTENT_TYPE,
                    'Last-Modified': LAST_MODIFIED,
                },
            }));

            const result = await getLocalFile(LOCAL_URL);

            expect(result.headers).toEqual(expectedHeaders);
        });
    });
});
