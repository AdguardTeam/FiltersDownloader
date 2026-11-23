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
        name: 'a literal percent sign in the password',
        url: 'https://user:50% off@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user', password: '50% off' },
        },
    },
    {
        name: 'a literal percent sign in the username',
        url: 'https://p%ss^word:password@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'p%ss^word', password: 'password' },
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
        name: 'a space in the username',
        url: 'https://user name:password@example.org/filter.txt',
        expected: {
            url: 'https://example.org/filter.txt',
            credentials: { username: 'user name', password: 'password' },
        },
    },
    {
        name: 'a hash at the start of the password',
        url: 'https://admin:#Secret1@example.org/list.txt',
        expected: {
            url: 'https://example.org/list.txt',
            credentials: { username: 'admin', password: '#Secret1' },
        },
    },
    {
        name: 'a question mark at the start of the password',
        url: 'https://admin:?Secret1@example.org/list.txt',
        expected: {
            url: 'https://example.org/list.txt',
            credentials: { username: 'admin', password: '?Secret1' },
        },
    },
    {
        name: 'a protocol-relative hash at the start of the password',
        url: '//admin:#Secret1@example.org/list.txt',
        expected: {
            url: '//example.org/list.txt',
            credentials: { username: 'admin', password: '#Secret1' },
        },
    },
    {
        name: 'a hash at the start of the password and a single-label host',
        url: 'https://admin:#Secret1@localhost/list.txt',
        expected: {
            url: 'https://localhost/list.txt',
            credentials: { username: 'admin', password: '#Secret1' },
        },
    },
    {
        name: 'a question mark at the start of the password and a single-label host',
        url: 'https://admin:?Secret1@localhost/list.txt',
        expected: {
            url: 'https://localhost/list.txt',
            credentials: { username: 'admin', password: '?Secret1' },
        },
    },
    {
        name: 'a protocol-relative hash at the start of the password and a single-label host',
        url: '//admin:#Secret1@localhost/list.txt',
        expected: {
            url: '//localhost/list.txt',
            credentials: { username: 'admin', password: '#Secret1' },
        },
    },
    {
        name: 'a hash at the start of the password and a single-label host with a path',
        url: 'http://user:#pw@fileserver/list.txt',
        expected: {
            url: 'http://fileserver/list.txt',
            credentials: { username: 'user', password: '#pw' },
        },
    },
    {
        name: 'a question mark at the start of the password and a single-label host with a path',
        url: 'http://user:?pw@fileserver/list.txt',
        expected: {
            url: 'http://fileserver/list.txt',
            credentials: { username: 'user', password: '?pw' },
        },
    },
    {
        name: 'a hash at the start of the password and a single-label host with a query',
        url: 'http://user:#Secret1@fileserver?format=adblock',
        expected: {
            url: 'http://fileserver?format=adblock',
            credentials: { username: 'user', password: '#Secret1' },
        },
    },
    {
        name: 'a question mark at the start of the password and a single-label host with a query',
        url: 'http://user:?Secret1@fileserver?format=adblock',
        expected: {
            url: 'http://fileserver?format=adblock',
            credentials: { username: 'user', password: '?Secret1' },
        },
    },
    {
        name: 'a hash at the start of the password and a single-label host at the end of the value',
        url: 'http://user:#Secret1@fileserver',
        expected: {
            url: 'http://fileserver',
            credentials: { username: 'user', password: '#Secret1' },
        },
    },
    {
        name: 'a hash at the start of the password and a single-label host with a fragment',
        url: 'http://user:#Secret1@fileserver#section',
        expected: {
            url: 'http://fileserver#section',
            credentials: { username: 'user', password: '#Secret1' },
        },
    },
    {
        // A single-label host with an empty port is ambiguous with malformed
        // userinfo, so a valid URL with an at sign in the query is read as
        // credentials. A credential leak is worse than a wrong request target
        // for this rare form.
        name: 'an empty port on a single-label host and an at sign in the query',
        url: 'http://localhost:?token=a@b',
        expected: {
            url: 'http://b',
            credentials: { username: 'localhost', password: '?token=a' },
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
        name: 'an empty port and an at sign in the query',
        url: 'http://example.org:?token=a@b',
        expected: { url: 'http://example.org:?token=a@b' },
    },
    {
        name: 'an empty port and an at sign in a query value with a path',
        url: 'http://example.org:?token=a@b/path',
        expected: { url: 'http://example.org:?token=a@b/path' },
    },
    {
        name: 'an empty port and a dotted value after the at sign',
        url: 'https://example.org:?email=user@example.com',
        expected: { url: 'https://example.org:?email=user@example.com' },
    },
    {
        name: 'an empty port and a dotted value after the at sign in a fragment',
        url: 'http://example.org:#x@y.z/p',
        expected: { url: 'http://example.org:#x@y.z/p' },
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

    it.each([
        'https://admin:2024#Secret1@example.org/list.txt',
        'https://admin:2024?Secret1@example.org/list.txt',
    ])('leaves a password that starts with digits and contains ? or # unchanged: %s', (url) => {
        expect(parseUrlCredentials(url)).toEqual({ url });
    });
});

