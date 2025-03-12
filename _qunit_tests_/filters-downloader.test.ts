// TODO rewrite this tests to jest
/* eslint-disable no-console */
/* eslint-disable global-require */
const mockFs = require('mock-fs');

const FilterCompilerConditionsConstants = {
    adguard: true,
    adguard_ext_chromium: true,
    adguard_ext_firefox: false,
    adguard_ext_edge: false,
    adguard_ext_safari: false,
    adguard_ext_opera: false,
    adguard_ext_android_cb: false,
};

// eslint-disable-next-line max-len
const TEST_FILTER_LIST_BASE = 'https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__tests__/resources';

// TODO remove test files and use local server for external downloading tests
const URL0 = `${TEST_FILTER_LIST_BASE}/rules.txt`;
const URL1 = `${TEST_FILTER_LIST_BASE}/rules_simple_include.txt`;
const URL2 = `${TEST_FILTER_LIST_BASE}/rules_nested_subdir_includes.txt`;
const URL3 = `${TEST_FILTER_LIST_BASE}/test-filter.txt`;
const URL4 = `${TEST_FILTER_LIST_BASE}/rules_conditional_includes.txt`;
const URL_EMPTY = `${TEST_FILTER_LIST_BASE}/empty-filter.txt`;
const URL_INCLUDES_EMPTY = `${TEST_FILTER_LIST_BASE}/includes_empty_filter.txt`;

// eslint-disable-next-line max-len
const URL404 = 'https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__test__/resources/blabla.txt';

/**
 * Checks the result of `FiltersDownloader.resolveConditions()` for the `actual` rules
 * with the {@link FilterCompilerConditionsConstants} config
 * against the `expected` rules.
 *
 * @param {object} FiltersDownloader FiltersDownloader object with resolveConditions().
 * @param {string[]} actual Input rules.
 * @param {string[]} expected Expected output rules.
 * @param assert Assert.
 */
const expectResolvedConditionsRules = (
    FiltersDownloader: any,
    actual: string[],
    expected: string[],
    assert: any,
): void => {
    const compiled = FiltersDownloader.resolveConditions(actual, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, expected.length);
    assert.deepEqual(compiled, expected);
};

QUnit.test('Test filter downloader', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const compiled = await FiltersDownloader.download(URL0, FilterCompilerConditionsConstants);

    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'test');
});

QUnit.test('Test filter download from external resource with relative url', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    let compiled;

    try {
        compiled = await FiltersDownloader.download(URL1, FilterCompilerConditionsConstants);
    } catch (e) {
        console.log((e as Error).message);
    }

    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[compiled.length - 1], 'test');
});

QUnit.test('Test filter download from external resource with relative url and subdir', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    let compiled;

    try {
        compiled = await FiltersDownloader.download(URL2, FilterCompilerConditionsConstants);
    } catch (e) {
        console.log((e as Error).message);
    }

    assert.ok(compiled);
    assert.equal(compiled.length, 3);
    assert.equal(compiled[0], 'test_parent');
    assert.equal(compiled[1], 'sub_test_main');
    assert.equal(compiled[2], 'sub_test');
});

QUnit.test('Test that not found link returns error ', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);
    let compiled;
    try {
        compiled = await FiltersDownloader.download(URL404, FilterCompilerConditionsConstants);
    } catch (e) {
        assert.equal((e as Error).message, `Response status for url ${URL404} is invalid: 404`);
    }

    assert.notOk(compiled);
});

