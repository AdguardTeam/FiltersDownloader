import { ABSOLUTE_URL_REGEXP } from './url';

/**
 * Scheme used to parse protocol-relative URLs, which `new URL()` cannot parse
 * without a base URL.
 */
const SCHEME_PLACEHOLDER = 'http:';

/**
 * Matches a `file:` URL. A `file:` URL is a local source, even though it is an
 * absolute URL.
 */
const FILE_URL_REGEXP = /^file:/i;

/**
 * Path segments that mean the current directory, including percent-encoded
 * forms that `new URL()` treats as a dot segment.
 */
const SINGLE_DOT_SEGMENTS = new Set(['.', '%2e']);

/**
 * Path segments that mean the parent directory, including percent-encoded
 * forms that `new URL()` treats as a double-dot segment.
 */
const DOUBLE_DOT_SEGMENTS = new Set(['..', '.%2e', '%2e.', '%2e%2e']);

/**
 * Converts a path segment to `.` or `..` when it is a dot segment, including
 * percent-encoded forms.
 *
 * @param segment Path segment.
 *
 * @returns The normalized dot segment, or the original segment.
 */
const normalizeDotSegment = (segment: string): string => {
    const lowerCaseSegment = segment.toLowerCase();

    if (SINGLE_DOT_SEGMENTS.has(lowerCaseSegment)) {
        return '.';
    }

    if (DOUBLE_DOT_SEGMENTS.has(lowerCaseSegment)) {
        return '..';
    }

    return segment;
};

/**
 * Collapses duplicate slashes in a path.
 *
 * @param path Path to normalize.
 *
 * @returns Path with single slashes.
 */
const collapseSlashes = (path: string): string => path.replace(/\/{2,}/g, '/');

/**
 * Removes the trailing slash from a directory URL path, except for the root
 * path.
 *
 * @param pathname URL path.
 *
 * @returns Directory path without a trailing slash.
 */
const getUrlDirectoryPath = (pathname: string): string => {
    const normalizedPath = collapseSlashes(pathname);

    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
        return normalizedPath.slice(0, -1);
    }

    return normalizedPath;
};

/**
 * Checks whether a URL path points to a file inside a directory.
 *
 * @param targetPath URL path of the include target.
 * @param directoryPath URL path of the directory that contains the parent file.
 *
 * @returns `true` if the target path is inside the directory path.
 */
const isInsideUrlDirectory = (targetPath: string, directoryPath: string): boolean => {
    const directory = getUrlDirectoryPath(directoryPath);
    const target = collapseSlashes(targetPath);

    if (directory === '/') {
        return target !== '/' && target.startsWith('/');
    }

    return target.startsWith(`${directory}/`);
};

/**
 * Resolves an include path against a URL directory and checks that the result
 * stays inside that directory.
 *
 * A leading slash or backslash is ignored, so a root-absolute path resolves
 * inside the directory, as in previous versions and in uBO.
 *
 * @param includePath Path from the include directive.
 * @param filterOrigin Directory URL of the file that contains the directive.
 *
 * @returns The absolute URL to download, or `null` if the target is outside the
 * directory.
 */
