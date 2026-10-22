import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';
import nock from 'nock';

import { getExternalFile, getExternalFileHeaders } from '../../src/node/file-download-wrapper';

const TEST_HOST = 'http://example.org';
const TEST_PATH = '/filter.txt';
const TEST_URL = `${TEST_HOST}${TEST_PATH}`;
const FILTER_CONTENT = '||example.com^';
const LAST_MODIFIED = 'Wed, 2 Jan 2026 07:28:00 GMT';

describe('Node file download wrapper', () => {
    beforeAll(() => {
        nock.disableNetConnect();
    });

    afterAll(() => {
        nock.enableNetConnect();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('getExternalFile', () => {
        it('returns content and Last-Modified header', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, FILTER_CONTENT, {
                    'Content-Type': 'text/plain',
                    'Last-Modified': LAST_MODIFIED,
                });

            const result = await getExternalFile(TEST_URL);

            expect(result).toEqual({
                content: FILTER_CONTENT,
                headers: { lastModified: LAST_MODIFIED },
            });
        });

        it('returns JSON-like content as a string', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, '[1, 2]', { 'Content-Type': 'text/plain' });

            const result = await getExternalFile(TEST_URL);

            expect(result.content).toBe('[1, 2]');
        });

        it('sends the Pragma: no-cache header', async () => {
            const scope = nock(TEST_HOST)
                .get(TEST_PATH)
                .matchHeader('Pragma', 'no-cache')
                .reply(200, FILTER_CONTENT, { 'Content-Type': 'text/plain' });

            await getExternalFile(TEST_URL);

            expect(scope.isDone()).toBe(true);
        });

        it('rejects on a non-200 status', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(500, 'error', { 'Content-Type': 'text/plain' });

            await expect(getExternalFile(TEST_URL))
                .rejects.toThrow(`Response status for url ${TEST_URL} is invalid: 500`);
        });

        it('rejects on an unsupported content type', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, '{}', { 'Content-Type': 'application/json' });

            await expect(getExternalFile(TEST_URL))
                .rejects.toThrow('Response content type should be one of');
        });

        it('rejects with the original error as cause when the request fails', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .replyWithError('connection refused');

            const error = await getExternalFile(TEST_URL).catch((e: Error) => e);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe(`Failed to request url '${TEST_URL}'`);
            expect((error as Error).cause).toBeDefined();
        });
    });

    describe('getExternalFileHeaders', () => {
        it('returns Last-Modified from a HEAD request', async () => {
            nock(TEST_HOST)
                .head(TEST_PATH)
                .reply(200, undefined, { 'Last-Modified': LAST_MODIFIED });

            const headers = await getExternalFileHeaders(TEST_URL);

            expect(headers).toEqual({ lastModified: LAST_MODIFIED });
        });

        it('returns undefined on a non-200 status', async () => {
            nock(TEST_HOST)
                .head(TEST_PATH)
                .reply(404, undefined, { 'Last-Modified': LAST_MODIFIED });

            const headers = await getExternalFileHeaders(TEST_URL);

            expect(headers).toBeUndefined();
        });

        it('returns undefined when the request fails', async () => {
            nock(TEST_HOST)
                .head(TEST_PATH)
                .replyWithError('connection refused');

            const headers = await getExternalFileHeaders(TEST_URL);

            expect(headers).toBeUndefined();
        });
    });
});
