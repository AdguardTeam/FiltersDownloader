import {
    describe,
    it,
    expect,
} from 'vitest';

import { resolveIncludePath } from '../../src/common/include-path';

interface IncludePathCase {
    name: string;
    includePath: string;
    filterOrigin: string;
    expected: string | null;
}

const remoteCases: IncludePathCase[] = [
    {
        name: 'resolves an include in the same directory',
        includePath: 'inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/inclusion.txt',
    },
    {
        name: 'resolves an include in a subdirectory',
        includePath: 'sub/inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/sub/inclusion.txt',
    },
    {
        name: 'resolves an include with a dot segment inside the directory',
        includePath: 'sub/../inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/inclusion.txt',
    },
    {
        name: 'collapses duplicate slashes',
        includePath: 'sub//inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/sub/inclusion.txt',
    },
    {
        name: 'ignores an include that escapes through the parent directory',
        includePath: '../secret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'ignores an include with an encoded parent-directory segment',
        includePath: '%2e%2e/secret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'ignores an include with a dot and an encoded parent-directory segment',
        includePath: '.%2e/secret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'ignores an include with an encoded dot and a parent-directory segment',
        includePath: '%2e./secret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'ignores an include with an encoded forward-slash separator',
        includePath: '..%2f..%2fsecret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'ignores an include with an encoded backslash separator',
        includePath: '..%5c..%5csecret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'resolves a root-absolute include inside the directory',
        includePath: '/inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/inclusion.txt',
    },
    {
        name: 'resolves a root-absolute include in a subdirectory',
        includePath: '/sub/inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/sub/inclusion.txt',
    },
    {
        name: 'ignores a root-absolute include that escapes the directory',
        includePath: '/../secret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'ignores a root-absolute include with an encoded parent-directory segment',
        includePath: '/%2e%2e/secret.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'allows an encoded separator in the query',
        includePath: 'inclusion.txt?sig=ab%2Fcd',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/inclusion.txt?sig=ab%2Fcd',
    },
    {
        name: 'allows an encoded separator in the fragment',
        includePath: 'inclusion.txt#ab%2Fcd',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/inclusion.txt#ab%2Fcd',
    },
    {
        name: 'rejects an absolute URL that changes the origin',
        includePath: 'https://evil.example/inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        // A scheme without `//` is parsed as an absolute URL, so this case is
        // stopped only by the origin guard.
        name: 'rejects a path with another scheme that changes the origin',
        includePath: 'http:\\evil.example\\lists\\main\\inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: null,
    },
    {
        name: 'treats leading backslashes as a relative path',
        includePath: '\\\\evil.example\\inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/evil.example/inclusion.txt',
    },
    {
        name: 'treats a slash and a backslash prefix as a relative path',
        includePath: '/\\evil.example/inclusion.txt',
        filterOrigin: 'https://example.org/lists/main',
        expected: 'https://example.org/lists/main/evil.example/inclusion.txt',
    },
    {
        name: 'treats leading backslashes as a relative path at the origin root',
        includePath: '\\\\evil.example\\inclusion.txt',
        filterOrigin: 'https://example.org',
        expected: 'https://example.org/evil.example/inclusion.txt',
    },
    {
        name: 'resolves a relative include with a trailing slash in the origin',
        includePath: 'inclusion.txt',
        filterOrigin: 'https://example.org/lists/main/',
        expected: 'https://example.org/lists/main/inclusion.txt',
    },
    {
        name: 'ignores an escaping include with a trailing slash in the origin',
        includePath: '../secret.txt',
        filterOrigin: 'https://example.org/lists/main/',
        expected: null,
    },
    {
        name: 'resolves an include with a protocol-relative origin',
        includePath: 'inclusion.txt',
        filterOrigin: '//example.org/lists/main',
        expected: '//example.org/lists/main/inclusion.txt',
    },
    {
        name: 'ignores an escaping include with a protocol-relative origin',
        includePath: '../secret.txt',
        filterOrigin: '//example.org/lists/main',
        expected: null,
    },
    {
        name: 'resolves an include against the origin root',
        includePath: 'inclusion.txt',
        filterOrigin: 'https://example.org',
        expected: 'https://example.org/inclusion.txt',
    },
];

