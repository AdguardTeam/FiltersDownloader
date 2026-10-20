import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import nock from 'nock';

import { getExternalFile, getLocalFile } from '../src/browser/file-download-wrapper';

const TEST_URL = 'https://example.org/filter.txt';
const LOCAL_URL = 'file:///filters/filter.txt';
const FILTER_CONTENT = '||example.com^';
const SUPPORTED_CONTENT_TYPE = 'text/plain';
const LAST_MODIFIED = 'Wed, 2 Jan 2026 07:28:00 GMT';

interface FetchResponseStub {
    status: number;
    url: string;
    headers: {
        get: (header: string) => string | null;
    };
    text: () => Promise<string>;
}

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
        get: (header: string): string | null => {
            switch (header.toLowerCase()) {
                case 'content-type':
                    return contentType;
                case 'last-modified':
                    return lastModified;
                default:
                    return null;
            }
        },
    },
    text: async (): Promise<string> => FILTER_CONTENT,
});

/**
 * Creates a successful XMLHttpRequest stub.
 *
 * @param responseUrl Value of the response URL.
 * @param contentType Value of the Content-Type header.
 * @param lastModified Value of the Last-Modified header.
 *
 * @returns Partial XMLHttpRequest stub.
 */
const createMockXhr = (
    responseUrl: string,
    contentType: string | null = SUPPORTED_CONTENT_TYPE,
    lastModified: string | null = null,
): Partial<XMLHttpRequest> => {
    const xhr = {
        status: 200,
        statusText: '',
        responseURL: responseUrl,
        responseText: FILTER_CONTENT,
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        ontimeout: null as (() => void) | null,
        open: (): void => {},
        setRequestHeader: (): void => {},
        overrideMimeType: (): void => {},
        getResponseHeader: (header: string): string | null => {
            switch (header.toLowerCase()) {
                case 'content-type':
                    return contentType;
                case 'last-modified':
                    return lastModified;
                default:
                    return null;
            }
        },
        send: (): void => {
            xhr.onload?.();
        },
    };

    return xhr;
};

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
     * @returns Partial XMLHttpRequest stub.
     */
    function MockXMLHttpRequest(): Partial<XMLHttpRequest> {
        return createMockXhr(responseUrl, contentType, lastModified);
    }

    return vi.fn(MockXMLHttpRequest);
};

const EXPECTED_RESULT = {
    content: FILTER_CONTENT,
    headers: undefined,
};

describe('browser file download wrapper with an invalid response URL', () => {
    beforeAll(() => {
        nock.disableNetConnect();
    });

    afterAll(() => {
        nock.enableNetConnect();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('fetch path', () => {
        it('should resolve when the response URL is empty', async () => {
            const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(''));
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith(TEST_URL, expect.any(Object));
        });

        it('should resolve when the response URL cannot be parsed', async () => {
            const fetchMock = vi.fn().mockResolvedValue(createFetchResponse('not a valid url'));
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should resolve when the response URL is empty and Content-Type is missing', async () => {
            const fetchMock = vi.fn().mockResolvedValue(createFetchResponse('', null));
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should resolve when the response URL cannot be parsed and Content-Type is missing', async () => {
            const fetchMock = vi.fn().mockResolvedValue(createFetchResponse('not a valid url', null));
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should skip header checks for a local file URL', async () => {
            const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(LOCAL_URL, null, LAST_MODIFIED));
            vi.stubGlobal('fetch', fetchMock);

            await expect(getExternalFile(LOCAL_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('XHR path', () => {
        it('should resolve when the response URL is empty', async () => {
            const xhrConstructor = createXhrConstructor('');
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            await expect(getLocalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(xhrConstructor).toHaveBeenCalledTimes(1);
        });

        it('should resolve when the response URL cannot be parsed', async () => {
            const xhrConstructor = createXhrConstructor('not a valid url');
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            await expect(getLocalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(xhrConstructor).toHaveBeenCalledTimes(1);
        });

        it('should resolve when the response URL is empty and Content-Type is missing', async () => {
            const xhrConstructor = createXhrConstructor('', null);
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            await expect(getLocalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(xhrConstructor).toHaveBeenCalledTimes(1);
        });

        it('should resolve when the response URL cannot be parsed and Content-Type is missing', async () => {
            const xhrConstructor = createXhrConstructor('not a valid url', null);
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            await expect(getLocalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(xhrConstructor).toHaveBeenCalledTimes(1);
        });

        it('should skip header checks for a local file URL', async () => {
            const xhrConstructor = createXhrConstructor(LOCAL_URL, null, LAST_MODIFIED);
            vi.stubGlobal('XMLHttpRequest', xhrConstructor);

            await expect(getLocalFile(LOCAL_URL)).resolves.toEqual(EXPECTED_RESULT);
            expect(xhrConstructor).toHaveBeenCalledTimes(1);
        });
    });
});