QUnit.test('Test filter downloader - simple "if" conditions', async (assert) => {
    let rules;
    let compiled;

    rules = [
        'always_included_rule',
        '!#if (adguard)',
        'if_adguard_included_rule',
        '!#endif',
    ];

    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    rules = [
        'always_included_rule',
        '!#if !adguard',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    rules = [
        'always_included_rule',
        '!#if !!adguard',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    rules = [
        'always_included_rule',
        '!#if true',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    rules = [
        'always_included_rule',
        '!#if adguard',
        'if_adguard_included_rule',
        '!#endif',
        '!#if adguard_ext_chromium',
        'if_adguard_ext_chromium_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 3);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');
    assert.equal(compiled[2], 'if_adguard_ext_chromium_included_rule');
});

QUnit.test('Test filter downloader - unsupported conditions', async (assert) => {
    const rules = [
        'test',
        '!#if smth',
        'if_adguard_included_rule',
        '!#endif',
    ];

    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'test');
});

QUnit.test('Test filter downloader - logical "if" conditions', async (assert) => {
    let rules;
    let compiled;

    // true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // true && false = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera',
        'if_adguard_ext_opera_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // true || false = true
    rules = [
        'always_included_rule',
        '!#if adguard || adguard_ext_opera',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // true && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // true && false && true = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false || true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard_ext_firefox || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');
});

QUnit.test('Test filter downloader - "if" conditions brackets', async (assert) => {
    let rules;
    let compiled;

    rules = [
        'always_included_rule',
        '!#if (((adguard)))',
        'if_adguard_included_rule',
        '!#endif',
    ];

    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // (true && true) = true
    rules = [
        'always_included_rule',
        '!#if (adguard && adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // (true || false) && false = false
    rules = [
        'always_included_rule',
        '!#if (adguard || adguard_ext_opera) && adguard_ext_firefox',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // (false || false) && (false) = false
    rules = [
        'always_included_rule',
        '!#if ((adguard || adguard_ext_opera) && (adguard_ext_firefox))',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // false || true && (false) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && (adguard_ext_firefox)',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // !(false) = true
    rules = [
        'always_included_rule',
        '!#if !(adguard_ext_opera)',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && (true || true) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && (adguard || adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');
});

QUnit.test('Test filter downloader - nested if conditions', async (assert) => {
    let rules;
    let compiled;

    rules = [
        'zero_level_rule',
        '!#if adguard',
        'first_level_condition',
        '!#if adguard',
        'second_level_condition',
        '!#endif',
        '!#endif',
    ];

    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 3);
    assert.equal(compiled[0], 'zero_level_rule');
    assert.equal(compiled[1], 'first_level_condition');
    assert.equal(compiled[2], 'second_level_condition');

    rules = [
        'zero_level_rule',
        '!#if adguard',
        'first_level_condition',
        '!#if adguard',
        'second_level_condition',
        '!#if !adguard',
        'third_level_condition',
        '!#endif',
        '!#endif',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 3);
    assert.equal(compiled[0], 'zero_level_rule');
    assert.equal(compiled[1], 'first_level_condition');
    assert.equal(compiled[2], 'second_level_condition');

    rules = [
        'zero_level_rule',
        '!#if adguard',
        'first_level_condition',
        '!#if adguard',
        'second_level_1_condition',
        '!#endif',
        '!#if adguard',
        'second_level_2_condition',
        '!#endif',
        '!#endif',
    ];

    compiled = FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 4);
    assert.equal(compiled[0], 'zero_level_rule');
    assert.equal(compiled[1], 'first_level_condition');
    assert.equal(compiled[2], 'second_level_1_condition');
    assert.equal(compiled[3], 'second_level_2_condition');
});

QUnit.test('Test filter downloader - invalid "if" conditions', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    let rules: string[];

    rules = [
        'always_included_rule',
        '!# if adguard',
        'invalid_if_space',
        '!#endif',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if adguard',
        'missing_endif',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if adguard',
        'if_rule',
        '!#else',
        'missing_endif',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        'invalid_endif',
        '!#endif',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#else',
        'invalid_else',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if',
        'invalid_condition',
        '!#endif',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if adguard_ext_chromium',
        'if_chromium_rule',
        '!#elseif adguard_ext_firefox',
        'invalid_else',
        '!#endif',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if (adguard',
        'invalid_condition_brackets',
        '!#endif',
    ];
    assert.throws(() => {
        FiltersDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });
});

QUnit.test('Test filter downloader - simple includes', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const rules = await FiltersDownloader.download(
        `${__dirname}/resources/rules_simple_include.txt`,
        FilterCompilerConditionsConstants,
    );
    const resolve = await FiltersDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 2);
    assert.equal(resolve[0], 'test_main');
    assert.equal(resolve[1], 'test');
});

QUnit.test('Test filter downloader - nested includes', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const rules = await FiltersDownloader.download(
        `${__dirname}/resources/rules_nested_includes.txt`,
        FilterCompilerConditionsConstants,
    );
    const resolve = await FiltersDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 5);
    assert.equal(resolve[0], 'test_parent');
    assert.equal(resolve[1], 'test_main');
    assert.equal(resolve[2], 'test');
    assert.equal(resolve[3], 'test_main');
    assert.equal(resolve[4], 'test');
});

QUnit.test('Test filter downloader - nested subdir includes', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const rules = await FiltersDownloader.download(
        `${__dirname}/resources/rules_nested_subdir_includes.txt`,
        FilterCompilerConditionsConstants,
    );
    const resolve = await FiltersDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 3);
    assert.equal(resolve[0], 'test_parent');
    assert.equal(resolve[1], 'sub_test_main');
    assert.equal(resolve[2], 'sub_test');
});

QUnit.test('Test filter downloader - external download and includes with special characters', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const rules = await FiltersDownloader.download(URL3, FilterCompilerConditionsConstants);
    const resolve = await FiltersDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 4);
    assert.equal(resolve[0], '||example1.org');
    assert.equal(resolve[3], '||example4.org');
});

