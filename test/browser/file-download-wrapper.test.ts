import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    EXTERNAL_FILE_RETRY_DELAY_MS,
    getExternalFile,
    getLocalFile,
} from '../../src/browser/file-download-wrapper';
import { type FileDownloadHeaders } from '../../src/common/types';

const NETWORK_URL = 'https://example.org/filter.txt';
const LOCAL_URL = 'file:///filters/filter.txt';
const EMPTY_URL = '';
const INVALID_URL = 'not a valid url';
const FILTER_CONTENT = '||example.com^';
const SUPPORTED_CONTENT_TYPE = 'text/plain';
const UNSUPPORTED_CONTENT_TYPE = 'application/json';
const LAST_MODIFIED = 'Wed, 2 Jan 2026 07:28:00 GMT';

interface StubHeaders {
    /**
     * Value of the Content-Type header.
     */
    contentType: string | null;
    /**
     * Value of the Last-Modified header.
     */
    lastModified: string | null;
}

interface FetchResponseStub {
    status: number;
    url: string;
    headers: {
        get: (header: string) => string | null;
    };
    text: () => Promise<string>;
}

interface XhrStub extends Partial<XMLHttpRequest> {
    onload: (() => void) | null;
    onerror: (() => void) | null;
    onabort: (() => void) | null;
    ontimeout: (() => void) | null;
}

interface ResolveCase {
    name: string;
    responseUrl: string;
    contentType: string | null;
    lastModified: string | null;
    expectedHeaders: FileDownloadHeaders | undefined;
}

interface RejectCase {
    name: string;
    responseUrl: string;
    contentType: string;
}

/**
 * Returns a response header value from the stub header values.
 *
 * @param header Header name.
 * @param headers Header values.
 *
 * @returns Header value or null.
 */
const getStubHeader = (
    header: string,
    headers: StubHeaders,
): string | null => {
    switch (header.toLowerCase()) {
        case 'content-type':
            return headers.contentType;
        case 'last-modified':
            return headers.lastModified;
        default:
            return null;
    }
};

/**
 * Creates a successful fetch response stub.
 *
 * @param responseUrl Value of the response URL.
 * @param contentType Value of the Content-Type header.
 * @param lastModified Value of the Last-Modified header.
 *
 * @returns Fetch response stub.
 */
const createFetchResponse = (
    responseUrl: string,
    contentType: string | null = SUPPORTED_CONTENT_TYPE,
    lastModified: string | null = null,
): FetchResponseStub => ({
    status: 200,
    url: responseUrl,
    headers: {
        get: (header): string | null => getStubHeader(header, { contentType, lastModified }),
    },
    text: async (): Promise<string> => FILTER_CONTENT,
});

/**
 * Creates a mock XMLHttpRequest constructor.
 *
 * @param responseUrl Value of the response URL.
 * @param contentType Value of the Content-Type header.
 * @param lastModified Value of the Last-Modified header.
 *
 * @returns Mock XMLHttpRequest constructor.
 */
const createXhrConstructor = (
    responseUrl: string,
    contentType: string | null = SUPPORTED_CONTENT_TYPE,
    lastModified: string | null = null,
): ReturnType<typeof vi.fn> => {
    /**
     * Creates a stub XMLHttpRequest instance.
     *
     * @returns XMLHttpRequest stub.
     */
    function MockXMLHttpRequest(): XhrStub {
        const xhr: XhrStub = {
            status: 200,
            statusText: '',
            responseURL: responseUrl,
            responseText: FILTER_CONTENT,
            onload: null,
            onerror: null,
            onabort: null,
            ontimeout: null,
            open: (): void => {},
            setRequestHeader: (): void => {},
            overrideMimeType: (): void => {},
            getResponseHeader: (header: string): string | null => getStubHeader(header, {
                contentType,
                lastModified,
            }),
            send: (): void => {
                queueMicrotask(() => xhr.onload?.());
            },
        };

        return xhr;
    }

    return vi.fn(MockXMLHttpRequest);
};

