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

QUnit.test('Test filter downloader', async (assert) => {
    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    let promise = await FilterDownloader.download('resources/rules.txt', FilterCompilerConditionsConstants);

    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'test');
    }, () => {
        assert.ok(false);
    });
});

QUnit.test('Test filter downloader - simple "if" conditions', async (assert) => {
    let rules;
    let promise;

    rules = [
        'always_included_rule',
        '!#if (adguard)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    rules = [
        'always_included_rule',
        '!#if !adguard',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });

    rules = [
        'always_included_rule',
        '!#if !!adguard',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    rules = [
        'always_included_rule',
        '!#if true',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
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

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 3);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
        assert.equal(compiled[2], 'if_adguard_ext_chromium_included_rule');
    });
});

QUnit.test('Test filter downloader - unsupported conditions', async (assert) => {
    let rules = [
        'test',
        '!#if smth',
        'if_adguard_included_rule',
        '!#endif'
    ];

    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    let promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'test');
    });
});

QUnit.test('Test filter downloader - logical "if" conditions', async (assert) => {
    let rules;
    let promise;

    // true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // true && false = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera',
        'if_adguard_ext_opera_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });

    // true || false = true
    rules = [
        'always_included_rule',
        '!#if adguard || adguard_ext_opera',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // true && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // true && false && true = false
    rules = [
        'always_included_rule',
        '!#if adguard && adguard_ext_opera && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // false || true && true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // false && false || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard_ext_firefox || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // false && true && true = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard && adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });
});

QUnit.test('Test filter downloader - "if" conditions brackets', async (assert) => {
    let rules;
    let promise;

    rules = [
        'always_included_rule',
        '!#if (((adguard)))',
        'if_adguard_included_rule',
        '!#endif'
    ];

    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // (true && true) = true
    rules = [
        'always_included_rule',
        '!#if (adguard && adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // (true || false) && false = false
    rules = [
        'always_included_rule',
        '!#if (adguard || adguard_ext_opera) && adguard_ext_firefox',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });

    // (false || false) && (false) = false
    rules = [
        'always_included_rule',
        '!#if ((adguard || adguard_ext_opera) && (adguard_ext_firefox))',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });

    // false || true && (false) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera || adguard && (adguard_ext_firefox)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });

    // !(false) = true
    rules = [
        'always_included_rule',
        '!#if !(adguard_ext_opera)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // false && true || true = true
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && adguard || adguard_ext_chromium',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'always_included_rule');
        assert.equal(compiled[1], 'if_adguard_included_rule');
    });

    // false && (true || true) = false
    rules = [
        'always_included_rule',
        '!#if adguard_ext_opera && (adguard || adguard_ext_chromium)',
        'if_adguard_included_rule',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 1);
        assert.equal(compiled[0], 'always_included_rule');
    });
});

QUnit.test('Test filter downloader - invalid "if" conditions', async (assert) => {
    let rules;
    let promise;

    rules = [
        'always_included_rule',
        '!# if adguard',
        'invalid_if_space',
        '!#endif'
    ];

    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then(() => {
        assert.ok(false);
    }, (ex) => {
        assert.ok(ex);
    });

    rules = [
        'always_included_rule',
        '!#if adguard',
        'missing_endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then(() => {
        assert.ok(false);
    }, (ex) => {
        assert.ok(ex);
    });

    rules = [
        'always_included_rule',
        '!#if',
        'invalid_condition',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then(() => {
        assert.ok(false);
    }, (ex) => {
        assert.ok(ex);
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

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then(() => {
        assert.ok(false);
    }, (ex) => {
        assert.ok(ex);
    });

    rules = [
        'always_included_rule',
        '!#if (adguard',
        'invalid_condition_brackets',
        '!#endif'
    ];

    promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants);
    promise.then(() => {
        assert.ok(false);
    }, (ex) => {
        assert.ok(ex);
    });
});

QUnit.test('Test filter downloader - simple includes', async (assert) => {
    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    let promise = FilterDownloader.download('resources/rules_simple_include.txt', FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 2);
        assert.equal(compiled[0], 'test_main');
        assert.equal(compiled[1], 'test');
    }, () => {
        assert.ok(false);
    });
});

QUnit.test('Test filter downloader - nested includes', async (assert) => {
    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    let promise = FilterDownloader.download('resources/rules_nested_includes.txt', FilterCompilerConditionsConstants);
    promise.then((compiled) => {
        assert.ok(compiled);
        assert.equal(compiled.length, 5);
        assert.equal(compiled[0], 'test_parent');
        assert.equal(compiled[1], 'test_main');
        assert.equal(compiled[2], 'test');
        assert.equal(compiled[3], 'test_main');
        assert.equal(compiled[4], 'test');
    }, () => {
        assert.ok(false);
    });
});

QUnit.test('Test filter downloader - invalid includes', async (assert) => {
    let rules;

    const FilterDownloader = require('../main/filter-downloader.js');
    assert.ok(FilterDownloader);

    // non existing file
    rules = [
        'always_included_rule',
        '!#include resources/not_found_file.txt'
    ];

    let promise = FilterDownloader.compile(rules, null, FilterCompilerConditionsConstants)
    promise.then(() => {
            assert.ok(false);
        }, (ex) => {
            assert.ok(ex);
        }
    );

    // different origin
    rules = [
        'always_included_rule',
        '!#include http://filters.adtidy.org/windows/filters/14.txt'
    ];

    promise = FilterDownloader.compile(rules, 'http://google.com', FilterCompilerConditionsConstants)
    promise.then(() => {
            assert.ok(false);
        }, (ex) => {
            assert.ok(ex);
        }
    );
});
