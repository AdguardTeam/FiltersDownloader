import { describe, expect, it } from 'vitest';

import {
    parseUrlCredentials,
    redactUrlCredentials,
    stripUrlCredentials,
} from '../../src/common/url';

const PARSE_CASES = [
    {
        name: 'a url without userinfo',
        url: 'https://example.org/filter.txt',
        expected: { url: 'https://example.org/filter.txt' },
    },
    {
        name: 'a username and a password',
        url: 'https://user:password@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'a username without a password',
        url: 'https://user@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: '' },
        },
    },
    {
        name: 'an empty userinfo',
        url: 'https://@example.org/filter.txt',
        expected: { url: 'https://example.org/filter.txt' },
    },
    {
        name: 'an empty username and password',
        url: 'https://:@example.org/filter.txt',
        expected: { url: 'https://example.org/filter.txt' },
    },
    {
        name: 'a protocol-relative url',
        url: '//user:password@example.org/filter.txt',
        expected: {
            url: '//example.org/filter.txt',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'percent-encoded credentials',
        url: 'https://user%40name:p%40ss@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user@name', password: 'p@ss' },
        },
    },
    {
        name: 'malformed percent-encoding',
        url: 'https://user%zz:password@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user%zz', password: 'password' },
        },
    },
    {
        name: 'an at sign in the path',
        url: 'https://example.org/user@example.org/filter.txt',
        expected: { url: 'https://example.org/user@example.org/filter.txt' },
    },
    {
        name: 'an at sign in the query',
        url: 'https://example.org/filter.txt?email=user@example.org',
        expected: { url: 'https://example.org/filter.txt?email=user@example.org' },
    },
    {
        name: 'a backslash after the host',
        url: 'http://A\\@B/filter.txt',
        expected: { url: 'http://A\\@B/filter.txt' },
    },
    {
        name: 'an at sign in the userinfo',
        url: 'https://user:p@ss@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: 'p@ss' },
        },
    },
];

describe('parseUrlCredentials', () => {
    it.each(PARSE_CASES)('parses $name', ({ url, expected }) => {
        expect(parseUrlCredentials(url)).toEqual(expected);
    });
});

describe('stripUrlCredentials', () => {
    it.each(PARSE_CASES)('returns the url without userinfo for $name', ({ url, expected }) => {
        expect(stripUrlCredentials(url)).toBe(expected.url);
    });
});

const REDACT_CASES = [
    {
        name: 'an include directive',
        text: '!#include https://user:password@example.org/filter.txt',
        expected: '!#include https://example.org/filter.txt',
    },
    {
        name: 'an indented protocol-relative url',
        text: '\t//user:password@example.org/filter.txt',
        expected: '\t//example.org/filter.txt',
    },
    {
        name: 'several urls',
        text: 'https://user:password@example.org/a.txt https://user2:password2@example.org/b.txt',
        expected: 'https://example.org/a.txt https://example.org/b.txt',
    },
    {
        name: 'a url without userinfo',
        text: 'https://example.org/filter.txt',
        expected: 'https://example.org/filter.txt',
    },
    {
        name: 'an at sign in the path',
        text: 'https://example.org/user@example.org/filter.txt',
        expected: 'https://example.org/user@example.org/filter.txt',
    },
    {
        name: 'text without urls',
        text: '||example.org^',
        expected: '||example.org^',
    },
];

describe('redactUrlCredentials', () => {
    it.each(REDACT_CASES)('redacts $name', ({ text, expected }) => {
        expect(redactUrlCredentials(text)).toBe(expected);
    });
});
