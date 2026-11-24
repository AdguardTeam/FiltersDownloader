import { describe, expect, it } from 'vitest';

import {
    redactErrorCredentials,
    resolveIncludePath,
    stripUrlCredentials,
} from '../src';
import {
    redactErrorCredentials as redactErrorCredentialsBrowser,
    resolveIncludePath as resolveIncludePathBrowser,
    stripUrlCredentials as stripUrlCredentialsBrowser,
} from '../src/index.browser';

describe('public exports', () => {
    it('exports stripUrlCredentials from the Node.js entry point', () => {
        expect(stripUrlCredentials('https://user:password@example.org/filter.txt'))
            .toBe('https://example.org/filter.txt');
    });

    it('exports stripUrlCredentials from the browser entry point', () => {
        expect(stripUrlCredentialsBrowser('https://user:pa#ss@example.org/filter.txt'))
            .toBe('https://example.org/filter.txt');
    });

    it('exports the isSchemaless argument from the Node.js entry point', () => {
        expect(stripUrlCredentials('sub/user:pass@example.org/filter.txt', true))
            .toBe('sub/example.org/filter.txt');
    });

    it('exports the isSchemaless argument from the browser entry point', () => {
        expect(stripUrlCredentialsBrowser('sub/user:pass@example.org/filter.txt', true))
            .toBe('sub/example.org/filter.txt');
    });

    it('exports redactErrorCredentials from the Node.js entry point', () => {
        const error = new Error('Failed: https://user:secret@example.org/filter.txt');

        redactErrorCredentials(error);

        expect(error.message).toBe('Failed: https://example.org/filter.txt');
    });

    it('exports redactErrorCredentials with a known url from the Node.js entry point', () => {
        const knownUrl = 'https://user:pa\'ss@example.org/filter.txt';
        const error = new Error(`Failed: ${knownUrl}`);

        redactErrorCredentials(error, knownUrl);

        expect(error.message).toBe('Failed: https://example.org/filter.txt');
    });

    it('exports redactErrorCredentials from the browser entry point', () => {
        const error = new Error('Failed: https://user:secret@example.org/filter.txt');

        redactErrorCredentialsBrowser(error);

        expect(error.message).toBe('Failed: https://example.org/filter.txt');
    });

    it('exports redactErrorCredentials with a known url from the browser entry point', () => {
        const knownUrl = 'https://user:pa\'ss@example.org/filter.txt';
        const error = new Error(`Failed: ${knownUrl}`);

        redactErrorCredentialsBrowser(error, knownUrl);

        expect(error.message).toBe('Failed: https://example.org/filter.txt');
    });

    it('exports resolveIncludePath from the Node.js entry point', () => {
        expect(resolveIncludePath('inclusion.txt', '/tmp/dir')).toBe('inclusion.txt');
    });

    it('exports resolveIncludePath from the browser entry point', () => {
        expect(resolveIncludePathBrowser('../secret.txt', '/tmp/dir')).toBeNull();
    });
});