const FETCH_RESOLVE_CASES: ResolveCase[] = [
    {
        name: 'the response URL is empty',
        responseUrl: EMPTY_URL,
        contentType: SUPPORTED_CONTENT_TYPE,
        lastModified: null,
        expectedHeaders: undefined,
    },
    {
        name: 'the response URL cannot be parsed',
        responseUrl: INVALID_URL,
        contentType: SUPPORTED_CONTENT_TYPE,
        lastModified: null,
        expectedHeaders: undefined,
    },
    {
        name: 'the response URL is empty and Content-Type is missing',
        responseUrl: EMPTY_URL,
        contentType: null,
        lastModified: null,
        expectedHeaders: undefined,
    },
    {
        name: 'the response URL cannot be parsed and Content-Type is missing',
        responseUrl: INVALID_URL,
        contentType: null,
        lastModified: null,
        expectedHeaders: undefined,
    },
    {
        name: 'the response URL is a network URL and Last-Modified is present',
        responseUrl: NETWORK_URL,
        contentType: SUPPORTED_CONTENT_TYPE,
        lastModified: LAST_MODIFIED,
        expectedHeaders: { lastModified: LAST_MODIFIED },
    },
    {
        name: 'the response URL is unknown and Last-Modified is present',
        responseUrl: EMPTY_URL,
        contentType: SUPPORTED_CONTENT_TYPE,
        lastModified: LAST_MODIFIED,
        expectedHeaders: { lastModified: LAST_MODIFIED },
    },
];

const FETCH_REJECT_CASES: RejectCase[] = [
    {
        name: 'the response URL is a network URL and Content-Type is unsupported',
        responseUrl: NETWORK_URL,
        contentType: UNSUPPORTED_CONTENT_TYPE,
    },
    {
        name: 'the response URL is unknown and Content-Type is unsupported',
        responseUrl: EMPTY_URL,
        contentType: UNSUPPORTED_CONTENT_TYPE,
    },
];

const XHR_RESOLVE_CASES: ResolveCase[] = [
    ...FETCH_RESOLVE_CASES,
    {
        name: 'the response URL is a local file URL',
        responseUrl: LOCAL_URL,
        contentType: null,
        lastModified: LAST_MODIFIED,
        expectedHeaders: undefined,
    },
    {
        name: 'the response URL is a local file URL and Content-Type is unsupported',
        responseUrl: LOCAL_URL,
        contentType: UNSUPPORTED_CONTENT_TYPE,
        lastModified: null,
        expectedHeaders: undefined,
    },
];

const XHR_REJECT_CASES: RejectCase[] = [
    {
        name: 'the response URL is a network URL and Content-Type is unsupported',
        responseUrl: NETWORK_URL,
        contentType: UNSUPPORTED_CONTENT_TYPE,
    },
    {
        name: 'the response URL is unknown and Content-Type is unsupported',
        responseUrl: EMPTY_URL,
        contentType: UNSUPPORTED_CONTENT_TYPE,
    },
];

