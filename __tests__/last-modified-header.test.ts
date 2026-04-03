import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from '@jest/globals';
import nock from 'nock';
import path from 'path';
import fs from 'fs/promises';

import { FiltersDownloader } from '../src';
import { server } from './server';

const TEST_HOST = 'http://example.org';
const TEST_PATH = '/filter.txt';
const TEST_URL = `${TEST_HOST}${TEST_PATH}`;

const FILTER_WITH_TIME_UPDATED = [
    '! Title: Test Filter',
    '! TimeUpdated: 2026-01-01T12:00:00.000Z',
    '||example.com^',
].join('\n');

const FILTER_WITHOUT_TIME_UPDATED = [
    '! Title: Test Filter Without TimeUpdated',
    '||example.com^',
].join('\n');

const LAST_MODIFIED_DATE = 'Wed, 2 Jan 2026 07:28:00 GMT';

describe('Last-Modified header in DownloadResult', () => {
    beforeAll(() => {
        nock.disableNetConnect();
    });

    afterAll(() => {
        nock.enableNetConnect();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('downloadWithRaw', () => {
        it('should include Last-Modified header in result when server returns it', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, FILTER_WITHOUT_TIME_UPDATED, {
                    'Content-Type': 'text/plain',
                    'Last-Modified': LAST_MODIFIED_DATE,
                });

            const result = await FiltersDownloader.downloadWithRaw(TEST_URL, {
                force: true,
                verbose: false,
            });

            expect(result.headers).toBeDefined();
            expect(result.headers?.lastModified).toBe(LAST_MODIFIED_DATE);
        });

        it('should have undefined headers when server does not return Last-Modified', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, FILTER_WITHOUT_TIME_UPDATED, {
                    'Content-Type': 'text/plain',
                });

            const result = await FiltersDownloader.downloadWithRaw(TEST_URL, {
                force: true,
                verbose: false,
            });

            expect(result.headers).toBeUndefined();
        });

        it('should include Last-Modified header when filter has TimeUpdated metadata', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, FILTER_WITH_TIME_UPDATED, {
                    'Content-Type': 'text/plain',
                    'Last-Modified': LAST_MODIFIED_DATE,
                });

            const result = await FiltersDownloader.downloadWithRaw(TEST_URL, {
                force: true,
                verbose: false,
            });

            expect(result.headers?.lastModified).toBe(LAST_MODIFIED_DATE);
        });

        it('should preserve filter content alongside headers', async () => {
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, FILTER_WITHOUT_TIME_UPDATED, {
                    'Content-Type': 'text/plain',
                    'Last-Modified': LAST_MODIFIED_DATE,
                });

            const result = await FiltersDownloader.downloadWithRaw(TEST_URL, {
                force: true,
                verbose: false,
            });

            expect(result.filter).toBeDefined();
            expect(result.rawFilter).toBeDefined();
            expect(result.filter.length).toBeGreaterThan(0);
            expect(result.headers?.lastModified).toBe(LAST_MODIFIED_DATE);
        });

        it('should include Last-Modified header on full-download fallback when no Diff-Path exists', async () => {
            // When rawFilter is provided but the filter has no Diff-Path, applyPatch returns null,
            // so downloadAndProcess (full download) is called — headers are populated from the response.
            nock(TEST_HOST)
                .get(TEST_PATH)
                .reply(200, FILTER_WITHOUT_TIME_UPDATED, {
                    'Content-Type': 'text/plain',
                    'Last-Modified': LAST_MODIFIED_DATE,
                });

            const result = await FiltersDownloader.downloadWithRaw(TEST_URL, {
                force: false,
                verbose: false,
                rawFilter: FILTER_WITHOUT_TIME_UPDATED,
            });

            // applyPatch returns null (no Diff-Path) → falls through to downloadAndProcess → headers populated
            expect(result.headers?.lastModified).toBe(LAST_MODIFIED_DATE);
        });
    });
});

describe('Last-Modified header during successful patch-update', () => {
    beforeAll(async () => {
        await server.start();
    });

    afterAll(async () => {
        await server.stop();
    });

    it('should fetch headers via separate HEAD request when patch is successfully applied', async () => {
        const basePath = server.baseUrl();
        const url = new URL('./fixtures/01_simple/filter.txt', basePath).toString();
        const prevFilter = await fs.readFile(
            path.resolve(__dirname, './fixtures/01_simple/filter_v1.0.0.txt'),
            'utf-8',
        );

        const result = await FiltersDownloader.downloadWithRaw(url, { rawFilter: prevFilter });

        // Patch was applied successfully — rawFilter should differ from the previous version
        expect(result.rawFilter).not.toEqual(prevFilter);
        // Headers should be populated from the separate HEAD request
        expect(result.headers).toBeDefined();
        expect(result.headers?.lastModified).toBeDefined();
    });
});
