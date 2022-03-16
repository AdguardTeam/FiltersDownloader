/* global QUnit, require */

const FilterCompilerConditionsConstants = {
    adguard: true,
    adguard_ext_chromium: true,
    adguard_ext_firefox: false,
    adguard_ext_edge: false,
    adguard_ext_safari: false,
    adguard_ext_opera: false,
    adguard_ext_android_cb: false
};

const URL0 = 'https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__tests__/resources/rules.txt';
const URL1 = 'https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__tests__/resources/rules_simple_include.txt';
const URL2 = 'https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__tests__/resources/rules_nested_subdir_includes.txt';
const URL3 = 'https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__tests__/resources/test-filter.txt';
const URL404 = 'https://raw.githubusercontent.com/AdguardTeam/FiltersDownloader/test-resources/__test__/resources/blabla.txt';

QUnit.test('Test filter downloader', async (assert) => {
    const FiltersDownloader = require('../src');
    assert.ok(FiltersDownloader);

    let compiled = await FiltersDownloader.download(URL0, FilterCompilerConditionsConstants);

    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'test');
});

QUnit.test('Test filter download from external resource with relative url', async (assert) => {
    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    let compiled;

    try {
        compiled = await FilterDownloader.download(URL1, FilterCompilerConditionsConstants);
    } catch (e) {
        console.log(e.message);
    }

    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[compiled.length-1], 'test');
});

QUnit.test('Test filter download from external resource with relative url and subdir', async (assert) => {
    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    let compiled;

    try {
        compiled = await FilterDownloader.download(URL2, FilterCompilerConditionsConstants);
    } catch (e) {
        console.log(e.message);
    }

    assert.ok(compiled);
    assert.equal(compiled.length, 3);
    assert.equal(compiled[0], 'test_parent');
    assert.equal(compiled[1], 'sub_test_main');
    assert.equal(compiled[2], 'sub_test');
});

QUnit.test('Test that not found link returns error ', async (assert) => {
    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);
    let compiled;
    try {
        compiled = await FilterDownloader.download(URL404, FilterCompilerConditionsConstants);
    } catch (e) {
        assert.equal(e.message, `Response status for url ${URL404} is invalid: 404`);
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
        '!#endif'
    ];

    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    rules = [
        'always_included_rule',
        '!#if !adguard',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    rules = [
        'always_included_rule',
        '!#if !!adguard',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    rules = [
        'always_included_rule',
        '!#if true',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
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
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 3);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');
    assert.equal(compiled[2], 'if_adguard_ext_chromium_included_rule');
});

QUnit.test('Test filter downloader - unsupported conditions', async (assert) => {
    let rules = [
        'test',
        '!#if smth',
        'if_adguard_included_rule',
        '!#endif'
    ];

    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    let compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
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
        '!#endif'
    ];

    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // true && false = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera',
        'if_adguard_ext_opera_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // true || false = true
    rules = [
        'always_included_rule',
        '!#if adguard || adguard_ext_opera',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // true && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // true && false && true = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false || true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard_ext_firefox || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
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
        '!#endif'
    ];

    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // (true && true) = true
    rules = [
        'always_included_rule',
        '!#if (adguard && adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // (true || false) && false = false
    rules = [
        'always_included_rule',
        '!#if (adguard || adguard_ext_opera) && adguard_ext_firefox',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // (false || false) && (false) = false
    rules = [
        'always_included_rule',
        '!#if ((adguard || adguard_ext_opera) && (adguard_ext_firefox))',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // false || true && (false) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && (adguard_ext_firefox)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 1);
    assert.equal(compiled[0], 'always_included_rule');

    // !(false) = true
    rules = [
        'always_included_rule',
        '!#if !(adguard_ext_opera)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 2);
    assert.equal(compiled[0], 'always_included_rule');
    assert.equal(compiled[1], 'if_adguard_included_rule');

    // false && (true || true) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && (adguard || adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
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
        '!#endif'
    ];

    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
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
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
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
        '!#endif'
    ];

    compiled = FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    assert.ok(compiled);
    assert.equal(compiled.length, 4);
    assert.equal(compiled[0], 'zero_level_rule');
    assert.equal(compiled[1], 'first_level_condition');
    assert.equal(compiled[2], 'second_level_1_condition');
    assert.equal(compiled[3], 'second_level_2_condition');

});

QUnit.test('Test filter downloader - invalid "if" conditions', async (assert) => {
    let rules;

    rules = [
        'always_included_rule',
        '!# if adguard',
        'invalid_if_space',
        '!#endif'
    ];

    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    assert.throws(() => {
        FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if adguard',
        'missing_endif'
    ];

    assert.throws(() => {
        FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        'invalid_endif',
        '!#endif'
    ];

    assert.throws(() => {
        FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if',
        'invalid_condition',
        '!#endif'
    ];

    assert.throws(() => {
        FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });

    rules = [
        'always_included_rule',
        '!#if (adguard',
        'invalid_condition_brackets',
        '!#endif'
    ];

    assert.throws(() => {
        FilterDownloader.resolveConditions(rules, FilterCompilerConditionsConstants);
    });
});

QUnit.test('Test filter downloader - simple includes', async (assert) => {
    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    let rules = await FilterDownloader.download(__dirname + '/resources/rules_simple_include.txt', FilterCompilerConditionsConstants);
    let resolve = await FilterDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 2);
    assert.equal(resolve[0], 'test_main');
    assert.equal(resolve[1], 'test');
});

QUnit.test('Test filter downloader - nested includes', async (assert) => {
    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    let rules = await FilterDownloader.download(__dirname + '/resources/rules_nested_includes.txt', FilterCompilerConditionsConstants);
    let resolve = await FilterDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 5);
    assert.equal(resolve[0], 'test_parent');
    assert.equal(resolve[1], 'test_main');
    assert.equal(resolve[2], 'test');
    assert.equal(resolve[3], 'test_main');
    assert.equal(resolve[4], 'test');
});

QUnit.test('Test filter downloader - nested subdir includes', async (assert) => {
    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    let rules = await FilterDownloader.download(__dirname + '/resources/rules_nested_subdir_includes.txt', FilterCompilerConditionsConstants);
    let resolve = await FilterDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 3);
    assert.equal(resolve[0], 'test_parent');
    assert.equal(resolve[1], 'sub_test_main');
    assert.equal(resolve[2], 'sub_test');
});

QUnit.test('Test filter downloader - external download and includes with special characters', async (assert) => {
    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    let rules = await FilterDownloader.download(URL3, FilterCompilerConditionsConstants);
    let resolve = await FilterDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    assert.ok(resolve);
    assert.equal(resolve.length, 4);
    assert.equal(resolve[0], '||example1.org');
    assert.equal(resolve[3], '||example4.org');
});

QUnit.test('Test filter downloader - invalid includes', async (assert) => {
    let rules;

    const FilterDownloader = require('../src');
    assert.ok(FilterDownloader);

    // non existing file
    rules = [
        'always_included_rule',
        '!#include resources/not_found_file.txt'
    ];

    assert.throws(() => {
        FilterDownloader.resolveIncludes(rules, null, FilterCompilerConditionsConstants);
    });

    // different origin
    rules = [
        'always_included_rule',
        '!#include http://filters.adtidy.org/windows/filters/14.txt'
    ];

    assert.throws(() => {
        FilterDownloader.resolveIncludes(rules, 'http://google.com', FilterCompilerConditionsConstants);
    });
});