describe('browser file download wrapper', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('fetch path', () => {
        it.each(FETCH_RESOLVE_CASES)('should resolve when $name', async ({
            responseUrl,
            contentType,
            lastModified,
            expectedHeaders,
        }) => {
            const fetchMock = vi.fn().mockResolvedValue(
                createFetchResponse(responseUrl, contentType, lastModified),
            );
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(NETWORK_URL)).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: expectedHeaders,
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should skip header checks for a local file URL', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                createFetchResponse(LOCAL_URL, UNSUPPORTED_CONTENT_TYPE, LAST_MODIFIED),
            );
            vi.stubGlobal('fetch', fetchMock);
            vi.stubGlobal('XMLHttpRequest', undefined);

            await expect(getLocalFile(LOCAL_URL)).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: undefined,
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it.each(FETCH_REJECT_CASES)('should reject when $name', async ({
            responseUrl,
            contentType,
        }) => {
            const fetchMock = vi.fn().mockResolvedValue(
                createFetchResponse(responseUrl, contentType),
            );
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(NETWORK_URL)).rejects.toThrow(
                'Response content type should be one of',
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('retry after a network error', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should resolve on the first attempt without scheduling a retry', async () => {
            const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(NETWORK_URL));
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(NETWORK_URL)).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: undefined,
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(vi.getTimerCount()).toBe(0);
        });

        it('should retry once and resolve when the first fetch rejects', async () => {
            const fetchMock = vi.fn()
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce(createFetchResponse(NETWORK_URL));
            vi.stubGlobal('fetch', fetchMock);

            const promise = getExternalFile(NETWORK_URL);
            await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);

            await expect(promise).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: undefined,
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should not start the retry before the delay when the response body fails', async () => {
            const firstResponse = createFetchResponse(NETWORK_URL);
            firstResponse.text = vi.fn().mockRejectedValueOnce(
                new TypeError('Failed to read response body'),
            );
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(firstResponse)
                .mockResolvedValueOnce(createFetchResponse(NETWORK_URL));
            vi.stubGlobal('fetch', fetchMock);

            const promise = getExternalFile(NETWORK_URL);
            await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS - 1);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(1);
            await expect(promise).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: undefined,
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should preserve the Last-Modified header when the retry succeeds', async () => {
            const fetchMock = vi.fn()
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce(createFetchResponse(
                    NETWORK_URL,
                    SUPPORTED_CONTENT_TYPE,
                    LAST_MODIFIED,
                ));
            vi.stubGlobal('fetch', fetchMock);

            const promise = getExternalFile(NETWORK_URL);
            await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);

            await expect(promise).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: { lastModified: LAST_MODIFIED },
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should report both errors when both attempts fail', async () => {
            const firstError = new TypeError('Failed to fetch');
            const retryError = new TypeError('Failed to fetch again');
            const fetchMock = vi.fn()
                .mockRejectedValueOnce(firstError)
                .mockRejectedValueOnce(retryError);
            vi.stubGlobal('fetch', fetchMock);

            const promise = getExternalFile(NETWORK_URL);
            const assertion = expect(promise).rejects.toThrow(
                `Failed to request url '${NETWORK_URL}' after retry: `
                + 'Failed to fetch. Retry error: Failed to fetch again',
            );
            await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);
            await assertion;

            await expect(promise).rejects.toMatchObject({ cause: firstError });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should include a non-network retry error in the failure message', async () => {
            const firstError = new TypeError('Failed to fetch');
            const retryResponse = createFetchResponse(NETWORK_URL);
            retryResponse.status = 500;
            const fetchMock = vi.fn()
                .mockRejectedValueOnce(firstError)
                .mockResolvedValueOnce(retryResponse);
            vi.stubGlobal('fetch', fetchMock);

            const promise = getExternalFile(NETWORK_URL);
            const assertion = expect(promise).rejects.toThrow(
                `Failed to request url '${NETWORK_URL}' after retry: `
                + `Failed to fetch. Retry error: Response status for url ${NETWORK_URL} is invalid: 500`,
            );
            await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);
            await assertion;

            await expect(promise).rejects.toMatchObject({ cause: firstError });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should not retry a non-network error', async () => {
            const response = createFetchResponse(NETWORK_URL);
            response.headers.get = (): string | null => {
                throw new Error('Response headers are not available');
            };
            const fetchMock = vi.fn().mockResolvedValue(response);
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(NETWORK_URL)).rejects.toThrow(
                'Response headers are not available',
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should not retry an invalid HTTP status', async () => {
            const response = createFetchResponse(NETWORK_URL);
            response.status = 500;
            const fetchMock = vi.fn().mockResolvedValue(response);
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(NETWORK_URL)).rejects.toThrow(
                'Response status for url',
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should not retry an unsupported content type', async () => {
            const fetchMock = vi.fn().mockResolvedValue(
                createFetchResponse(NETWORK_URL, UNSUPPORTED_CONTENT_TYPE),
            );
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(NETWORK_URL)).rejects.toThrow(
                'Response content type should be one of',
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('XHR path', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected fetch call')));
        });

        it.each(XHR_RESOLVE_CASES)('should resolve when $name', async ({
            responseUrl,
            contentType,
            lastModified,
            expectedHeaders,
        }) => {
            const xhrConstructor = createXhrConstructor(responseUrl, contentType, lastModified);
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            await expect(getLocalFile(LOCAL_URL)).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: expectedHeaders,
            });
            expect(xhrConstructor).toHaveBeenCalledTimes(1);
        });

        it.each(XHR_REJECT_CASES)('should reject when $name', async ({
            responseUrl,
            contentType,
        }) => {
            const xhrConstructor = createXhrConstructor(responseUrl, contentType);
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            await expect(getLocalFile(LOCAL_URL)).rejects.toThrow(
                'Response content type should be one of',
            );
            expect(xhrConstructor).toHaveBeenCalledTimes(1);
        });

        it('should reject when the load handler throws', async () => {
            const xhrConstructor = createXhrConstructor(LOCAL_URL);
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            const promise = getLocalFile(LOCAL_URL);
            const xhr = xhrConstructor.mock.results[0].value as XhrStub;
            xhr.getResponseHeader = (): string | null => {
                throw new Error('Header access failed');
            };

            await expect(promise).rejects.toThrow('Header access failed');
        });
    });
});
