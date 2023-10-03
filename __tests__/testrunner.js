/**
 * @typedef {Object} assert
 * @property {function} equal
 * @property {function} ok
 * @property {function} notOk
 */

(() => {
    // eslint-disable-next-line global-require
    const testRunner = require('node-qunit');

    testRunner.setup({
        log: {
            // log assertions overview
            assertions: false,
            // log expected and actual values for failed tests
            errors: true,
            // log tests overview
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
            testing: false,
        },
        // max amount of ms child can be blocked, after that we assume running an infinite loop
        maxBlockDuration: 50 * 1000, // 50 seconds
    });

    const testCallback = (err, report) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        if (report.failed > 0) {
            process.exit(1);
        }
        console.log('\n✅  Tests completed successfully!\n');
    };

    testRunner.run({
        code: './src/index.js',
        tests: './__tests__/filters-downloader.test.js',
    }, testCallback);
})();
