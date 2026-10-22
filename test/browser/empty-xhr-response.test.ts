import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { getLocalFile } from '../../src/browser/file-download-wrapper';
import { FiltersDownloader } from '../../src/index.browser';

/**
 * Response values used by the XMLHttpRequest stub.
 */
type XhrResponseStub = {
    responseText?: string;
    data?: unknown;
    status?: number;
    statusText?: string;
    responseURL?: string;
};

let xhrResponse: XhrResponseStub = {};

/**
 * Minimal XMLHttpRequest stub which resolves synchronously on `send()`.
 *
 * The stub keeps an explicitly passed `responseText: undefined` value and
 * uses an empty string only when the `responseText` key is absent.
 */
class MockXMLHttpRequest {
    /**
     * Creates a stub instance with the response configured in `xhrResponse`.
     */
    public constructor() {
        Object.assign(this, {
            responseText: 'responseText' in xhrResponse ? xhrResponse.responseText : '',
            data: xhrResponse.data,
            status: xhrResponse.status ?? 200,
            statusText: xhrResponse.statusText ?? '',
            responseURL: xhrResponse.responseURL ?? 'file:///empty.txt',
            open: (): void => {},
            setRequestHeader: (): void => {},
            overrideMimeType: (): void => {},
            getResponseHeader: (): null => null,
            send: (): void => {
                const { onload } = this as { onload?: () => void };
                onload?.();
            },
        });
    }
}

describe('empty XMLHttpRequest response', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        xhrResponse = {};
    });

    it('returns an empty string when responseText is empty', async () => {
        xhrResponse = {
            responseText: '',
            responseURL: 'file:///empty.txt',
        };
        vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);

        const result = await getLocalFile('file:///empty.txt');

        expect(result.content).toBe('');
    });

    it('falls back to response.data when responseText is undefined', async () => {
        const data = 'content from wrapped xhr';
        xhrResponse = {
            responseText: undefined,
            data,
            responseURL: 'file:///wrapped.txt',
        };
        vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);

        const result = await getLocalFile('file:///wrapped.txt');

        expect(result.content).toBe(data);
    });

    it('downloads an empty local file through the browser entry point', async () => {
        xhrResponse = {
            responseText: '',
            responseURL: 'file:///empty.txt',
        };
        vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest);

        const result = await FiltersDownloader.download(
            'file:///empty.txt',
            {},
            { allowEmptyResponse: true },
        );

        expect(result).toEqual(['']);
    });
});
