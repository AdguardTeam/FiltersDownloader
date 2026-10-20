import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { getExternalFile, getLocalFile } from '../src/browser/file-download-wrapper';

const TEST_URL = 'https://example.org/filter.txt';
const FILTER_CONTENT = '||example.com^';
const SUPPORTED_CONTENT_TYPE = 'text/plain';

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
 *
 * @returns Fetch response stub.
 */
const createFetchResponse = (responseUrl: string): FetchResponseStub => ({
    status: 200,
    url: responseUrl,
    headers: {
        get: (header: string): string | null => (
            header.toLowerCase() === 'content-type' ? SUPPORTED_CONTENT_TYPE : null
        ),
    },
    text: async (): Promise<string> => FILTER_CONTENT,
});

/**
 * Creates a successful XMLHttpRequest stub.
 *
 * @param responseUrl Value of the response URL.
 *
 * @returns XMLHttpRequest stub.
 */
const createMockXhr = (responseUrl: string): XMLHttpRequest => {
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
        getResponseHeader: (header: string): string | null => (
            header.toLowerCase() === 'content-type' ? SUPPORTED_CONTENT_TYPE : null
        ),
        send: (): void => {
            xhr.onload?.();
        },
    };

    return xhr as unknown as XMLHttpRequest;
};

/**
 * Creates an XMLHttpRequest constructor that returns a stub instance.
 *
 * @param responseUrl Value of the response URL.
 *
 * @returns XMLHttpRequest constructor.
 */
const createXhrConstructor = (responseUrl: string): typeof XMLHttpRequest => {
    const MockXMLHttpRequest = function MockXMLHttpRequest(): XMLHttpRequest {
        return createMockXhr(responseUrl);
    };

    return MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
};

const EXPECTED_RESULT = {
    content: FILTER_CONTENT,
    headers: undefined,
};

describe('browser file download wrapper with an invalid response URL', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('fetch path', () => {
        it('should resolve when the response URL is empty', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse('')));

            await expect(getExternalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
        });

        it('should resolve when the response URL cannot be parsed', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFetchResponse('not a valid url')));

            await expect(getExternalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
        });
    });

    describe('XHR path', () => {
        it('should resolve when the response URL is empty', async () => {
            vi.stubGlobal('XMLHttpRequest', createXhrConstructor(''));

            await expect(getLocalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
        });

        it('should resolve when the response URL cannot be parsed', async () => {
            vi.stubGlobal('XMLHttpRequest', createXhrConstructor('not a valid url'));

            await expect(getLocalFile(TEST_URL)).resolves.toEqual(EXPECTED_RESULT);
        });
    });
});
