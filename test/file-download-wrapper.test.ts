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
} from '../src/browser/file-download-wrapper';

const TEST_URL = 'https://example.org/filter.txt';

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
        configurable: true,
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

    it('should resolve on the first attempt without scheduling a retry', async () => {
        const fetchMock = vi.fn().mockResolvedValue(createResponse('filter content'));
        vi.stubGlobal('fetch', fetchMock);

        const result = await getExternalFile(TEST_URL);

        expect(result.content).toBe('filter content');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('should retry once and resolve when the first attempt fails with a network error', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(createResponse('filter content'));
        vi.stubGlobal('fetch', fetchMock);

        const promise = getExternalFile(TEST_URL);
        await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);
        const result = await promise;

        expect(result.content).toBe('filter content');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should preserve the Last-Modified header when the retry succeeds', async () => {
        const lastModified = 'Wed, 21 Oct 2015 07:28:00 GMT';
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(createResponse('filter content', {
                headers: {
                    'Content-Type': 'text/plain',
                    'Last-Modified': lastModified,
                },
            }));
        vi.stubGlobal('fetch', fetchMock);

        const promise = getExternalFile(TEST_URL);
        await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);
        const result = await promise;

        expect(result.headers?.lastModified).toBe(lastModified);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should report both errors when both attempts fail with a network error', async () => {
        const firstError = new TypeError('Failed to fetch');
        const retryError = new TypeError('Failed to fetch again');
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(firstError)
            .mockRejectedValueOnce(retryError);
        vi.stubGlobal('fetch', fetchMock);

        const promise = getExternalFile(TEST_URL);
        const assertion = expect(promise).rejects.toThrow(
            `Failed to request url '${TEST_URL}' after retry: `
            + 'Failed to fetch. Retry error: Failed to fetch again',
        );
        await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);
        await assertion;

        await expect(promise).rejects.toMatchObject({ cause: firstError });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should include a non-network retry error in the failure message', async () => {
        const firstError = new TypeError('Failed to fetch');
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(firstError)
            .mockResolvedValueOnce(createResponse('', { status: 500 }));
        vi.stubGlobal('fetch', fetchMock);

        const promise = getExternalFile(TEST_URL);
        const assertion = expect(promise).rejects.toThrow(
            `Failed to request url '${TEST_URL}' after retry: `
            + `Failed to fetch. Retry error: Response status for url ${TEST_URL} is invalid: 500`,
        );
        await vi.advanceTimersByTimeAsync(EXTERNAL_FILE_RETRY_DELAY_MS);
        await assertion;

        await expect(promise).rejects.toMatchObject({ cause: firstError });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should not retry a TypeError that is not a network error', async () => {
        const response = createResponse('filter content');
        Object.defineProperty(response, 'url', { value: '' });
        const fetchMock = vi.fn().mockResolvedValue(response);
        vi.stubGlobal('fetch', fetchMock);

        await expect(getExternalFile(TEST_URL)).rejects.toThrow(TypeError);

        expect(fetchMock).toHaveBeenCalledTimes(1);
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