QUnit.test('Test filter downloader - invalid includes', async (assert) => {
    let rules;

    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    // non existing file
    rules = [
        'always_included_rule',
        '!#include resources/not_found_file.txt',
    ];

    assert.rejects(
        FiltersDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants),
        "Failed to resolve the include directive: '!#include resources/not_found_file.txt'",
    );

    // different origin
    rules = [
        'always_included_rule',
        '!#include http://filters.adtidy.org/windows/filters/14.txt',
    ];

    assert.rejects(FiltersDownloader.resolveIncludes(rules, 'http://google.com', FilterCompilerConditionsConstants));
});

QUnit.test('Test filter downloader - compile rules with conditional includes', async (assert) => {
    // case 1: positive condition and include existing url
    let rules = [
        'always_included_rule',
        '!#if adguard',
        `!#include ${URL0}`,
        'if_adguard_included_rule',
        '!#endif',
    ];

    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    let compiled = await FiltersDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 3);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'test');
    assert.equal(compiled[2], 'if_adguard_included_rule');

    // case 2: positive condition and include non-existing url
    rules = [
        'always_included_rule',
        '!#if adguard',
        `!#include ${URL404}`,
        'if_adguard_included_rule',
        '!#endif',
    ];

    assert.rejects(
        FiltersDownloader.compile(rules, null, FilterCompilerConditionsConstants),
        `Failed to resolve the include directive '!#include https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__test__/resources/blabla.txt'
Context:
        always_included_rule
        !#include ${URL404}
        Response status for url ${URL404} is invalid: 404`,
    );

    // case 3: negative condition and include non-existing url
    rules = [
        'always_included_rule',
        '!#if adguard_ext_firefox',
        `!#include ${URL404}`,
        'if_adguard_included_rule',
        '!#endif',
    ];

    compiled = await FiltersDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    rules = [
        '!#if non_existing_variable',
        '!#include non_existing_file.txt',
        '!#endif',
    ];

    compiled = await FiltersDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 0);
});

QUnit.test('Test filter downloader - download filter with conditional includes', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const downloaded = await FiltersDownloader.download(URL4, FilterCompilerConditionsConstants);
    assert.ok(downloaded);
    assert.equal(downloaded.length, 3);
    assert.equal(downloaded[0], 'test_main');
    assert.equal(downloaded[1], 'test');
    assert.equal(downloaded[2], 'example');
});

QUnit.test('Test empty filter downloader without `allowEmptyResponse` option', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);
    assert.rejects(FiltersDownloader.download(URL_EMPTY, FilterCompilerConditionsConstants), 'Response is empty');
});

QUnit.test('Test downloader with external filter and `allowEmptyResponse` option', async (assert) => {
    const { FiltersDownloader } = require('../dist');

    const downloaded = await FiltersDownloader.download(
        URL_EMPTY,
        FilterCompilerConditionsConstants,
        { allowEmptyResponse: true },
    );

    assert.equal(downloaded.length, 1);
    assert.equal(downloaded[0], '');
});

QUnit.test('Test downloader with empty local filter and `allowEmptyResponse` option', async (assert) => {
    const { FiltersDownloader } = require('../dist');

    mockFs({
        'test/empty.txt': '',
    });

    const downloaded = await FiltersDownloader.download(
        'test/empty.txt',
        FilterCompilerConditionsConstants,
        { allowEmptyResponse: true },
    );

    assert.equal(downloaded.length, 1);
    assert.equal(downloaded[0], '');

    // Clean up the mock file
    mockFs.restore();
});

QUnit.test('Test filter downloader includes an empty filter', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    const compiled = await FiltersDownloader.download(URL_INCLUDES_EMPTY, FilterCompilerConditionsConstants);

    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'The test filter includes an empty filter');
    assert.equal(compiled[1], '');
});

