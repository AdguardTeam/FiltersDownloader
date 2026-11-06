/**
 * Credentials extracted from the userinfo component of a URL.
 */
export interface UrlCredentials {
    /**
     * Decoded username.
     */
    username: string;

    /**
     * Decoded password. Empty if the URL has no password.
     */
    password: string;
}

/**
 * URL split into the URL without userinfo and the credentials from the
 * userinfo component.
 */
export interface ParsedUrl {
    /**
     * URL without the userinfo component.
     */
    url: string;

    /**
     * Credentials from the userinfo component, or undefined if the URL has no
     * userinfo.
     */
    credentials?: UrlCredentials;
}

/**
 * Matches the scheme, the protocol-relative prefix, or no prefix at all, and
 * the userinfo component of a URL. A scheme can have zero or more slashes or
 * backslashes, so malformed URLs such as `https:/`, `https:`, `https:\` and
 * `https:///` are also recognized. A backslash ends the authority of an
 * HTTP(S) URL, so it also ends the userinfo component.
 */
const USERINFO_REGEXP = /^((?:[a-z][a-z0-9+.-]*:)?[/\\]*)([^/\\?#]*)@/i;

/**
 * Matches a URL with a userinfo component inside arbitrary text. The prefix
 * must contain a scheme or at least two slashes, so an at sign in a plain path
 * or a rule is not treated as a userinfo separator.
 */
const URL_WITH_USERINFO_REGEXP = /((?:[a-z][a-z0-9+.-]*:[/\\]*)|(?:[/\\]{2,}))([^/\s\\?#]*)@/gi;

/**
 * Decodes a percent-encoded userinfo component.
 *
 * @param value Percent-encoded userinfo component.
 *
 * @returns Decoded value, or the original value if the percent-encoding is
 * malformed.
 */
const decodeUserInfo = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/**
 * Splits a URL into the URL without the userinfo component and the
 * credentials from that component.
 *
 * The function also accepts protocol-relative URLs, which `new URL()` cannot
 * parse without a base URL, and malformed URLs with a scheme followed by zero
 * or more slashes or backslashes, for example `https:/user:password@example.org`.
 * Empty credentials, for example `https://:@example.org`, are treated as no
 * userinfo, as `new URL()` and `fetch` treat such a URL.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns The URL without userinfo and the credentials, if the URL has
 * userinfo.
 */
export const parseUrlCredentials = (url: string): ParsedUrl => {
    const match = USERINFO_REGEXP.exec(url);

    if (!match) {
        return { url };
    }

    const [, prefix, userinfo] = match;
    const sanitizedUrl = `${prefix}${url.slice(match[0].length)}`;

    const separatorIndex = userinfo.indexOf(':');
    const username = decodeUserInfo(separatorIndex === -1
        ? userinfo
        : userinfo.slice(0, separatorIndex));
    const password = decodeUserInfo(separatorIndex === -1
        ? ''
        : userinfo.slice(separatorIndex + 1));

    if (username === '' && password === '') {
        return { url: sanitizedUrl };
    }

    return {
        url: sanitizedUrl,
        credentials: {
            username,
            password,
        },
    };
};

/**
 * Removes the userinfo component from every URL in a text.
 *
 * @param text Text that may contain URLs with credentials.
 *
 * @returns Text without the userinfo components.
 */
export const redactUrlCredentials = (text: string): string => text.replace(URL_WITH_USERINFO_REGEXP, '$1');

/**
 * Removes the userinfo components from the message and the stack of an error
 * and from the whole chain of its causes and nested errors.
 *
 * The function changes the error objects in place, so their identity, type and
 * additional properties are kept.
 *
 * @param error Error or other value to redact.
 * @param seen Errors that are already processed, used to stop on cycles.
 *
 * @returns The same value with redacted error messages.
 */
export const redactErrorCredentials = (
    error: unknown,
    seen = new WeakSet<object>(),
): unknown => {
    if (typeof error === 'string') {
        return redactUrlCredentials(error);
    }

    if (!(error instanceof Error)) {
        return error;
    }

    if (seen.has(error)) {
        return error;
    }
    seen.add(error);

    error.message = redactUrlCredentials(error.message);

    if (typeof error.stack === 'string') {
        error.stack = redactUrlCredentials(error.stack);
    }

    const { cause } = error as Error & { cause?: unknown };
    if (cause !== undefined) {
        redactErrorCredentials(cause, seen);
    }

    if (error instanceof AggregateError) {
        error.errors.forEach((nestedError, index) => {
            error.errors[index] = redactErrorCredentials(nestedError, seen);
        });
    }

    return error;
};

/**
 * Removes the userinfo component from a URL.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns URL without the userinfo component.
 */
export const stripUrlCredentials = (url: string): string => parseUrlCredentials(url).url;
