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

QUnit.test("Test filter compiler", function (assert) {
    "use strict";

    let done = assert.async();

    let promise = FilterCompiler.download("resources/rules.txt", FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'test');

        done();
    }, () => {
        assert.ok(false);
    });
});

QUnit.test("Test filter compiler - simple 'if' conditions", function (assert) {

    let rules;

    let done = assert.async(5);

    rules = [
        'always_included_rule',
        '!#if (adguard)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 3);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        assert.equal(compiled[2], 'if_adguard_ext_chromium_included_rule');
        done();
    });
});

QUnit.test("Test filter compiler - unsupported conditions", function (assert) {

    let rules = [
        'test',
        '!#if smth',
        'if_adguard_included_rule',
        '!#endif'
    ];

    let done = assert.async();
    FilterCompiler.compile(rules, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'test');
        done();
    });
});

QUnit.test("Test filter compiler - logical 'if' conditions", function (assert) {

    let rules;

    let done = assert.async(10);

    // true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });
});

QUnit.test("Test filter compiler - 'if' conditions brackets", function (assert) {

    let done = assert.async(8);
    let rules;

    // (((true))) = true
    rules = [
        'always_included_rule',
        '!#if (((adguard)))',
        'if_adguard_included_rule',
        '!#endif'
    ];

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
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

    FilterCompiler.compile(rules, function (compiled) {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
        done();
    });
});

QUnit.test("Test filter compiler - invalid 'if' conditions", function (assert) {

    let done = assert.async(5);
    let rules;

    rules = [
        'always_included_rule',
        '!# if adguard',
        'invalid_if_space',
        "!#endif"
    ];

    FilterCompiler.compile(rules, function () {
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

    FilterCompiler.compile(rules, function () {
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

    FilterCompiler.compile(rules, function () {
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

    FilterCompiler.compile(rules, function () {
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

    FilterCompiler.compile(rules, function () {
        assert.ok(false);
        done();
    }, function (ex) {
        assert.ok(ex);
        done();
    });
});

QUnit.test("Test filter compiler - simple includes", function (assert) {
    let done = assert.async();

    let promise = FilterCompiler.download("resources/rules_simple_include.txt", FilterCompilerConditionsConstants);
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

QUnit.test("Test filter compiler - nested includes", function (assert) {
    let done = assert.async();

    let promise = FilterCompiler.download("resources/rules_nested_includes.txt", FilterCompilerConditionsConstants);
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