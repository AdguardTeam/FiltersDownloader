import { describe, expect, it } from 'vitest';

import { stripUrlCredentials } from '../src';
import {
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
});
