import { Readable } from 'stream';

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
const CREDENTIALS_URL = `http://user:password@example.org${TEST_PATH}`;
const FILTER_CONTENT = '||example.com^';
const LAST_MODIFIED = 'Wed, 2 Jan 2026 07:28:00 GMT';

/**
 * Builds the value of the `Authorization` header for the given credentials.
 *
 * @param userinfo Decoded `username:password` pair.
 *
 * @returns Value of the `Authorization: Basic` header.
 */
const basicAuth = (userinfo: string): string => `Basic ${Buffer.from(userinfo).toString('base64')}`;

const CREDENTIALS_CASES = [
    {
        name: 'plain credentials',
        url: CREDENTIALS_URL,
        authorization: basicAuth('user:password'),
    },
    {
        name: 'percent-encoded credentials',
        url: `http://user%40name:p%40ss@example.org${TEST_PATH}`,
        authorization: basicAuth('user@name:p@ss'),
    },
    {
        name: 'malformed percent-encoding',
        url: `http://user%zz:password@example.org${TEST_PATH}`,
        authorization: basicAuth('user%zz:password'),
    },
];

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

        it.each(CREDENTIALS_CASES)('sends $name in the Authorization header', async ({
            url,
            authorization,
        }) => {
            let requestPath = '';
            const scope = nock(TEST_HOST)
                .get(TEST_PATH)
                .matchHeader('Authorization', authorization)
                .reply(function reply(this: nock.ReplyFnContext): nock.ReplyFnResult {
                    requestPath = this.req.path;
                    return [200, FILTER_CONTENT, { 'Content-Type': 'text/plain' }];
                });

            const result = await getExternalFile(url);

            expect(result.content).toBe(FILTER_CONTENT);
            expect(requestPath).toBe(TEST_PATH);
            expect(scope.isDone()).toBe(true);
        });

        it('does not send credentials when a backslash ends the authority', async () => {
            let requestHeaders: Record<string, string> = {};
            const scope = nock(TEST_HOST)
                .get('/@evil.example/filter.txt')
                .reply(function reply(this: nock.ReplyFnContext): nock.ReplyFnResult {
                    requestHeaders = this.req.headers;
                    return [200, FILTER_CONTENT, { 'Content-Type': 'text/plain' }];
                });

            // For http(s) the backslash ends the authority, so `example.org` is
            // the host, not userinfo, and the request must go to it.
            await getExternalFile('http://example.org\\@evil.example/filter.txt');

            expect(requestHeaders.authorization).toBeUndefined();
            expect(scope.isDone()).toBe(true);
        });

        it('does not leak credentials when the URL cannot be parsed', async () => {
            const error = await getExternalFile('//user:password@example.org/filter.txt')
                .catch((e: Error) => e);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message)
                .toBe("Failed to request url '//example.org/filter.txt'");
            expect((error as Error).message).not.toContain('password');
        });

        it('does not send the Authorization header when the URL has no credentials', async () => {
            let requestHeaders: Record<string, string> = {};

            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(function reply(this: nock.ReplyFnContext): nock.ReplyFnResult {
                    requestHeaders = this.req.headers;
                    return [200, FILTER_CONTENT, { 'Content-Type': 'text/plain' }];
                });

            await getExternalFile(TEST_URL);

            expect(requestHeaders.authorization).toBeUndefined();
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

        it('does not include credentials in the error message', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(500, 'error', { 'Content-Type': 'text/plain' });

            await expect(getExternalFile(CREDENTIALS_URL))
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

        it.each([
            { name: 'a url without credentials', url: TEST_URL },
            { name: 'a url with credentials', url: CREDENTIALS_URL },
        ])('reports the sanitized url when reading the body fails for $name', async ({ url }) => {
            const body = new Readable({
                read(): void {
                    this.push(FILTER_CONTENT);
                    this.destroy(new Error('terminated'));
                },
            });

            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, body, { 'Content-Type': 'text/plain' });

            const error = await getExternalFile(url).catch((e: Error) => e);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe(`Failed to request url '${TEST_URL}'`);
            expect((error as Error).cause).toBeInstanceOf(Error);
            expect(((error as Error).cause as Error).message).toBe('terminated');
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

        it('sends the credentials from the URL in the Authorization header', async () => {
            const scope = nock(TEST_HOST)
                .head(TEST_PATH)
                .matchHeader('Authorization', basicAuth('user:password'))
                .reply(200, undefined, { 'Last-Modified': LAST_MODIFIED });

            const headers = await getExternalFileHeaders(CREDENTIALS_URL);

            expect(headers).toEqual({ lastModified: LAST_MODIFIED });
            expect(scope.isDone()).toBe(true);
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