const resolveUrlIncludePath = (includePath: string, filterOrigin: string): string | null => {
    // An encoded separator in the path can bypass the containment check if the
    // server decodes the path before it resolves the file. A separator in the
    // query or fragment is not a path separator, so it is allowed.
    const includePathWithoutQueryOrFragment = includePath.replace(/[?#].*$/, '');
    if (/%2f|%5c/i.test(includePathWithoutQueryOrFragment)) {
        return null;
    }

    // Public callers can pass a directory URL with a trailing slash.
    const normalizedOrigin = filterOrigin.replace(/\/+$/, '');
    const isProtocolRelative = normalizedOrigin.startsWith('//');
    const baseHref = isProtocolRelative
        ? `${SCHEME_PLACEHOLDER}${normalizedOrigin}/`
        : `${normalizedOrigin}/`;

    let baseUrl: URL;
    let targetUrl: URL;

    try {
        baseUrl = new URL(baseHref);
        // A leading separator makes the path root-absolute. Ignore it to keep
        // the include inside the directory of the containing file.
        targetUrl = new URL(includePath.replace(/^[\\/]+/, ''), baseUrl);
    } catch {
        return null;
    }

    targetUrl.pathname = collapseSlashes(targetUrl.pathname);

    // An absolute URL can change the origin of the base URL.
    if (targetUrl.origin !== baseUrl.origin) {
        return null;
    }

    if (!isInsideUrlDirectory(targetUrl.pathname, baseUrl.pathname)) {
        return null;
    }

    return isProtocolRelative
        ? targetUrl.href.slice(SCHEME_PLACEHOLDER.length)
        : targetUrl.href;
};

/**
 * Checks whether a local path uses Windows separators or a drive prefix.
 *
 * @param path Local path.
 *
 * @returns `true` if the path is a Windows path.
 */
const isWindowsPath = (path: string): boolean => {
    return /^[a-zA-Z]:[\\/]/.test(path) || (path.includes('\\') && !path.includes('/'));
};

/**
 * Normalizes a local filesystem path.
 *
 * The function converts separators to forward slashes, resolves `.` and `..`
 * segments, collapses duplicate separators, and normalizes percent-encoded dot
 * segments. A path cannot go above its root.
 *
 * @param path Local path.
 *
 * @returns Normalized path with forward slashes.
 */
const normalizeLocalPath = (path: string): string => {
    const withForwardSlashes = collapseSlashes(path.replace(/\\/g, '/'));
    const driveMatch = /^([a-zA-Z]:)(?:\/|$)/.exec(withForwardSlashes);
    const hasDrive = driveMatch !== null;
    const isRooted = withForwardSlashes.startsWith('/');

    let rest = withForwardSlashes;

    if (hasDrive) {
        rest = withForwardSlashes.slice(2);
    } else if (isRooted) {
        rest = withForwardSlashes.slice(1);
    }

    const segments: string[] = [];
    const parts = rest.split('/');

    for (let i = 0; i < parts.length; i += 1) {
        const segment = normalizeDotSegment(parts[i]);

        if (segment === '' || segment === '.') {
            continue;
        }

        if (segment === '..') {
            if (segments.length > 0 && segments[segments.length - 1] !== '..') {
                segments.pop();
            } else if (!isRooted && !hasDrive) {
                segments.push('..');
            }

            continue;
        }

        segments.push(parts[i]);
    }

    const normalizedPath = segments.join('/');

    if (driveMatch) {
        return `${driveMatch[1]}/${normalizedPath}`;
    }

    if (isRooted) {
        return `/${normalizedPath}`;
    }

    return normalizedPath;
};

/**
 * Removes trailing slashes from a normalized local path, except for the root
 * path.
 *
 * @param path Normalized local path.
 *
 * @returns Path without trailing slashes.
 */
const stripTrailingSlashes = (path: string): string => {
    let result = path;

    while (result.length > 1 && result.endsWith('/')) {
        result = result.slice(0, -1);
    }

    return result;
};

/**
 * Checks whether a normalized local path is absolute.
 *
 * @param path Normalized local path.
 *
 * @returns `true` if the path starts with a slash or a drive prefix.
 */
const isAbsoluteLocalPath = (path: string): boolean => {
    return path.startsWith('/') || /^[a-zA-Z]:\//.test(path);
};

/**
 * Checks whether a relative target path points to a file inside a relative
 * directory.
 *
 * The comparison is segment-based, because a relative directory can start with
 * `..` segments and a plain string prefix would accept an escaping target such
 * as `../../file` for the directory `..`.
 *
 * @param targetPath Normalized relative target path.
 * @param directoryPath Normalized relative directory path. An empty string
 * means the current directory.
 *
 * @returns `true` if the target path is inside the directory path.
 */
const isInsideRelativeDirectory = (
    targetPath: string,
    directoryPath: string,
): boolean => {
    if (isAbsoluteLocalPath(targetPath)) {
        return false;
    }

    const targetSegments = targetPath.split('/');
    const directorySegments = directoryPath === '' ? [] : directoryPath.split('/');

    if (targetSegments.length <= directorySegments.length) {
        return false;
    }

    for (let i = 0; i < directorySegments.length; i += 1) {
        if (targetSegments[i] !== directorySegments[i]) {
            return false;
        }
    }

    // An extra leading `..` segment means that the target escapes the
    // directory through its parent.
    return targetSegments[directorySegments.length] !== '..';
};

/**
 * Checks whether a normalized local path points to a file inside a directory.
 *
 * @param targetPath Normalized path of the include target.
 * @param directoryPath Normalized path of the directory that contains the
 * parent file.
 * @param caseInsensitive Whether to compare the paths case-insensitively.
 *
 * @returns `true` if the target path is inside the directory path.
 */
const isInsideLocalDirectory = (
    targetPath: string,
    directoryPath: string,
    caseInsensitive: boolean,
): boolean => {
    const target = stripTrailingSlashes(targetPath);
    const directory = stripTrailingSlashes(directoryPath);
    const comparableTarget = caseInsensitive ? target.toLowerCase() : target;
    const comparableDirectory = caseInsensitive ? directory.toLowerCase() : directory;

    if (comparableDirectory === '/') {
        return comparableTarget !== '/' && comparableTarget.startsWith('/');
    }

    if (!isAbsoluteLocalPath(comparableDirectory)) {
        return isInsideRelativeDirectory(comparableTarget, comparableDirectory);
    }

    return comparableTarget.startsWith(`${comparableDirectory}/`);
};

/**
 * Returns a path relative to a directory.
 *
 * @param targetPath Normalized path of the include target.
 * @param directoryPath Normalized path of the directory that contains the
 * parent file.
 *
 * @returns Relative path with forward slashes.
 */
const getRelativeLocalPath = (targetPath: string, directoryPath: string): string => {
    const target = stripTrailingSlashes(targetPath);
    const directory = stripTrailingSlashes(directoryPath);

    if (directory === '') {
        return target;
    }

    if (directory === '/') {
        return target.slice(1);
    }

    return target.slice(directory.length + 1);
};

/**
 * Resolves an include path against a local directory and checks that the
 * result stays inside that directory.
 *
 * A root-absolute path means a path inside the filter directory for local
 * sources. A `file:` URL is a local source, so its include path is returned
 * without the `file:` prefix. The returned path is relative to the directory,
 * so the existing local file loader can resolve it.
 *
 * @param includePath Path from the include directive.
 * @param filterOrigin Directory of the file that contains the directive.
 *
 * @returns The relative path to download, or `null` if the target is outside
 * the directory.
 */
const resolveLocalIncludePath = (includePath: string, filterOrigin: string): string | null => {
    const separator = filterOrigin.includes('\\') ? '\\' : '/';
    const directory = normalizeLocalPath(filterOrigin);
    const normalizedIncludePath = /^[\\/]/.test(includePath)
        ? includePath.replace(/^[\\/]+/, '')
        : includePath;
    const target = directory === ''
        ? normalizeLocalPath(normalizedIncludePath)
        : normalizeLocalPath(`${directory}/${normalizedIncludePath}`);

    if (!isInsideLocalDirectory(target, directory, isWindowsPath(filterOrigin))) {
        return null;
    }

    const relativePath = getRelativeLocalPath(target, directory);

    return separator === '\\'
        ? relativePath.replace(/\//g, '\\')
        : relativePath;
};

/**
 * Resolves an `!#include` path against the directory of the file that contains
 * the directive.
 *
 * The target must stay inside that directory. The function returns `null` for
 * a target outside the directory, including any path that escapes it with
 * `..`. The caller must ignore such an include.
 *
 * A `file:` filter origin is a local source. An include path that is an
 * absolute URL is not handled here and keeps the existing flow.
 *
 * @param includePath Path from the include directive.
 * @param filterOrigin Directory of the file that contains the directive.
 *
 * @returns The path or URL to download, or `null` if the target is outside the
 * directory.
 */
export const resolveIncludePath = (includePath: string, filterOrigin: string): string | null => {
    if (ABSOLUTE_URL_REGEXP.test(filterOrigin) && !FILE_URL_REGEXP.test(filterOrigin)) {
        return resolveUrlIncludePath(includePath, filterOrigin);
    }

    return resolveLocalIncludePath(includePath, filterOrigin);
};