const localCases: IncludePathCase[] = [
    {
        name: 'resolves an include in the same local directory',
        includePath: 'inclusion.txt',
        filterOrigin: '/tmp/dir',
        expected: 'inclusion.txt',
    },
    {
        name: 'resolves a local include in a subdirectory',
        includePath: 'sub/inclusion.txt',
        filterOrigin: '/tmp/dir',
        expected: 'sub/inclusion.txt',
    },
    {
        name: 'normalizes a local include with a dot segment',
        includePath: 'sub/../inclusion.txt',
        filterOrigin: '/tmp/dir',
        expected: 'inclusion.txt',
    },
    {
        name: 'collapses duplicate slashes in a local include',
        includePath: 'sub//inclusion.txt',
        filterOrigin: '/tmp/dir',
        expected: 'sub/inclusion.txt',
    },
    {
        name: 'ignores a local include that escapes through the parent directory',
        includePath: '../secret.txt',
        filterOrigin: '/tmp/dir',
        expected: null,
    },
    {
        name: 'ignores a local include with an encoded parent-directory segment',
        includePath: '%2e%2e/secret.txt',
        filterOrigin: '/tmp/dir',
        expected: null,
    },
    {
        name: 'resolves a root-absolute local include inside the filter directory',
        includePath: '/inclusion.txt',
        filterOrigin: '/tmp/dir',
        expected: 'inclusion.txt',
    },
    {
        name: 'resolves a root-absolute local include in a subdirectory',
        includePath: '/sub/inclusion.txt',
        filterOrigin: '/tmp/dir',
        expected: 'sub/inclusion.txt',
    },
    {
        name: 'resolves a Windows include in the same directory',
        includePath: 'inclusion.txt',
        filterOrigin: 'C:\\lists\\main',
        expected: 'inclusion.txt',
    },
    {
        name: 'resolves a Windows include in a subdirectory',
        includePath: 'sub\\inclusion.txt',
        filterOrigin: 'C:\\lists\\main',
        expected: 'sub\\inclusion.txt',
    },
    {
        name: 'ignores a Windows include that escapes the directory',
        includePath: '..\\secret.txt',
        filterOrigin: 'C:\\lists\\main',
        expected: null,
    },
    {
        name: 'resolves an include in the current directory',
        includePath: 'inclusion.txt',
        filterOrigin: '.',
        expected: 'inclusion.txt',
    },
    {
        name: 'ignores an escaping include in the current directory',
        includePath: '../secret.txt',
        filterOrigin: '.',
        expected: null,
    },
    {
        name: 'ignores a doubly escaping include in the current directory',
        includePath: '../../secret.txt',
        filterOrigin: '.',
        expected: null,
    },
    {
        name: 'resolves an include with an empty origin',
        includePath: 'inclusion.txt',
        filterOrigin: '',
        expected: 'inclusion.txt',
    },
    {
        name: 'ignores an escaping include with an empty origin',
        includePath: '../secret.txt',
        filterOrigin: '',
        expected: null,
    },
    {
        name: 'resolves an include inside a relative parent directory',
        includePath: 'inclusion.txt',
        filterOrigin: '..',
        expected: 'inclusion.txt',
    },
    {
        name: 'ignores an include that escapes a relative parent directory',
        includePath: '../inclusion.txt',
        filterOrigin: '..',
        expected: null,
    },
    {
        name: 'resolves a dot segment in a relative directory',
        includePath: 'sub/../inclusion.txt',
        filterOrigin: 'lists/main',
        expected: 'inclusion.txt',
    },
    {
        name: 'ignores an include that escapes a relative directory',
        includePath: '../inclusion.txt',
        filterOrigin: 'lists/main',
        expected: null,
    },
    {
        name: 'resolves an include in a file URL directory',
        includePath: 'inclusion.txt',
        filterOrigin: 'file:///filters',
        expected: 'inclusion.txt',
    },
    {
        name: 'resolves a file URL include in a subdirectory',
        includePath: 'sub/inclusion.txt',
        filterOrigin: 'file:///filters',
        expected: 'sub/inclusion.txt',
    },
    {
        name: 'resolves a root-absolute file URL include inside the directory',
        includePath: '/inclusion.txt',
        filterOrigin: 'file:///filters',
        expected: 'inclusion.txt',
    },
    {
        name: 'ignores a file URL include that escapes the directory',
        includePath: '../secret.txt',
        filterOrigin: 'file:///filters',
        expected: null,
    },
    {
        name: 'ignores a file URL include with an encoded parent-directory segment',
        includePath: '%2e%2e/secret.txt',
        filterOrigin: 'file:///filters',
        expected: null,
    },
    {
        name: 'resolves an include in a Windows file URL directory',
        includePath: 'inclusion.txt',
        filterOrigin: 'file:///C:/lists/main',
        expected: 'inclusion.txt',
    },
    {
        name: 'resolves an include in the file URL origin root',
        includePath: 'inclusion.txt',
        filterOrigin: 'file://',
        expected: 'inclusion.txt',
    },
    {
        name: 'ignores an include that escapes the file URL origin root',
        includePath: '../secret.txt',
        filterOrigin: 'file://',
        expected: null,
    },
];

describe('resolveIncludePath', () => {
    describe('remote origins', () => {
        it.each(remoteCases)('$name', ({ includePath, filterOrigin, expected }) => {
            expect(resolveIncludePath(includePath, filterOrigin)).toBe(expected);
        });
    });

    describe('local origins', () => {
        it.each(localCases)('$name', ({ includePath, filterOrigin, expected }) => {
            expect(resolveIncludePath(includePath, filterOrigin)).toBe(expected);
        });
    });
});