describe('stripUrlCredentials', () => {
    it.each(PARSE_CASES)('returns the url without userinfo for $name', ({ url, expected }) => {
        expect(stripUrlCredentials(url)).toBe(expected.url);
    });

    it('removes credentials from a url inside a path', () => {
        const pathWithUrl = '/filters/https:/user:pa"ss-secret@example.org/filter.txt';

        expect(stripUrlCredentials(pathWithUrl))
            .toBe('/filters/https:/example.org/filter.txt');
    });

    it('removes credentials from a url inside a windows path', () => {
        const pathWithUrl = 'C:\\filters\\https:\\user:pa"ss-secret@example.org\\filter.txt';

        expect(stripUrlCredentials(pathWithUrl))
            .toBe('C:\\filters\\https:\\example.org\\filter.txt');
    });

    it('removes credentials from the first embedded url that has them', () => {
        const pathWithUrls = '/filters/https://example.org/https:/user:pa"ss-secret@example.org/filter.txt';

        expect(stripUrlCredentials(pathWithUrls))
            .toBe('/filters/https://example.org/https:/example.org/filter.txt');
    });

    it('removes credentials from every embedded url', () => {
        const line = '! a https://user:pa"ss1@a.org/x https://user:pa\'ss2@b.org/y';

        expect(stripUrlCredentials(line)).toBe('! a https://a.org/x https://b.org/y');
    });

    it('removes credentials from an url at the start and an embedded url', () => {
        const line = 'https://user:pa"ss1@a.org/x https://user:pa\'ss2@b.org/y';

        expect(stripUrlCredentials(line)).toBe('https://a.org/x https://b.org/y');
    });

    it.each([
        {
            name: 'a scriptlet rule',
            rule: "estuary.dev#%#//scriptlet('set-local-storage-item', "
                + "'@estuary/closeBlogPostPopup/blogPostPopup_2025/03/12', '1')",
        },
        {
            name: 'an xpath rule',
            rule: 'hulu.com##+js(xml-prune, xpath(//*[name()="Period"][starts-with(@id,"ad")]))',
        },
    ])('keeps rule syntax without credentials for $name', ({ rule }) => {
        expect(stripUrlCredentials(rule)).toBe(rule);
    });

    it('returns a long text with many urls unchanged', () => {
        const text = `${'https://example.org/x '.repeat(9000)}x@`;

        expect(stripUrlCredentials(text)).toBe(text);
    });

    it('removes credentials from a long text with many urls', () => {
        const unit = 'https://u:p@a/';

        expect(stripUrlCredentials(unit.repeat(4000))).toBe('https://a/'.repeat(4000));
    });

    it.each([
        {
            name: 'a digit-first hash password',
            url: 'https://admin:2024#Secret1@example.org/list.txt',
            expected: 'https://example.org/list.txt',
        },
        {
            // The username is empty, so the scheme prefix must not give back
            // one of its slashes to satisfy the username part of the pattern.
            name: 'a digit-first hash password without a username',
            url: 'https://:2024#Secret1@example.org/f.txt',
            expected: 'https://example.org/f.txt',
        },
        {
            name: 'a digit-first hash password without a username and with one slash',
            url: 'https:/:2024#Secret1@example.org/f.txt',
            expected: 'https:/example.org/f.txt',
        },
        {
            name: 'a digit-first question mark password',
            url: 'https://admin:2024?Secret1@example.org/list.txt',
            expected: 'https://example.org/list.txt',
        },
        {
            // Digits that overflow the port range make the candidate
            // unparsable, so the redaction reads the digit-first form without
            // the parser.
            name: 'a digit-first hash password with digits that overflow the port range',
            url: 'https://admin:20241117#Secret1@example.org/list.txt',
            expected: 'https://example.org/list.txt',
        },
        {
            name: 'a digit-first question mark password with digits that overflow the port range',
            url: 'https://admin:20241117?Secret1@example.org/list.txt',
            expected: 'https://example.org/list.txt',
        },
        {
            name: 'a protocol-relative digit-first hash password',
            url: '//admin:2024#Secret1@example.org/list.txt',
            expected: '//example.org/list.txt',
        },
        {
            name: 'a digit-first hash password and a single-label host with a numeric port',
            url: 'https://fileserver:8080#x@example.org',
            expected: 'https://example.org',
        },
        {
            name: 'a digit-first question mark password and a single-label host with a numeric port',
            url: 'https://fileserver:8080?x@example.org',
            expected: 'https://example.org',
        },
        {
            name: 'a digit-first hash password and a single-label host with a path',
            url: 'https://admin:2024#Secret1@fileserver/list.txt',
            expected: 'https://fileserver/list.txt',
        },
        {
            name: 'a digit-first hash password and a single-label host with a query',
            url: 'https://admin:2024#Secret1@fileserver?format=adblock',
            expected: 'https://fileserver?format=adblock',
        },
        {
            name: 'a digit-first hash password and a single-label host at the end of the value',
            url: 'https://admin:2024#Secret1@fileserver',
            expected: 'https://fileserver',
        },
        {
            name: 'a digit-first hash password and a second at sign in the query',
            url: 'https://admin:2024#Secret1@example.org?a@b',
            expected: 'https://example.org?a@b',
        },
        {
            name: 'a digit-first hash password and an email query',
            url: 'https://admin:2024#Secret1@example.org?email=user@example.com',
            expected: 'https://example.org?email=user@example.com',
        },
        {
            name: 'a digit-first password with an at sign and an email query',
            url: 'https://admin:2024#Se@cret@example.org?email=user@example.com',
            expected: 'https://example.org?email=user@example.com',
        },
        {
            name: 'a digit-first password with an at sign and a query at sign',
            url: 'https://admin:2024#Se@cret@example.org?a@b',
            expected: 'https://example.org?a@b',
        },
        {
            name: 'a digit-first hash password and a path at sign',
            url: 'https://admin:2024#Secret1@example.org/a@b',
            expected: 'https://example.org/a@b',
        },
        {
            name: 'a digit-first password with an at sign and a path at sign',
            url: 'https://admin:2024#Se@cret@example.org/a@b',
            expected: 'https://example.org/a@b',
        },
        {
            name: 'a single-label host with a numeric port and a second at sign in the query',
            url: 'https://fileserver:8080?x@example.org&y@z',
            expected: 'https://z',
        },
        {
            name: 'a localhost digit-first hash password',
            url: 'https://localhost:2024#Secret1@example.org/f.txt',
            expected: 'https://example.org/f.txt',
        },
        {
            name: 'a localhost digit-first question mark password',
            url: 'https://localhost:2024?Secret1@example.org/f.txt',
            expected: 'https://example.org/f.txt',
        },
        {
            // `localhost` is treated as a username even though it can be a
            // host, because a leak is worse than a wrong host in display text.
            name: 'a valid localhost url with a port and an at sign in the fragment',
            url: 'https://localhost:8080#contact@example.org',
            expected: 'https://example.org',
        },
        {
            // A password can contain `/` after `?` or `#`, so the candidate
            // does not stop at a path separator.
            name: 'a digit-first hash password with a slash',
            url: 'https://admin:2024#Se/cret@example.org/f.txt',
            expected: 'https://example.org/f.txt',
        },
        {
            name: 'a digit-first question mark password with a slash',
            url: 'https://admin:2024?Se/cret@example.org/f.txt',
            expected: 'https://example.org/f.txt',
        },
        {
            name: 'a digit-first hash password with a backslash',
            url: 'https://admin:2024#Se\\cret@example.org/f.txt',
            expected: 'https://example.org/f.txt',
        },
        {
            // The username is empty and the password contains a slash, so
            // neither the broad match nor a username-first digit-first match
            // can find the at sign. The optional username covers the form.
            name: 'a digit-first hash password with a slash and no username',
            url: 'https://:2024#Se/cret@example.org',
            expected: 'https://example.org',
        },
        {
            name: 'a digit-first question mark password with a slash and no username',
            url: 'https://:2024?Se/cret@example.org',
            expected: 'https://example.org',
        },
        {
            name: 'a digit-first hash password with a backslash and no username',
            url: 'https://:2024#Se\\cret@example.org',
            expected: 'https://example.org',
        },
        {
            // A later at sign can belong to the password, so the redaction
            // ends at it even though no host remains after it. Falling back to
            // the first at sign would keep `example.org,admin` in the text.
            name: 'a digit-first hash password and an at sign at the end of the value',
            url: 'https://admin:2024#Secret1@example.org,admin@',
            expected: 'https://',
        },
        {
            // The text between the at signs is part of the password, so the
            // whole token is removed rather than leaving `cret@` behind.
            name: 'a digit-first password that ends with an at sign',
            url: 'https://admin:2024#Se@cret@',
            expected: 'https://',
        },
    ])('removes $name from display text', ({ url, expected }) => {
        expect(stripUrlCredentials(url)).toBe(expected);
    });

    it('removes a digit-first password that contains an at sign', () => {
        // The redaction ends at the last at sign in the URL token, so a
        // password that itself contains an at sign is removed too.
        expect(stripUrlCredentials('https://admin:2024#Se@cret@example.org/f.txt'))
            .toBe('https://example.org/f.txt');
    });

    it('keeps prose after a digit-first url', () => {
        // The greedy broad match used to end at the last at sign before `/`,
        // which swallowed the prose up to the email address.
        expect(stripUrlCredentials('Failed: https://admin:2024#Secret1@example.org and user@example.com'))
            .toBe('Failed: https://example.org and user@example.com');
    });

    it('removes a digit-first password that contains a space and an at sign', () => {
        // The first at sign is followed by a space, so the text after it is
        // not a URL tail. The text between the at signs can be part of a
        // password, so the redaction ends at the last at sign in the text.
        expect(stripUrlCredentials('https://admin:2024#Se@ cret@example.org'))
            .toBe('https://example.org');
    });

    it('swallows prose when the first at sign is followed by a space and a later at sign follows', () => {
        // The text between the URL and the at sign that becomes the separator
        // can be part of a password, so it is removed. Here a later at sign
        // follows the space, so the redaction ends at that at sign. The host
        // of the result can be wrong, but no password part remains.
        expect(stripUrlCredentials('Read https://admin:2024#Secret1@ and user@example.com now'))
            .toBe('Read https://example.com now');
    });

    it('removes prose up to an at sign that ends a quoted statement', () => {
        // The at sign in the email address becomes the separator, so the
        // closing quote and the words between the URL and the at sign are
        // removed with the password candidate.
        expect(stripUrlCredentials("Failed to request 'https://a:1#b' for admin@example.org"))
            .toBe("Failed to request 'https://example.org");
    });

    it.each([
        'https://example.org:8080#contact@example.org',
        'https://example.org:8080?x@y',
        'https://[::1]:8080#contact@example.org',
        // The tail check keeps an at sign that ends the value unchanged: the
        // text after it does not look like a host and the rest of a URL.
        'https://a:1#b@',
        'https://fileserver:8080#x@',
        // A dotted username cannot be told from a dotted host with a port, so
        // this value stays unchanged.
        'https://john.doe:2024#pw@example.org/f.txt',
        // An IPv6 literal has a colon inside the brackets, so the username
        // part of the digit-first pattern ends there and cannot match.
        'https://[::1]:2024#Secret1@example.org/f.txt',
        // A path after the port tells a digit-first password from a valid URL,
        // because the port and the query or fragment no longer follow the URL
        // prefix directly.
        'https://myhost:8080/path?email=user@example.com',
        'https://myhost:8080/path#contact@example.org',
    ])('keeps a valid url with a port and an at sign in the query or fragment: %s', (url) => {
        expect(stripUrlCredentials(url)).toBe(url);
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
        // A port before the whitespace is indistinguishable from the first
        // word of a numeric password, so the text is redacted to prevent a
        // leak. The host in the redacted text can be wrong, but it is safe.
        name: 'prose after a url with a port',
        text: 'See https://example.org:8080 and user@example.org',
        expected: 'See https://example.org',
    },
    {
        name: 'a password that starts with a number and contains a space',
        text: '! Source: https://user:123 secret@example.org/list.txt',
        expected: '! Source: https://example.org/list.txt',
    },
    {
        // `new URL()` hides a port that is the default port of the scheme, so
        // the candidate `https://user:443` has no port. It is still
        // indistinguishable from the first word of a password.
        name: 'a default https port at the start of a password',
        text: '! Source: https://user:443 secret@example.org/list.txt',
        expected: '! Source: https://example.org/list.txt',
    },
    {
        name: 'a default http port at the start of a password',
        text: '! Source: http://user:80 secret@example.org/list.txt',
        expected: '! Source: http://example.org/list.txt',
    },
    {
        name: 'a protocol-relative default port at the start of a password',
        text: '! Source: //user:443 secret@example.org/list.txt',
        expected: '! Source: //example.org/list.txt',
    },
    {
        name: 'a hash at the start of the password',
        text: "Failed to request url 'https://admin:#Secret1@example.org/list.txt'",
        expected: "Failed to request url 'https://example.org/list.txt'",
    },
    {
        name: 'a question mark at the start of the password',
        text: "Failed to request url 'https://admin:?Secret1@example.org/list.txt'",
        expected: "Failed to request url 'https://example.org/list.txt'",
    },
    {
        name: 'a protocol-relative hash at the start of the password',
        text: 'see //admin:#Secret1@example.org/list.txt',
        expected: 'see //example.org/list.txt',
    },
    {
        name: 'a hash at the start of the password and a single-label host',
        text: "Failed to request url 'https://admin:#Secret1@localhost/list.txt'",
        expected: "Failed to request url 'https://localhost/list.txt'",
    },
    {
        name: 'a question mark at the start of the password and a single-label host',
        text: "Failed to request url 'https://admin:?Secret1@localhost/list.txt'",
        expected: "Failed to request url 'https://localhost/list.txt'",
    },
    {
        name: 'a hash at the start of the password and a single-label host with a path',
        text: "Failed to request url 'http://user:#pw@fileserver/list.txt'",
        expected: "Failed to request url 'http://fileserver/list.txt'",
    },
    {
        name: 'a hash at the start of the password and a single-label host with a query',
        text: "Failed to request url 'http://user:#Secret1@fileserver?format=adblock'",
        expected: "Failed to request url 'http://fileserver?format=adblock'",
    },
    {
        name: 'a question mark at the start of the password and a single-label host with a query',
        text: "Failed to request url 'http://user:?Secret1@fileserver?format=adblock'",
        expected: "Failed to request url 'http://fileserver?format=adblock'",
    },
    {
        name: 'a hash at the start of the password and a single-label host at the end of the value',
        text: "Failed to request url 'http://user:#Secret1@fileserver'",
        expected: "Failed to request url 'http://fileserver'",
    },
    {
        name: 'a hash at the start of the password and a single-label host with a fragment',
        text: "Failed to request url 'http://user:#Secret1@fileserver#section'",
        expected: "Failed to request url 'http://fileserver#section'",
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

    it('redacts a known url with a space in the username', () => {
        const url = 'https://user name:secret@example.org/filter.txt';
        const error = new Error(`Failed to fetch ${url}`);

        redactErrorCredentials(error, undefined, url);

        expect(error.message).toBe('Failed to fetch https://example.org/filter.txt');
    });

    it('redacts a known url inside a path', () => {
        const url = '/filters/https:/user:pa"ss-secret@example.org/filter.txt';
        const error = Object.assign(new Error(`Cannot open ${url}`), { path: url });

        redactErrorCredentials(error, undefined, url);

        expect(error.message).toBe('Cannot open /filters/https:/example.org/filter.txt');
        expect(error.path).toBe('/filters/https:/example.org/filter.txt');
    });

    it('redacts a known url and its resolved path', () => {
        const url = "https:/user:pa'ss-secret@example.org//list.txt";
        const sanitizedUrl = 'https:/example.org//list.txt';
        const resolvedUrl = "/cwd/https:/user:pa'ss-secret@example.org/list.txt";
        const resolvedSanitizedUrl = '/cwd/https:/example.org/list.txt';
        const error = Object.assign(new Error(`ENOENT: open '${resolvedUrl}'`), {
            path: resolvedUrl,
        });

        redactErrorCredentials(error, undefined, [
            [resolvedUrl, resolvedSanitizedUrl],
            [url, sanitizedUrl],
        ]);

        expect(error.message).toBe(`ENOENT: open '${resolvedSanitizedUrl}'`);
        expect(error.path).toBe(resolvedSanitizedUrl);
    });

    it('redacts a known url and its windows resolved path', () => {
        const url = 'https:/user:pa"ss-secret@example.org/filter.txt';
        const sanitizedUrl = 'https:/example.org/filter.txt';
        const resolvedUrl = 'C:\\cwd\\https:\\user:pa"ss-secret@example.org\\filter.txt';
        const resolvedSanitizedUrl = 'C:\\cwd\\https:\\example.org\\filter.txt';
        const error = Object.assign(new Error(`ENOENT: open '${resolvedUrl}'`), {
            path: resolvedUrl,
        });

        redactErrorCredentials(error, undefined, [
            [resolvedUrl, resolvedSanitizedUrl],
            [url, sanitizedUrl],
        ]);

        expect(error.message).toBe(`ENOENT: open '${resolvedSanitizedUrl}'`);
        expect(error.path).toBe(resolvedSanitizedUrl);
    });

    it('redacts string properties of a plain object cause', () => {
        const cause = { url: 'https://user:secret@example.org/filter.txt' };
        const error = new Error('Request failed', { cause });

        redactErrorCredentials(error);

        expect(error.cause).toBe(cause);
        expect(cause.url).toBe('https://example.org/filter.txt');
    });

    it('redacts string properties of a plain object in nested errors', () => {
        const nestedError = { message: 'https://user:secret@example.org/filter.txt' };
        const error = new AggregateError([nestedError], 'Request failed');

        redactErrorCredentials(error);

        expect(nestedError.message).toBe('https://example.org/filter.txt');
    });

    it('returns a redacted copy for a frozen plain object cause', () => {
        const cause = Object.freeze({ url: 'https://user:secret@example.org/filter.txt' });
        const error = new Error('Request failed', { cause });

        const redactedError = redactErrorCredentials(error) as Error;

        expect(redactedError.cause).not.toBe(cause);
        expect((redactedError.cause as { url: string }).url)
            .toBe('https://example.org/filter.txt');
    });

    it('redacts strings in a nested plain object cause', () => {
        const cause = { config: { url: 'https://user:secret@example.org/filter.txt' } };
        const error = new Error('Request failed', { cause });

        redactErrorCredentials(error);

        expect(cause.config.url).toBe('https://example.org/filter.txt');
    });

    it('redacts strings in nested objects and arrays of a cause', () => {
        const nestedRequest = { url: 'https://user:secret@example.org/a.txt' };
        const cause = {
            requests: [
                nestedRequest,
                'https://user:secret@example.org/b.txt',
            ],
        };
        const error = new Error('Request failed', { cause });

        redactErrorCredentials(error);

        expect(nestedRequest.url).toBe('https://example.org/a.txt');
        expect(cause.requests[1]).toBe('https://example.org/b.txt');
    });

    it('redacts a nested frozen plain object in a cause', () => {
        const config = Object.freeze({ url: 'https://user:secret@example.org/filter.txt' });
        const cause = { config };
        const error = new Error('Request failed', { cause });

        redactErrorCredentials(error);

        expect(error.cause).toBe(cause);
        expect((cause.config as { url: string }).url).toBe('https://example.org/filter.txt');
    });

    it('returns a redacted copy for a frozen cause with a nested frozen object', () => {
        const config = Object.freeze({ url: 'https://user:secret@example.org/filter.txt' });
        const cause = Object.freeze({ config });
        const error = new Error('Request failed', { cause });

        const redactedError = redactErrorCredentials(error) as Error;

        expect(redactedError.cause).not.toBe(cause);
        expect((redactedError.cause as { config: { url: string } }).config.url)
            .toBe('https://example.org/filter.txt');
    });
});
