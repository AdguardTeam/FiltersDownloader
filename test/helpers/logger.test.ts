import { describe, expect, it } from 'vitest';

import { throwError } from '../../src/helpers/logger';

/**
 * Runs a function that must throw and returns the message of the error.
 *
 * @param callback Function that must throw.
 *
 * @returns Message of the thrown error.
 *
 * @throws If the callback does not throw.
 */
const getErrorMessage = (callback: () => void): string => {
    try {
        callback();
    } catch (error) {
        return (error as Error).message;
    }

    throw new Error('The callback did not throw');
};

describe('throwError', () => {
    it('removes credentials from the error rule and the context lines', () => {
        const rule = '!#include https://user:password@example.org/include.txt';
        const context = [
            '\t!#include https://user:secret@example.org/previous.txt',
            '\t||example.com^',
        ].join('\n');

        const message = getErrorMessage(() => throwError(
            'Failed to resolve the include directive',
            rule,
            context,
        ));

        expect(message).toBe(`${[
            "Failed to resolve the include directive '!#include https://example.org/include.txt'",
            'Context:',
            '\t!#include https://example.org/previous.txt',
            '\t||example.com^',
            '\t!#include https://example.org/include.txt',
        ].join('\n')}\n`);
        expect(message).not.toContain('password');
        expect(message).not.toContain('secret');
    });

    it.each([
        { name: 'a single quote', password: "pa'ss" },
        { name: 'a double quote', password: 'pa"ss' },
        { name: 'an angle bracket', password: 'pa<ss' },
    ])('removes $name password from an include directive', ({ password }) => {
        const rule = `!#include http://user:${password}@example.org/include.txt`;
        const context = `\t!#include http://user:${password}@example.org/previous.txt`;

        const message = getErrorMessage(() => throwError(
            'Failed to resolve the include directive',
            rule,
            context,
        ));

        expect(message).toContain('!#include http://example.org/include.txt');
        expect(message).toContain('!#include http://example.org/previous.txt');
        expect(message).not.toContain(password);
    });

    it('keeps rules without credentials unchanged', () => {
        const message = getErrorMessage(() => throwError(
            'Found unexpected condition end:',
            '!#endif',
            '\t||example.com^',
        ));

        expect(message).toBe(`${[
            "Found unexpected condition end: '!#endif'",
            'Context:',
            '\t||example.com^',
            '\t!#endif',
        ].join('\n')}\n`);
    });
});
