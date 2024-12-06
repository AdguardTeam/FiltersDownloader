import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
} from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import nock from 'nock';

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
                `\tError: ENOENT: no such file or directory, open '${nonExistentFilePath}'`,
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
                '\tError: EISDIR: illegal operation on a directory, read',
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
                const basePath = 'http://localhost:3000';
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
                const basePath = 'http://localhost:3000';
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
    });
});
