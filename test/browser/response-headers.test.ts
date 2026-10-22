import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';

import { getExternalFile, getLocalFile } from '../../src/browser/file-download-wrapper';
import { type FileDownloadResult } from '../../src/common/types';

const NETWORK_URL = 'https://example.org/filters/filter.txt';
const LOCAL_URL = 'file:///filters/filter.txt';
const LAST_MODIFIED = 'Wed, 2 Jan 2026 07:28:00 GMT';
const FILTER_CONTENT = '||example.com^';

type UrlKind = 'network' | 'local';

const URL_KINDS: UrlKind[] = ['network', 'local'];

/**
 * Returns the url for the given url kind.
 *
 * @param kind Url kind.
 *
 * @returns Network or local url.
 */
const urlFor = (kind: UrlKind): string => (kind === 'network' ? NETWORK_URL : LOCAL_URL);

type HeaderMap = Record<string, string>;

/**
 * Looks up a header value case-insensitively, like the Headers API does.
 *
 * @param headers Response headers.
 * @param name Header name.
 *
 * @returns Header value or null if the header is absent.
 */
const findHeader = (headers: HeaderMap, name: string): string | null => {
    const key = Object.keys(headers).find((headerName) => headerName.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : null;
};

interface FetchResponseStub {
    status: number;
    url: string;
    headers: {
        get: ReturnType<typeof vi.fn>;
    };
    text: ReturnType<typeof vi.fn>;
}

/**
 * Stubs the global fetch with a successful response.
 *
 * @param responseUrl Value of the response url.
 * @param headers Response headers.
 *
 * @returns The stubbed response.
 */
const stubFetch = (responseUrl: string, headers: HeaderMap): FetchResponseStub => {
    const response: FetchResponseStub = {
        status: 200,
        url: responseUrl,
        headers: {
            get: vi.fn((name: string) => findHeader(headers, name)),
        },
        text: vi.fn(async () => FILTER_CONTENT),
    };

    vi.stubGlobal('fetch', vi.fn(async () => response));

    return response;
};

interface XhrConfig {
    responseUrl: string;
    status?: number;
    headers?: HeaderMap;
    /**
     * Header whose getter throws, emulating a broken response object.
     */
    throwingHeader?: string;
}

interface XhrStub {
    request: {
        onload: (() => void) | null;
        getResponseHeader: ReturnType<typeof vi.fn>;
    };
    getResponseHeader: ReturnType<typeof vi.fn>;
}

/**
 * Stubs the global XMLHttpRequest with a successful response.
 *
 * @param config Stub configuration.
 *
 * @returns The stub instance and its header getter.
 */
const stubXhr = (config: XhrConfig): XhrStub => {
    const headers = config.headers ?? {};
    const getResponseHeader = vi.fn((name: string): string | null => {
        if (name === config.throwingHeader) {
            throw new Error(`Failed to read the ${name} header`);
        }
        return findHeader(headers, name);
    });

    const request = {
        status: config.status ?? 200,
        statusText: '',
        responseURL: config.responseUrl,
        responseText: FILTER_CONTENT,
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        ontimeout: null as (() => void) | null,
        mozBackgroundRequest: false,
        getResponseHeader,
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        overrideMimeType: vi.fn(),
        send: (): void => {
            // Dispatch asynchronously, like a real XMLHttpRequest, so that errors
            // escaping the load handler are not caught by the request setup code.
            setTimeout(() => {
                request.onload?.();
            }, 0);
        },
    };

    // A function expression used as a constructor returns the request object,
    // so `new XMLHttpRequest()` yields the stub instance.
    const FakeXMLHttpRequest = function fakeXmlHttpRequest(): typeof request {
        return request;
    };

    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);

    return { request, getResponseHeader };
};

