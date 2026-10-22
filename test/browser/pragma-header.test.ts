import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
} from 'vitest';

import { PREFERRED_CONTENT_TYPE } from '../../src/common/content-type';
import {
    getExternalFile,
    getExternalFileHeaders,
    getLocalFile,
} from '../../src/browser/file-download-wrapper';

const TEST_URL = 'https://example.org/filter.txt';
const LOCAL_URL = 'file:///filter.txt';
const FILTER_CONTENT = '||example.com^';
const LAST_MODIFIED = 'Wed, 2 Jan 2026 07:28:00 GMT';

interface XhrStub {
    data?: unknown;
    open: () => void;
    setRequestHeader: () => void;
    overrideMimeType: () => void;
    getResponseHeader: () => string | null;
    send: () => void;
    status: number;
    responseText: string;
    responseURL: string;
    onload: ((event: ProgressEvent) => void) | null;
}

/**
 * Creates a mocked fetch response.
 *
 * @param status Response status.
 * @param url Response URL.
 * @param headers Response headers.
 * @param body Response body.
 *
 * @returns Mocked response object.
 */
const createFetchResponse = (
    status: number,
    url: string,
    headers: Record<string, string>,
    body = '',
): Response => ({
    status,
    url,
    headers: new Headers(headers),
    text: () => Promise.resolve(body),
} as unknown as Response);

describe('browser file download wrapper: Pragma header', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('should not send Pragma in the fetch GET request', async () => {
        fetchMock.mockResolvedValue(createFetchResponse(200, TEST_URL, {
            'Content-Type': PREFERRED_CONTENT_TYPE,
        }, FILTER_CONTENT));

        const result = await getExternalFile(TEST_URL);

        expect(result.content).toBe(FILTER_CONTENT);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(TEST_URL);
        expect(options.cache).toBe('no-cache');
        expect(options.headers).toStrictEqual({ 'Content-Type': PREFERRED_CONTENT_TYPE });
        expect(options.headers).not.toHaveProperty('Pragma');
    });

    it('should not send Pragma or a headers option in the HEAD request', async () => {
        fetchMock.mockResolvedValue(createFetchResponse(200, TEST_URL, {
            'Last-Modified': LAST_MODIFIED,
        }));

        const headers = await getExternalFileHeaders(TEST_URL);

        expect(headers).toStrictEqual({ lastModified: LAST_MODIFIED });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe(TEST_URL);
        expect(options.method).toBe('HEAD');
        expect(options.cache).toBe('no-cache');
        expect(options).not.toHaveProperty('headers');
    });

    it('should not call setRequestHeader and should keep overrideMimeType in XHR', async () => {
        const setRequestHeader = vi.fn();
        const overrideMimeType = vi.fn();

        /**
         * Creates a mocked XMLHttpRequest that loads the local filter content.
         *
         * @returns Mocked XMLHttpRequest instance.
         */
        function MockXhr(): XMLHttpRequest {
            const instance: XhrStub = {
                open: vi.fn(),
                setRequestHeader,
                overrideMimeType,
                getResponseHeader: (): null => null,
                send: (): void => {
                    instance.status = 200;
                    instance.responseText = FILTER_CONTENT;
                    instance.responseURL = LOCAL_URL;
                    instance.onload?.({} as ProgressEvent);
                },
                status: 200,
                responseText: FILTER_CONTENT,
                responseURL: LOCAL_URL,
                onload: null,
            };

            return instance as unknown as XMLHttpRequest;
        }

        vi.stubGlobal('XMLHttpRequest', vi.fn(MockXhr));

        const result = await getLocalFile(LOCAL_URL);

        expect(result.content).toBe(FILTER_CONTENT);
        expect(setRequestHeader).not.toHaveBeenCalled();
        expect(overrideMimeType).toHaveBeenCalledWith(PREFERRED_CONTENT_TYPE);
    });
});
