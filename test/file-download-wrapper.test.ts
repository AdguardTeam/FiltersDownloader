import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { getExternalFile } from '../src/browser/file-download-wrapper';

const TEST_URL = 'https://example.org/filter.txt';
const RETRY_DELAY_MS = 1000;

/**
 * Creates a response with a valid URL and content type.
 *
 * @param content Response body.
 * @param init Response options.
 *
 * @returns A response that is accepted by the download wrapper.
 */
const createResponse = (content: string, init?: ResponseInit): Response => {
    const response = new Response(content, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        ...init,
    });

    // The Response constructor does not accept a URL, but the wrapper reads it.
    Object.defineProperty(response, 'url', {
        value: TEST_URL,
    });

    return response;
};

describe('getExternalFile', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('should retry once and resolve when the first attempt fails with a network error', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(createResponse('filter content'));
        vi.stubGlobal('fetch', fetchMock);

        const promise = getExternalFile(TEST_URL);
        await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
        const result = await promise;

        expect(result.content).toBe('filter content');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should reject when both attempts fail with a network error', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'));
        vi.stubGlobal('fetch', fetchMock);

        const promise = getExternalFile(TEST_URL);
        const assertion = expect(promise).rejects.toThrow('Failed to fetch');
        await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
        await assertion;

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should not retry an invalid HTTP status', async () => {
        const fetchMock = vi.fn().mockResolvedValue(createResponse('', { status: 500 }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getExternalFile(TEST_URL)).rejects.toThrow('Response status for url');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should not retry an unsupported content type', async () => {
        const fetchMock = vi.fn().mockResolvedValue(createResponse('{}', {
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);

        await expect(getExternalFile(TEST_URL)).rejects.toThrow('Response content type should be one of');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
