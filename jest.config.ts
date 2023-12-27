export default {
    transform: {
        '^.+\\.(t|j)s$': '@swc/jest',
    },
    testPathIgnorePatterns: [
        '/node_modules/',
        '/_qunit_tests_/',
        '/__tests__/server/',
    ],
};
