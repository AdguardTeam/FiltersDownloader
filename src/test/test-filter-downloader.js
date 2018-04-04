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

QUnit.test("Test filter downloader", function (assert) {
    "use strict";

    let done = assert.async();

    let promise = FilterDownloader.download("resources/rules.txt", FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'test');

        done();
    }, () => {
        assert.ok(false);
    });
});

QUnit.test("Test filter downloader - simple 'if' conditions", function (assert) {

    let rules;

    let done = assert.async(5);

    rules = [
        'always_included_rule',
        '!#if (adguard)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    rules = [
        'always_included_rule',
        '!#if !adguard',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });

    rules = [
        'always_included_rule',
        '!#if !!adguard',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    rules = [
        'always_included_rule',
        '!#if true',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    rules = [
        'always_included_rule',
        '!#if adguard',
        'if_adguard_included_rule',
        '!#endif',
        '!#if adguard_ext_chromium',
        'if_adguard_ext_chromium_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 3);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        assert.equal(compiled[2], 'if_adguard_ext_chromium_included_rule');
        done();
    });
});

QUnit.test("Test filter downloader - unsupported conditions", function (assert) {

    let rules = [
        'test',
        '!#if smth',
        'if_adguard_included_rule',
        '!#endif'
    ];

    let done = assert.async();
    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'test');
        done();
    });
});

QUnit.test("Test filter downloader - logical 'if' conditions", function (assert) {

    let rules;

    let done = assert.async(10);

    // true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // true && false = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera',
        'if_adguard_ext_opera_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });

    // true || false = true
    rules = [
        'always_included_rule',
        '!#if adguard || adguard_ext_opera',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // true && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // true && false && true = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // false || true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // false && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard_ext_firefox || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });
});

QUnit.test("Test filter downloader - 'if' conditions brackets", function (assert) {

    let done = assert.async(8);
    let rules;

    // (((true))) = true
    rules = [
        'always_included_rule',
        '!#if (((adguard)))',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // (true && true) = true
    rules = [
        'always_included_rule',
        '!#if (adguard && adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // (true || false) && false = false
    rules = [
        'always_included_rule',
        '!#if (adguard || adguard_ext_opera) && adguard_ext_firefox',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });

    // (false || false) && (false) = false
    rules = [
        'always_included_rule',
        '!#if ((adguard || adguard_ext_opera) && (adguard_ext_firefox))',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });

    // false || true && (false) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && (adguard_ext_firefox)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });

    // !(false) = true
    rules = [
        'always_included_rule',
        '!#if !(adguard_ext_opera)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        done();
    });

    // false && (true || true) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && (adguard || adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });
});

QUnit.test("Test filter downloader - invalid 'if' conditions", function (assert) {

    let done = assert.async(5);
    let rules;

    rules = [
        'always_included_rule',
        '!# if adguard',
        'invalid_if_space',
        "!#endif"
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });

    rules = [
        'always_included_rule',
        '!#if adguard',
        'missing_endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });

    rules = [
        'always_included_rule',
        '!#if',
        'invalid_condition',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });

    rules = [
        'always_included_rule',
        '!#if adguard',
        'invalid_condition',
        '!#if adguard_ext_chromium',
        'invalid_nested_condition',
        '!#endif',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });

    rules = [
        'always_included_rule',
        '!#if (adguard',
        'invalid_condition_brackets',
        '!#endif'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });
});

QUnit.test("Test filter downloader - simple includes", function (assert) {
    let done = assert.async();

    let promise = FilterDownloader.download("resources/rules_simple_include.txt", FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'test_main');
        assert.equal(compiled[1], 'test');

        done();
    }, () => {
        assert.ok(false);
    });
});

QUnit.test("Test filter downloader - nested includes", function (assert) {
    let done = assert.async();

    let promise = FilterDownloader.download("resources/rules_nested_includes.txt", FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 5);
        assert.equal(compiled[0], 'test_parent');
        assert.equal(compiled[1], 'test_main');
        assert.equal(compiled[2], 'test');
        assert.equal(compiled[3], 'test_main');
        assert.equal(compiled[4], 'test');

        done();
    }, () => {
        assert.ok(false);
    });
});

QUnit.test("Test filter downloader - invalid includes", function (assert) {
    let done = assert.async(2);
    let rules;

    // non existing file
    rules = [
        'always_included_rule',
        '!#include resources/not_found_file.txt'
    ];

    FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });

    // different origin
    rules = [
        'always_included_rule',
        '!#include http://filters.adtidy.org/windows/filters/14.txt'
    ];

    FilterDownloader.compile(rules, 'http://google.com', FilterCompilerConditionsConstants, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });
});