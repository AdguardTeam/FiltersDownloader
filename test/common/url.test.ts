import { describe, expect, it } from 'vitest';

import {
    parseUrlCredentials,
    redactErrorCredentials,
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
        name: 'a url with one slash after the scheme',
        url: 'https:/user:password@example.org/filter.txt',
        expected: {
            url: 'https:/example.org/filter.txt',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'a url without slashes after the scheme',
        url: 'https:user:password@example.org/filter.txt',
        expected: {
            url: 'https:example.org/filter.txt',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'a url with backslashes after the scheme',
        url: 'https:\\user:password@example.org\\filter.txt',
        expected: {
            url: 'https:\\example.org\\filter.txt',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'a url with three slashes after the scheme',
        url: 'https:///user:password@example.org/filter.txt',
        expected: {
            url: 'https:///example.org/filter.txt',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'a question mark in the password',
        url: 'https://user:pa?ss@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: 'pa?ss' },
        },
    },
    {
        name: 'a hash in the password',
        url: 'https://user:pa#ss@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: 'pa#ss' },
        },
    },
    {
        name: 'a space in the password',
        url: 'https://user:pa ss@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: 'pa ss' },
        },
    },
    {
        name: 'an at sign and a space in the password',
        url: 'https://user:pa@ss word@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: 'pa@ss word' },
        },
    },
    {
        name: 'an at sign in the userinfo',
        url: 'https://user:p@ss@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: 'p@ss' },
        },
    },
    {
        name: 'an at sign in the query without a path',
        url: 'https://example.org?email=user@example.org',
        expected: { url: 'https://example.org?email=user@example.org' },
    },
    {
        name: 'a port and an at sign in the query',
        url: 'https://example.org:8080?x@y',
        expected: { url: 'https://example.org:8080?x@y' },
    },
    {
        name: 'a port and credentials in the query',
        url: 'https://example.org:8443?token=user@example.org',
        expected: { url: 'https://example.org:8443?token=user@example.org' },
    },
    {
        name: 'an ipv6 authority and an at sign in the query',
        url: 'https://[::1]:8080?x@y',
        expected: { url: 'https://[::1]:8080?x@y' },
    },
    {
        name: 'credentials and an at sign in the query without a path',
        url: 'https://user:password@example.org?email=user@example.com',
        expected: {
            url: 'https://example.org?email=user@example.com',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'credentials and an at sign in the fragment without a path',
        url: 'https://user:password@example.org#user@example.com',
        expected: {
            url: 'https://example.org#user@example.com',
            credentials: { username: 'user', password: 'password' },
        },
    },
    {
        name: 'a username and an at sign in the query without a path',
        url: 'https://user@example.org?email=user2@example.com',
        expected: {
            url: 'https://example.org?email=user2@example.com',
            credentials: { username: 'user', password: '' },
        },
    },
    {
        name: 'an at sign in the password and in the query',
        url: 'https://user:p@ss@example.org?x=@y',
        expected: {
            url: 'https://example.org?x=@y',
            credentials: { username: 'user', password: 'p@ss' },
        },
    },
    {
        name: 'a protocol-relative port and an at sign in the query',
        url: '//example.org:8080?x@y',
        expected: { url: '//example.org:8080?x@y' },
    },
    {
        name: 'a protocol-relative port and an at sign in the fragment',
        url: '//example.org:8080#x@y',
        expected: { url: '//example.org:8080#x@y' },
    },
    {
        name: 'a protocol-relative ipv6 authority and an at sign in the query',
        url: '//[::1]:8080?x@y',
        expected: { url: '//[::1]:8080?x@y' },
    },
];

