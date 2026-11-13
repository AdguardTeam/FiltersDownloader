import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import nock from 'nock';
import mockFs from 'mock-fs';

import { FiltersDownloader } from '../src';
import { server } from './server';
import { mergeErrorDetails } from '../src/helpers/logger';

const FilterCompilerConditionsConstants = {
    adguard: true,
    adguard_ext_chromium: true,
    adguard_ext_firefox: false,
    adguard_ext_edge: false,
    adguard_ext_safari: false,
    adguard_ext_opera: false,
    adguard_ext_android_cb: false,
};

describe('FiltersDownloader', () => {
    describe('error message during `!#include` and condition directives resolving', () => {
        it('unexpected condition else branch', async () => {
            const rules = [
                'always_included_rule',
                '!#else',
                'if_adguard_included_rule',
            ];
            const errorDetails = [
                'Found unexpected condition else branch: \'!#else\'',
                'Context:',
                '\talways_included_rule',
                '\t!#else',
            ];
            expect(() => FiltersDownloader.resolveConditions(
                rules,
                FilterCompilerConditionsConstants,
            )).toThrowError(new Error(mergeErrorDetails(errorDetails)));
        });

        it('unexpected condition end', async () => {
            const rules = [
                'always_included_rule',
                'if_adguard_included_rule',
                '!#endif',
            ];
            const errorDetails = [
                'Found unexpected condition end: \'!#endif\'',
                'Context:',
                '\talways_included_rule',
                '\tif_adguard_included_rule',
                '\t!#endif',
            ];
            expect(() => FiltersDownloader.resolveConditions(
                rules,
                FilterCompilerConditionsConstants,
            )).toThrowError(new Error(mergeErrorDetails(errorDetails)));
        });

        it('failed to resolve the include directive', async () => {
            const nonExistentFilePath = path.resolve(__dirname, './resources/not_found_file.txt');
            const rules = [
                'always_included_rule',
                '||example.com',
                '||example.org',
                `!#include ${nonExistentFilePath}`,
            ];
            const errorDetails = [
                `Failed to resolve the include directive '!#include ${nonExistentFilePath}'`,
                'Context:',
                '\talways_included_rule',
                '\t||example.com',
                '\t||example.org',
                `\t!#include ${nonExistentFilePath}`,
                `\tENOENT: no such file or directory, open '${nonExistentFilePath}'`,
            ];
            await expect(FiltersDownloader.resolveIncludes(
                rules,
                undefined,
                FilterCompilerConditionsConstants,
            )).rejects.toThrowError(new Error(mergeErrorDetails(errorDetails)));
        });

        it('failed to resolve the include directive without file path', async () => {
            const rules = [
                'always_included_rule',
                'included_rule',
                '||example.org^',
                '||example.com^',
                '!#include',
            ];
            const errorDetails = [
                'Failed to resolve the include directive \'!#include\'',
                'Context:',
                '\tincluded_rule',
                '\t||example.org^',
                '\t||example.com^',
                '\t!#include',
                '\tEISDIR: illegal operation on a directory, read',
            ];
            await expect(FiltersDownloader.resolveIncludes(
                rules,
                undefined,
                FilterCompilerConditionsConstants,
            )).rejects.toThrowError(new Error(mergeErrorDetails(errorDetails)));
        });

        it('failed to resolve the include directive with 404 path', async () => {
            const rules = [
                'always_included_rule',
                '||example.org^',
                '!#include https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__test__/resources/blabla.txt',
                'if_adguard_included_rule',
                '||example.com^',
            ];
            const errorDetails = [
                'Failed to resolve the include directive \'!#include https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__test__/resources/blabla.txt\'',
                'Context:',
                '\talways_included_rule',
                '\t||example.org^',
                '\t!#include https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__test__/resources/blabla.txt',
                '\tResponse status for url https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__test__/resources/blabla.txt is invalid: 404',
            ];
            await expect(
                FiltersDownloader.compile(
                    rules,
                    undefined,
                    FilterCompilerConditionsConstants,
                ),
            ).rejects.toThrowError(new Error(mergeErrorDetails(errorDetails)));
        });

        it('does not include credentials in directive error messages', async () => {
            nock('http://localhost:3000')
                .get('/fixtures/credentials/filter.txt')
                .reply(200, '!#endif', { 'Content-Type': 'text/plain' });

            const url = 'http://user:password@localhost:3000/fixtures/credentials/filter.txt';
            const error = await FiltersDownloader.download(url, FilterCompilerConditionsConstants)
                .catch((e: Error) => e);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message)
                .toContain("URL: 'http://localhost:3000/fixtures/credentials'");
            expect((error as Error).message).not.toContain('password');
        });

        it('does not include credentials in an invalid url error message', async () => {
            const includeUrl = '!#include http://user:password@exa mple.org/filter.txt';

            const error = await FiltersDownloader.resolveIncludes(
                [includeUrl],
                'http://example.org',
                FilterCompilerConditionsConstants,
            ).catch((e: Error) => e);

            expect((error as Error).message).toBe("Invalid url: 'http://exa mple.org/filter.txt'");
        });
    });

    describe('a filter URL with credentials', () => {
        it('resolves a relative include with the same credentials', async () => {
            const authorization = `Basic ${Buffer.from('user:password').toString('base64')}`;
            const scope = nock('http://localhost:3000');

            scope
                .get('/fixtures/credentials/filter.txt')
                .matchHeader('Authorization', authorization)
                .reply(200, '!#include included.txt\n||example.org^', {
                    'Content-Type': 'text/plain',
                });
            scope
                .get('/fixtures/credentials/included.txt')
                .matchHeader('Authorization', authorization)
                .reply(200, '||included.com^', { 'Content-Type': 'text/plain' });

            const filter = await FiltersDownloader.download(
                'http://user:password@localhost:3000/fixtures/credentials/filter.txt',
                FilterCompilerConditionsConstants,
            );

            expect(filter).toEqual(['||included.com^', '||example.org^']);
            expect(scope.isDone()).toBe(true);
        });
    });

    describe('!#include path resolution', () => {
        const host = 'http://localhost:3000';
        const parentDirectory = '/fixtures/05_includes/dir2';
        const filterUrl = `${host}${parentDirectory}/filter.txt`;

        afterEach(() => {
            nock.cleanAll();
        });

        it('resolves a relative include in the same directory', async () => {
            const scope = nock(host)
                .get(`${parentDirectory}/filter.txt`)
                .reply(200, '||main.com^\n!#include inclusion.txt', { 'Content-Type': 'text/plain' })
                .get(`${parentDirectory}/inclusion.txt`)
                .reply(200, '||included.com^', { 'Content-Type': 'text/plain' });

            const filter = await FiltersDownloader.download(filterUrl);

            expect(filter).toEqual(['||main.com^', '||included.com^']);
            expect(scope.isDone()).toBe(true);
        });

        it('resolves a relative include in a subdirectory and nested includes in it', async () => {
            const scope = nock(host)
                .get(`${parentDirectory}/filter.txt`)
                .reply(200, '||main.com^\n!#include sub/inclusion.txt', { 'Content-Type': 'text/plain' })
                .get(`${parentDirectory}/sub/inclusion.txt`)
                .reply(200, '||included.com^\n!#include nested.txt', { 'Content-Type': 'text/plain' })
                .get(`${parentDirectory}/sub/nested.txt`)
                .reply(200, '||nested.com^', { 'Content-Type': 'text/plain' });

            const filter = await FiltersDownloader.download(filterUrl);

            expect(filter).toEqual(['||main.com^', '||included.com^', '||nested.com^']);
            expect(scope.isDone()).toBe(true);
        });

        it('ignores a relative include that escapes the parent directory', async () => {
            const scope = nock(host)
                .get(`${parentDirectory}/filter.txt`)
                .reply(200, '||main.com^\n!#include ../other/secret.txt\n||after.com^', {
                    'Content-Type': 'text/plain',
                });
            const secretScope = nock(host)
                .get('/fixtures/05_includes/other/secret.txt')
                .reply(200, '||secret.com^', { 'Content-Type': 'text/plain' });

            const filter = await FiltersDownloader.download(filterUrl);

            expect(filter).toEqual(['||main.com^', '||after.com^']);
            expect(scope.isDone()).toBe(true);
            expect(secretScope.isDone()).toBe(false);
        });

        it('resolves a root-absolute include inside the parent directory', async () => {
            const scope = nock(host)
                .get(`${parentDirectory}/filter.txt`)
                .reply(200, '||main.com^\n!#include /inclusion.txt', {
                    'Content-Type': 'text/plain',
                })
                .get(`${parentDirectory}/inclusion.txt`)
                .reply(200, '||included.com^', { 'Content-Type': 'text/plain' });

            const filter = await FiltersDownloader.download(filterUrl);

            expect(filter).toEqual(['||main.com^', '||included.com^']);
            expect(scope.isDone()).toBe(true);
        });

        it('ignores a root-absolute include that escapes the parent directory', async () => {
            const scope = nock(host)
                .get(`${parentDirectory}/filter.txt`)
                .reply(200, '||main.com^\n!#include /../secret.txt\n||after.com^', {
                    'Content-Type': 'text/plain',
                });
            const secretScope = nock(host)
                .get('/fixtures/05_includes/secret.txt')
                .reply(200, '||secret.com^', { 'Content-Type': 'text/plain' });

            const filter = await FiltersDownloader.download(filterUrl);

            expect(filter).toEqual(['||main.com^', '||after.com^']);
            expect(scope.isDone()).toBe(true);
            expect(secretScope.isDone()).toBe(false);
        });

        it('ignores percent-encoded parent-directory includes', async () => {
            const includePaths = [
                '%2e%2e/secret-1.txt',
                '.%2e/secret-2.txt',
                '%2e./secret-3.txt',
                '%2e%2e/secret-4.txt',
            ];
            const filterContent = [
                '||main.com^',
                ...includePaths.map((includePath) => `!#include ${includePath}`),
                '||after.com^',
            ].join('\n');

            const scope = nock(host)
                .get(`${parentDirectory}/filter.txt`)
                .reply(200, filterContent, { 'Content-Type': 'text/plain' });
            const secretScopes = includePaths.map((includePath) => nock(host)
                .get(`/fixtures/05_includes/${includePath.split('/')[1]}`)
                .reply(200, '||secret.com^', { 'Content-Type': 'text/plain' }));

            const filter = await FiltersDownloader.download(filterUrl);

            expect(filter).toEqual(['||main.com^', '||after.com^']);
            expect(scope.isDone()).toBe(true);
            expect(secretScopes.every((secretScope) => !secretScope.isDone())).toBe(true);
        });

        it('does not resolve an absolute URL from a different origin', async () => {
            const scope = nock(host)
                .get(`${parentDirectory}/filter.txt`)
                .reply(200, '||main.com^\n!#include https://example.org/inclusions.txt', {
                    'Content-Type': 'text/plain',
                });

            await expect(FiltersDownloader.download(filterUrl)).rejects.toThrow(Error);
            expect(scope.isDone()).toBe(true);
        });
    });

    describe('downloadWithRaw', () => {
        describe('applies patches', () => {
            beforeAll(async () => {
                await server.start();
            });

            afterAll(async () => {
                await server.stop();
            });

            it('applies patches', async () => {
                const basePath = server.baseUrl();
                const url = new URL('./fixtures/01_simple/filter.txt', basePath).toString();
                const prevFilter = await fs.readFile(
                    path.resolve(__dirname, './fixtures/01_simple/filter_v1.0.0.txt'),
                    'utf-8',
                );
                const curFilter = await fs.readFile(
                    path.resolve(__dirname, './fixtures/01_simple/filter.txt'),
                    'utf-8',
                );
                const { filter, rawFilter } = await FiltersDownloader.downloadWithRaw(url, { rawFilter: prevFilter });
                expect(filter).toEqual(curFilter.trim().split(/[\r\n]+/));
                // since there are no any includes, they are the same
                expect(rawFilter).toEqual(curFilter);
            });

            it('applies conditions after patches', async () => {
                const basePath = server.baseUrl();
                const url = new URL('./fixtures/02_includes/filter.txt', basePath).toString();
                const prevFilter = await fs.readFile(
                    path.resolve(__dirname, './fixtures/02_includes/filter_v1.0.0.txt'),
                    'utf-8',
                );
                const { filter, rawFilter } = await FiltersDownloader.downloadWithRaw(url, { rawFilter: prevFilter });
                const expectedFilter = [
                    '! Title: Diff Updates Simple Example List',
                    '! Version: v1.0.2',
                    '! Diff-Path: patches/v1.0.1-s-1702460925-5.patch',
                    '||example.net^',
                    '||included.com^',
                ];
                const expectedRawFilter = `! Title: Diff Updates Simple Example List
! Version: v1.0.2
! Diff-Path: patches/v1.0.1-s-1702460925-5.patch
||example.net^
!#include ./filter_2.txt`;
                expect(filter).toEqual(expectedFilter);
                expect(rawFilter).toEqual(expectedRawFilter);
            });
        });
        describe('force', () => {
            it('fetches only once when force is used', async () => {
                const basePath = 'http://localhost:3000';
                const url = new URL('./fixtures/02_includes/filter.txt', basePath).toString();

                // Setup Nock to intercept the request and count the number of times it's called
                const scope = nock(basePath)
                    .get('/fixtures/02_includes/filter.txt')
                    .once() // expecting it to be called only once
                    .replyWithFile(
                        200,
                        path.resolve(__dirname, './fixtures/02_includes/filter.txt'),
                        {
                            'Content-Type': 'text/plain',
                        },
                    );

                scope
                    .get('/fixtures/02_includes/filter_2.txt')
                    .once()
                    .replyWithFile(
                        200,
                        path.resolve(__dirname, './fixtures/02_includes/filter_2.txt'),
                        {
                            'Content-Type': 'text/plain',
                        },
                    );

                const { filter, rawFilter } = await FiltersDownloader.downloadWithRaw(url, { force: true });
                const expectedFilter = [
                    '! Title: Diff Updates Simple Example List',
                    '! Version: v1.0.2',
                    '! Diff-Path: patches/v1.0.1-s-1702460925-5.patch',
                    '||example.net^',
                    '||included.com^',
                ];
                const expectedRawFilter = `! Title: Diff Updates Simple Example List
! Version: v1.0.2
! Diff-Path: patches/v1.0.1-s-1702460925-5.patch
||example.net^
!#include filter_2.txt
`;
                expect(filter).toEqual(expectedFilter);
                expect(rawFilter).toEqual(expectedRawFilter);
                // Assert that each URL was fetched only once
                expect(scope.isDone()).toBe(true);
            });
        });
        describe('if no Diff-Path in the filter', () => {
            it('fetches only once when force is used', async () => {
                const basePath = 'http://localhost:3000';
                const url = new URL('./fixtures/03_no_patches/filter.txt', basePath).toString();

                // Setup Nock to intercept the request and count the number of times it's called
                const scope = nock(basePath)
                    .get('/fixtures/03_no_patches/filter.txt')
                    .once() // expecting it to be called only once
                    .replyWithFile(
                        200,
                        path.resolve(__dirname, './fixtures/03_no_patches/filter.txt'),
                        {
                            'Content-Type': 'text/plain',
                        },
                    );

                scope
                    .get('/fixtures/03_no_patches/filter_2.txt')
                    .once() // expecting it to be called only once
                    .replyWithFile(
                        200,
                        path.resolve(__dirname, './fixtures/03_no_patches/filter_2.txt'),
                        {
                            'Content-Type': 'text/plain',
                        },
                    );

                const prevRawFilter = await fs.readFile(
                    path.resolve(__dirname, './fixtures/03_no_patches/filter_v1.0.0.txt'),
                    'utf-8',
                );

                const { filter, rawFilter } = await FiltersDownloader.downloadWithRaw(
                    url,
                    {
                        force: false,
                        rawFilter: prevRawFilter,
                    },
                );
                const expectedFilter = [
                    '! Title: Simple Example List',
                    '! Version: v1.0.2',
                    '||example.net^',
                    '||included.com^',
                ];
                const expectedRawFilter = `! Title: Simple Example List
! Version: v1.0.2
||example.net^
!#include filter_2.txt
`;
                expect(filter).toEqual(expectedFilter);
                expect(rawFilter).toEqual(expectedRawFilter);
                // Assert that each URL was fetched only once
                expect(scope.isDone()).toBe(true);
            });
        });
        describe('does not adds diff path from the included filter', () => {
            it('removes diff path from included filter', async () => {
                const basePath = 'http://localhost:3000';
                const url = new URL('./fixtures/04_no_diff_path_for_included/filter.txt', basePath).toString();

                // Setup Nock to intercept the request and count the number of times it's called
                const scope = nock(basePath)
                    .get('/fixtures/04_no_diff_path_for_included/filter.txt')
                    .once() // expecting it to be called only once
                    .replyWithFile(
                        200,
                        path.resolve(__dirname, './fixtures/04_no_diff_path_for_included/filter.txt'),
                        {
                            'Content-Type': 'text/plain',
                        },
                    );

                scope
                    .get('/fixtures/04_no_diff_path_for_included/filter_2.txt')
                    .once() // expecting it to be called only once
                    .replyWithFile(
                        200,
                        path.resolve(__dirname, './fixtures/04_no_diff_path_for_included/filter_2.txt'),
                        {
                            'Content-Type': 'text/plain',
                        },
                    );

                const prevRawFilter = await fs.readFile(
                    path.resolve(__dirname, './fixtures/04_no_diff_path_for_included/filter_v1.0.0.txt'),
                    'utf-8',
                );

                const { filter, rawFilter } = await FiltersDownloader.downloadWithRaw(
                    url,
                    {
                        force: false,
                        rawFilter: prevRawFilter,
                    },
                );
                const expectedFilter = [
                    '! Title: Simple Example List',
                    '! Version: v1.0.2',
                    '||example.net^',
                    '! Title: Simple Filter 2',
                    '! Version: v1.0.0',
                    '||included2.com^',
                ];
                const expectedRawFilter = `! Title: Simple Example List
! Version: v1.0.2
||example.net^
!#include filter_2.txt
`;
                expect(filter).toEqual(expectedFilter);
                expect(rawFilter).toEqual(expectedRawFilter);
                // Assert that each URL was fetched only once
                expect(scope.isDone()).toBe(true);
            });
        });
        describe('URL with credentials', () => {
            it('downloads the full filter and sends the Authorization header', async () => {
                const basePath = 'http://localhost:3000';
                const url = 'http://user:password@localhost:3000/fixtures/01_simple/filter.txt';
                const authorization = `Basic ${Buffer.from('user:password').toString('base64')}`;

                const scope = nock(basePath)
                    .get('/fixtures/01_simple/filter.txt')
                    .matchHeader('Authorization', authorization)
                    .once()
                    .replyWithFile(
                        200,
                        path.resolve(__dirname, './fixtures/01_simple/filter.txt'),
                        { 'Content-Type': 'text/plain' },
                    );

                const prevFilter = await fs.readFile(
                    path.resolve(__dirname, './fixtures/01_simple/filter_v1.0.0.txt'),
                    'utf-8',
                );
                const curFilter = await fs.readFile(
                    path.resolve(__dirname, './fixtures/01_simple/filter.txt'),
                    'utf-8',
                );

                // The raw filter contains a Diff-Path, so a patch update would be
                // attempted without the credentials check.
                const { filter, rawFilter } = await FiltersDownloader.downloadWithRaw(
                    url,
                    { rawFilter: prevFilter },
                );

                expect(filter).toEqual(curFilter.trim().split(/[\r\n]+/));
                expect(rawFilter).toEqual(curFilter);
                expect(scope.isDone()).toBe(true);
            });
        });
    });

    describe('download local files', () => {
        afterEach(() => {
            // restore the file system
            mockFs.restore();
        });

        it('simple download from local source', async () => {
            // mock file system
            mockFs({
                'test/dir': {
                    'rules.txt': 'testrule',
                },
            });

            // compile the final list
            const list = await FiltersDownloader.download('test/dir/rules.txt');

            const expectedRules = [
                'testrule',
            ];

            expectedRules.forEach((rule) => {
                expect(list).toContain(rule);
            });
        });

        it('downloads and resolves includes from local source', async () => {
            // mock file system
            mockFs({
                'test/dir': {
                    'rules.txt': `example.com
!#include include.txt`,
                    'include.txt': 'first.include.com',
                },
            });

            // compile the final list
            const list = await FiltersDownloader.download('test/dir/rules.txt');

            const expectedRules = [
                'example.com',
                'first.include.com',
            ];

            expectedRules.forEach((rule) => {
                expect(list).toContain(rule);
            });
        });

        it('downloads and resolves nested includes from local source', async () => {
            // mock file system
            mockFs({
                'test/dir': {
                    'rules.txt': `example.com
!#include include1.txt`,
                    'include1.txt': `first.include.com
!#include include2.txt`,
                    'include2.txt': 'second.include.com',
                },
            });

            // compile the final list
            const list = await FiltersDownloader.download('test/dir/rules.txt');

            const expectedRules = [
                'example.com',
                'first.include.com',
                'second.include.com',
            ];

            expectedRules.forEach((rule) => {
                expect(list).toContain(rule);
            });
        });

        it('downloads and resolves includes from a subdirectory of a local source', async () => {
            // mock file system
            mockFs({
                'test/dir': {
                    'rules.txt': `example.com
!#include sub/include.txt`,
                    sub: {
                        'include.txt': `sub.include.com
!#include nested.txt`,
                        'nested.txt': 'nested.include.com',
                    },
                },
            });

            // compile the final list
            const list = await FiltersDownloader.download('test/dir/rules.txt');

            expect(list).toEqual(['example.com', 'sub.include.com', 'nested.include.com']);
        });

        it('resolves a root-absolute local include inside the filter directory', async () => {
            // mock file system
            mockFs({
                'test/dir': {
                    'rules.txt': `example.com
!#include /include.txt`,
                    'include.txt': 'include.com',
                },
            });

            // compile the final list
            const list = await FiltersDownloader.download('test/dir/rules.txt');

            expect(list).toEqual(['example.com', 'include.com']);
        });

        it('ignores a local include that escapes the filter directory', async () => {
            // mock file system
            mockFs({
                'test/dir': {
                    'rules.txt': `example.com
!#include ../other/secret.txt
last.com`,
                },
                'test/other': {
                    'secret.txt': 'secret.com',
                },
            });

            // compile the final list
            const list = await FiltersDownloader.download('test/dir/rules.txt');

            expect(list).toEqual(['example.com', 'last.com']);
        });

        it('resolves a relative include when the filter origin is null', async () => {
            // mock file system
            mockFs({
                'inclusion.txt': 'included.com',
            });

            const rules = ['example.com', '!#include inclusion.txt'];
            // Legacy JavaScript callers pass `null` to mean an unknown origin.
            const list = await FiltersDownloader.resolveIncludes(rules, null as unknown as string);

            expect(list).toEqual(['example.com', 'included.com']);
        });

        it('does not resolve include from different origin', async () => {
            // mock file system
            mockFs({
                'test/dir': {
                    'rules.txt': `example.com
!#include https://example.org/inclusions.txt`,
                },
            });

            await expect(async () => {
                await FiltersDownloader.download('test/dir/rules.txt');
            }).rejects.toThrow(Error);
        });
    });
});