describe('getResponseHeaders via fetch', () => {
    beforeEach(() => {
        // Force getLocalFile() to use the fetch path.
        vi.stubGlobal('XMLHttpRequest', undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const request = (kind: UrlKind): Promise<FileDownloadResult> => (
        kind === 'network' ? getExternalFile(urlFor(kind)) : getLocalFile(urlFor(kind))
    );

    it.each(URL_KINDS)('handles an unsupported content type for a %s url', async (kind) => {
        stubFetch(urlFor(kind), { 'Content-Type': 'application/json' });

        if (kind === 'network') {
            await expect(request(kind)).rejects.toThrow('Response content type should be one of');
        } else {
            await expect(request(kind)).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: undefined,
            });
        }
    });

    it.each(URL_KINDS)('captures Last-Modified only for a %s url', async (kind) => {
        stubFetch(urlFor(kind), {
            'Content-Type': 'text/plain',
            'Last-Modified': LAST_MODIFIED,
        });

        const result = await request(kind);

        if (kind === 'network') {
            expect(result.headers).toEqual({ lastModified: LAST_MODIFIED });
        } else {
            expect(result.headers).toBeUndefined();
        }
    });

    it('returns undefined headers for a network url without Last-Modified', async () => {
        stubFetch(NETWORK_URL, { 'Content-Type': 'text/plain' });

        const result = await getExternalFile(NETWORK_URL);

        expect(result).toEqual({
            content: FILTER_CONTENT,
            headers: undefined,
        });
    });

    it('does not read any header for a local url', async () => {
        const response = stubFetch(LOCAL_URL, {
            'Content-Type': 'application/json',
            'Last-Modified': LAST_MODIFIED,
        });

        await getLocalFile(LOCAL_URL);

        expect(response.headers.get).not.toHaveBeenCalled();
    });
});

describe('getResponseHeaders via XMLHttpRequest', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it.each(URL_KINDS)('handles an unsupported content type for a %s url', async (kind) => {
        const { getResponseHeader } = stubXhr({
            responseUrl: urlFor(kind),
            headers: { 'Content-Type': 'application/json' },
        });

        if (kind === 'network') {
            await expect(getLocalFile(urlFor(kind))).rejects.toThrow('Response content type should be one of');
        } else {
            await expect(getLocalFile(urlFor(kind))).resolves.toEqual({
                content: FILTER_CONTENT,
                headers: undefined,
            });
            expect(getResponseHeader).not.toHaveBeenCalled();
        }
    });

    it.each(URL_KINDS)('captures Last-Modified only for a %s url', async (kind) => {
        stubXhr({
            responseUrl: urlFor(kind),
            headers: {
                'Content-Type': 'text/plain',
                'Last-Modified': LAST_MODIFIED,
            },
        });

        const result = await getLocalFile(urlFor(kind));

        if (kind === 'network') {
            expect(result.headers).toEqual({ lastModified: LAST_MODIFIED });
        } else {
            expect(result.headers).toBeUndefined();
        }
    });

    it('returns undefined headers for a network url without Last-Modified', async () => {
        stubXhr({
            responseUrl: NETWORK_URL,
            headers: { 'Content-Type': 'text/plain' },
        });

        const result = await getLocalFile(NETWORK_URL);

        expect(result).toEqual({
            content: FILTER_CONTENT,
            headers: undefined,
        });
    });

    it('rejects instead of throwing when a header getter throws', async () => {
        const { getResponseHeader } = stubXhr({
            responseUrl: NETWORK_URL,
            headers: { 'Content-Type': 'text/plain' },
            throwingHeader: 'Last-Modified',
        });

        const promise = getLocalFile(NETWORK_URL);

        await expect(promise).rejects.toThrow('Failed to read the Last-Modified header');
        // Content-Type and Last-Modified are read once each: the load handler
        // returns right after rejecting, so the promise is settled only once.
        expect(getResponseHeader).toHaveBeenCalledTimes(2);
        // Awaiting the already settled promise observes the same rejection.
        await expect(promise).rejects.toThrow('Failed to read the Last-Modified header');
    });

    it('rejects an invalid status before reading any header', async () => {
        const { getResponseHeader } = stubXhr({
            responseUrl: NETWORK_URL,
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });

        await expect(getLocalFile(NETWORK_URL)).rejects.toThrow(
            `Response status for url ${NETWORK_URL} is invalid: 500`,
        );
        expect(getResponseHeader).not.toHaveBeenCalled();
    });
});