describe('parseUrlCredentials', () => {
    it.each(PARSE_CASES)('parses $name', ({ url, expected }) => {
        expect(parseUrlCredentials(url)).toEqual(expected);
    });

    it.each([
        'https:/user:password@example.org/filter.txt',
        'https:user:password@example.org/filter.txt',
        'https:\\user:password@example.org\\filter.txt',
        'https:///user:password@example.org/filter.txt',
    ])('returns a url that fetch accepts for %s', (url) => {
        const parsedUrl = parseUrlCredentials(url).url;

        expect(new URL(parsedUrl).href).toBe('https://example.org/filter.txt');
    });

    it.each([
        'icon@2x.png',
        'user@host/filter.txt',
        'mailto:someone@example.com',
        'C:\\dir@x\\f.txt',
    ])('does not treat %s as credentials', (url) => {
        expect(parseUrlCredentials(url)).toEqual({ url });
        expect(stripUrlCredentials(url)).toBe(url);
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
        name: 'a url with one slash after the scheme',
        text: '!include https:/user:password@example.org/filter.txt',
        expected: '!include https:/example.org/filter.txt',
    },
    {
        name: 'a url without slashes after the scheme',
        text: '!include https:user:password@example.org/filter.txt',
        expected: '!include https:example.org/filter.txt',
    },
    {
        name: 'a url with backslashes after the scheme',
        text: '!include https:\\user:password@example.org\\filter.txt',
        expected: '!include https:\\example.org\\filter.txt',
    },
    {
        name: 'a url with three slashes after the scheme',
        text: '!include https:///user:password@example.org/filter.txt',
        expected: '!include https:///example.org/filter.txt',
    },
    {
        name: 'a question mark in the password',
        text: '!include https://user:pa?ss@example.org/filter.txt',
        expected: '!include https://example.org/filter.txt',
    },
    {
        name: 'a hash in the password',
        text: '!include https://user:pa#ss@example.org/filter.txt',
        expected: '!include https://example.org/filter.txt',
    },
    {
        name: 'a space in the password',
        text: '!include https://user:pa ss@example.org/filter.txt',
        expected: '!include https://example.org/filter.txt',
    },
    {
        name: 'an at sign and a space in the password',
        text: '!include https://user:pa@ss word@example.org/filter.txt',
        expected: '!include https://example.org/filter.txt',
    },
    {
        name: 'an at sign in a query without credentials',
        text: 'https://example.org?email=user@example.org',
        expected: 'https://example.org?email=user@example.org',
    },
    {
        name: 'a port and an at sign in a query',
        text: "Failed to request url 'https://example.org:8443?token=user@example.org'",
        expected: "Failed to request url 'https://example.org:8443?token=user@example.org'",
    },
    {
        name: 'an ipv6 authority and an at sign in a query',
        text: 'https://[::1]:8080?x@y',
        expected: 'https://[::1]:8080?x@y',
    },
    {
        name: 'credentials and an at sign in a query without a path',
        text: "Failed to request url 'https://user:password@example.org?email=user@example.com'",
        expected: "Failed to request url 'https://example.org?email=user@example.com'",
    },
    {
        name: 'credentials and an at sign in a fragment without a path',
        text: "Failed to request url 'https://user:password@example.org#user@example.com'",
        expected: "Failed to request url 'https://example.org#user@example.com'",
    },
    {
        name: 'a username and an at sign in a query without a path',
        text: "Failed to request url 'https://user@example.org?email=user2@example.com'",
        expected: "Failed to request url 'https://example.org?email=user2@example.com'",
    },
    {
        name: 'an at sign in the password and in the query',
        text: "Failed to request url 'https://user:p@ss@example.org?x=@y'",
        expected: "Failed to request url 'https://example.org?x=@y'",
    },
    {
        name: 'a protocol-relative port and an at sign in a query',
        text: 'see //example.org:8080?x@y',
        expected: 'see //example.org:8080?x@y',
    },
    {
        name: 'a protocol-relative port and an at sign in a fragment',
        text: 'see //example.org:8080#x@y',
        expected: 'see //example.org:8080#x@y',
    },
    {
        name: 'prose after a url with a port',
        text: 'See https://example.org:8080 and user@example.org',
        expected: 'See https://example.org:8080 and user@example.org',
    },
    {
        // A valid URL with credentials followed by prose is indistinguishable
        // from a malformed password that contains a space and an at sign, so
        // the whole match is redacted to avoid leaking the password fragment.
        name: 'a valid url with credentials followed by prose with an at sign',
        text: 'see https://user:pass@example.org and admin@example.org',
        expected: 'see https://example.org',
    },
    {
        name: 'a non-http scheme without slashes',
        text: 'mailto:someone@example.com',
        expected: 'mailto:someone@example.com',
    },
    {
        name: 'a colon after a url without credentials',
        text: 'See https://example.org: the user:pass@example.org',
        expected: 'See https://example.org: the user:pass@example.org',
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

    it('returns a long text without an at sign unchanged', () => {
        const text = '/'.repeat(32000);

        expect(redactUrlCredentials(text)).toBe(text);
    });

    it('redacts a long slash run with an at sign quickly', () => {
        const slashes = '/'.repeat(100000);

        expect(redactUrlCredentials(`${slashes}@x`)).toBe(`${slashes}x`);
    });
});

describe('redactErrorCredentials', () => {
    it('redacts a string cause', () => {
        const error = new Error('Request failed', {
            cause: 'https://user:secret@example.org/filter.txt',
        });

        redactErrorCredentials(error);

        expect(error.cause).toBe('https://example.org/filter.txt');
    });

    it('redacts the read-only message of a DOMException', () => {
        const error = new DOMException('https://user:secret@example.org/filter.txt', 'NetworkError');

        const redactedError = redactErrorCredentials(error);

        expect(redactedError).toBe(error);
        expect(error.message).toBe('https://example.org/filter.txt');
        expect(error.name).toBe('NetworkError');
    });

    it('redacts own enumerable string properties', () => {
        const error = Object.assign(new Error('Request failed'), {
            path: '/tmp/https:/user:secret@example.org/filter.txt',
        });

        redactErrorCredentials(error);

        expect(error.path).toBe('/tmp/https:/example.org/filter.txt');
    });

    it('redacts nested errors', () => {
        const nestedError = new Error('https://user:secret@example.org/filter.txt');
        const error = new AggregateError(
            [nestedError, 'https://user:secret@example.org/filter.txt'],
            'Request failed',
        );

        redactErrorCredentials(error);

        expect((error.errors[0] as Error).message).toBe('https://example.org/filter.txt');
        expect(error.errors[1]).toBe('https://example.org/filter.txt');
    });

    it('returns a redacted copy for a frozen error', () => {
        const error = Object.freeze(new Error('https://user:secret@example.org/filter.txt'));

        const redactedError = redactErrorCredentials(error) as Error;

        expect(redactedError).not.toBe(error);
        expect(redactedError.message).toBe('https://example.org/filter.txt');
    });

    it('keeps the cause of a frozen error', () => {
        const cause = new Error('https://user:secret@example.org/filter.txt');
        const error = Object.freeze(new Error(
            'Request failed for https://user:secret@example.org/filter.txt',
            { cause },
        ));

        const redactedError = redactErrorCredentials(error) as Error;

        expect(redactedError).not.toBe(error);
        expect(redactedError.cause).toBe(cause);
        expect((redactedError.cause as Error).message).toBe('https://example.org/filter.txt');
    });

    it('does not fail on a cycle', () => {
        const error = new Error('Request failed');
        error.cause = error;

        expect(redactErrorCredentials(error)).toBe(error);
    });
});
