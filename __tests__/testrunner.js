/* globals require, QUnit */

/**
 * @typedef {Object} assert
 * @property {function} equal
 * @property {function} ok
 * @property {function} notOk
 */

(() => {
    "use strict";

    const testRunner = require("qunit");

    testRunner.setup({
        log: {
            // log assertions overview
            assertions: false,
            // log expected and actual values for failed __tests__
            errors: true,
            // log __tests__ overview
            tests: false,
            // log summary
            summary: true,
            // log global summary (all files)
            globalSummary: true,
            // log coverage
            coverage: true,
            // log global coverage (all files)
            globalCoverage: true,
            // log currently testing code file
            testing: false
        },
        // max amount of ms child can be blocked, after that we assume running an infinite loop
        maxBlockDuration: 50000
    });

    const testCallback = function (err, report) {
        if (err) {
            console.error(err);
        }
    };

    testRunner.run({
        code: "./src/index.js",
        tests: "./__tests__/filters-downloader.test.js"
    }, testCallback);
})();