QUnit.test('Test filter downloader - simple "if" conditions with "else" branch', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    let actual;
    let expected;

    // case 1
    actual = [
        'always_included_rule',
        '!#if (adguard)',
        'adguard_included_rule',
        '!#else',
        'non_adguard_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'adguard_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 2
    actual = [
        'always_included_rule',
        '!#if !adguard',
        'non_adguard_included_rule',
        '!#else',
        'adguard_included_rule_1',
        'adguard_included_rule_2',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'adguard_included_rule_1',
        'adguard_included_rule_2',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 3
    actual = [
        'always_included_rule',
        '!#if !!adguard',
        'adguard_included_rule',
        '!#else',
        'non_adguard_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'adguard_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 4
    actual = [
        'always_included_rule',
        '!#if adguard',
        'adguard_included_rule',
        '!#else',
        'non_adguard_included_rule_1',
        '!#endif',
        '!#if adguard_ext_chromium',
        'adguard_ext_chromium_included_rule',
        '!#else',
        'non_adguard_included_rule_2',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'adguard_included_rule',
        'adguard_ext_chromium_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 5
    actual = [
        'always_included_rule',
        '!#if !adguard',
        'non_adguard_included_rule_1',
        '!#else',
        'adguard_included_rule',
        '!#endif',
        '!#if !adguard_ext_chromium',
        'non_adguard_included_rule_2',
        '!#else',
        'adguard_ext_chromium_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'adguard_included_rule',
        'adguard_ext_chromium_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);
});

QUnit.test('Test filter downloader - logical "if" conditions with "else" branch', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    let actual;
    let expected;

    // true && true = true
    actual = [
        'always_included_rule',
        '!#if adguard && adguard_ext_chromium',
        'adguard_included_rule',
        '!#else',
        'non_adguard_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'adguard_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // true && false = false
    actual = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera',
        'adguard_ext_opera_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'else_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // true || false = true
    actual = [
        'always_included_rule',
        '!#if adguard || adguard_ext_opera',
        'if_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'if_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // true && false || true = true
    actual = [
        'always_included_rule',
        '!#if (adguard && adguard_ext_opera || adguard_ext_chromium)',
        'if_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'if_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // true && false && true = false
    actual = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera && adguard_ext_chromium',
        'if_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'else_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // false && true || true = true
    actual = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'if_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // false || true && true = true
    actual = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'if_adguard_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // !true && !true = false
    actual = [
        'always_included_rule',
        '!#if !adguard && !adguard_ext_chromium',
        'if_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'else_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // !(true && true) = false
    actual = [
        'always_included_rule',
        '!#if !(adguard && adguard_ext_chromium)',
        'if_included_rule',
        '!#else',
        'else_included_rule',
        '!#endif',
    ];
    expected = [
        'always_included_rule',
        'else_included_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);
});

QUnit.test('Test filter downloader - nested if conditions with else branch', async (assert) => {
    const { FiltersDownloader } = require('../dist');
    assert.ok(FiltersDownloader);

    let actual;
    let expected;

    // case 1 -- two nested levels
    actual = [
        'zero_level_rule',
        '!#if adguard',
        'if_first_level_rule',
        '!#if adguard_ext_chromium',
        'if_second_level_rule',
        '!#else',
        'else_second_level_rule',
        '!#endif',
        '!#else',
        'else_first_level_rule',
        '!#endif',
    ];
    expected = [
        'zero_level_rule',
        'if_first_level_rule',
        'if_second_level_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 2 -- three nested levels
    actual = [
        'zero_level_rule',
        '!#if adguard',
        'if_first_level_rule',
        '!#if adguard_ext_chromium',
        'if_second_level_rule',
        '!#if !adguard_ext_firefox',
        'if_third_level_rule',
        '!#else',
        'else_third_level_rule',
        '!#endif',
        '!#else',
        'else_second_level_rule',
        '!#endif',
        '!#else',
        'else_first_level_rule',
        '!#endif',
    ];
    expected = [
        'zero_level_rule',
        'if_first_level_rule',
        'if_second_level_rule',
        'if_third_level_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 3 -- two nested levels but with few inner if conditions
    actual = [
        'zero_level_rule',
        '!#if adguard',
        'if_first_level_rule',
        '!#if adguard_ext_chromium',
        'if_second_level_rule_1',
        '!#else',
        'else_second_level_rule_1',
        '!#endif',
        '!#if !adguard_ext_firefox',
        'if_second_level_rule_2',
        '!#else',
        'else_second_level_rule_2',
        '!#endif',
        '!#else',
        'else_first_level_rule',
        '!#endif',
    ];
    expected = [
        'zero_level_rule',
        'if_first_level_rule',
        'if_second_level_rule_1',
        'if_second_level_rule_2',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 4 -- two nested levels but else branch rules are included in the inner if condition
    actual = [
        'zero_level_rule',
        '!#if adguard',
        'if_first_level_rule',
        '!#if adguard_ext_firefox',
        'if_second_level_rule',
        '!#else',
        'else_second_level_rule',
        '!#endif',
        '!#else',
        'else_first_level_rule',
        '!#endif',
    ];
    expected = [
        'zero_level_rule',
        'if_first_level_rule',
        'else_second_level_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);

    // case 5 -- two nested levels but inner if condition is skipped
    actual = [
        'zero_level_rule',
        '!#if !adguard',
        'if_first_level_rule',
        '!#if adguard_ext_firefox',
        'if_second_level_rule',
        '!#else',
        'else_second_level_rule',
        '!#endif',
        '!#else',
        'else_first_level_rule',
        '!#endif',
    ];
    expected = [
        'zero_level_rule',
        'else_first_level_rule',
    ];
    expectResolvedConditionsRules(FiltersDownloader, actual, expected, assert);
});
