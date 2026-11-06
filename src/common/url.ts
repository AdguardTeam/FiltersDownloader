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
 * Matches the scheme or the protocol-relative prefix and the userinfo
 * component of a URL. A scheme can have zero or more slashes or backslashes.
 * The function also recognizes malformed URLs with one, zero, or three
 * slashes and URLs with backslashes. The scheme needs at least two characters,
 * so a Windows drive letter is not treated as a scheme. A backslash ends the
 * authority of an HTTP(S) URL, so it also ends the userinfo component.
 *
 * The userinfo component can contain `?`, `#` and spaces, because a password
 * in a malformed URL can contain them. This check is done by
 * {@link isCredentialsMatch}. It tells such a match from an at sign in a path
 * or a query.
 */
const USERINFO_REGEXP = /^((?:[a-z][a-z0-9+.-]+:[/\\]*)|(?:[/\\]{2,}))([^/\\]*)@/i;

/**
 * Matches a scheme without slashes, for example `https:`.
 */
const SCHEME_WITHOUT_SLASHES_REGEXP = /^[a-z][a-z0-9+.-]*:$/i;

/**
 * Matches an HTTP or HTTPS scheme.
 */
const HTTP_SCHEME_REGEXP = /^https?:$/i;

/**
 * Matches a character that is not valid in the userinfo component of a valid
 * URL, but can occur in the password of a malformed URL.
 */
const AMBIGUOUS_USERINFO_REGEXP = /[?#\s]/;

/**
 * Matches a URL with a userinfo component inside arbitrary text. The prefix
 * must contain a scheme or at least two slashes, so an at sign in a plain path
 * or a rule is not treated as a userinfo separator. Whitespace, quotes and
 * angle brackets end the userinfo component, so several URLs in one text and
 * a colon in a sentence are not merged into one match.
 */
const URL_WITH_USERINFO_REGEXP = /((?:[a-z][a-z0-9+.-]+:[/\\]*)|(?:[/\\]{2,}))([^/\\\s<>'"]*)@/gi;

/**
 * Matches a URL whose userinfo component contains a colon. The password can
 * contain spaces, question marks, hash signs and at signs. The part before the
 * colon must not contain these characters, so a colon in a sentence is not
 * treated as a credential separator.
 */
const URL_WITH_COLON_USERINFO_REGEXP = new RegExp(
    String.raw`((?:[a-z][a-z0-9+.-]+:[/\\]*)|(?:[/\\]{2,}))`
    + String.raw`([^/\\\s<>'":?#]+:\S[^/\\<>\n\r'"]*)@`,
    'gi',
);

/**
 * Checks that a userinfo match contains credentials rather than an at sign in
 * a path or a query.
 *
 * A scheme without slashes is a credential form only for HTTP and HTTPS.
 * When the userinfo component contains `?`, `#` or whitespace, the match is
 * credentials only if the `:` separator comes before the first of these
 * characters. This keeps `https://example.org?email=user@example.org`
 * unchanged.
 *
 * @param prefix Matched scheme or protocol-relative prefix.
 * @param userinfo Matched userinfo component.
 *
 * @returns `true` if the match contains credentials.
 */
const isCredentialsMatch = (prefix: string, userinfo: string): boolean => {
    if (SCHEME_WITHOUT_SLASHES_REGEXP.test(prefix) && !HTTP_SCHEME_REGEXP.test(prefix)) {
        return false;
    }

    const ambiguousIndex = userinfo.search(AMBIGUOUS_USERINFO_REGEXP);
    if (ambiguousIndex === -1) {
        return true;
    }

    const separatorIndex = userinfo.indexOf(':');

    return separatorIndex !== -1 && separatorIndex < ambiguousIndex;
};

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

    if (!isCredentialsMatch(prefix, userinfo)) {
        return { url };
    }

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
export const redactUrlCredentials = (text: string): string => {
    const redactMatch = (match: string, prefix: string, userinfo: string): string => (
        isCredentialsMatch(prefix, userinfo) ? prefix : match
    );

    return text
        .replace(URL_WITH_COLON_USERINFO_REGEXP, redactMatch)
        .replace(URL_WITH_USERINFO_REGEXP, redactMatch);
};

/**
 * Sets a property of an error to a new value.
 *
 * The function first tries a normal assignment. If the property does not allow
 * it, for example the read-only `message` of a `DOMException`, the function
 * defines an own property with the new value.
 *
 * @param error Error to change.
 * @param property Property name.
 * @param value New value.
 *
 * @returns `true` if the property has the new value.
 */
const setErrorProperty = (error: Error, property: string, value: unknown): boolean => {
    try {
        if (Reflect.set(error, property, value)) {
            return true;
        }
    } catch {
        // A read-only property can reject an assignment, define it below.
    }

    try {
        Object.defineProperty(error, property, {
            value,
            configurable: true,
            writable: true,
        });

        return true;
    } catch {
        return false;
    }
};

/**
 * Removes credentials from all own enumerable string properties of an error.
 *
 * The default error printer shows these properties, so the `path` and `dest`
 * properties of an `fs` error must not keep the userinfo component.
 *
 * @param error Error to change.
 *
 * @returns `true` if all properties are redacted.
 */
const redactErrorProperties = (error: Error): boolean => {
    let isRedacted = true;

    Object.keys(error).forEach((property) => {
        const value = (error as unknown as Record<string, unknown>)[property];

        if (typeof value !== 'string') {
            return;
        }

        const redactedValue = redactUrlCredentials(value);

        if (redactedValue !== value && !setErrorProperty(error, property, redactedValue)) {
            isRedacted = false;
        }
    });

    return isRedacted;
};

/**
 * Creates an error with a redacted message and stack.
 *
 * The function is used when the properties of the original error cannot be
 * changed, for example for a frozen error.
 *
 * @param error Original error.
 * @param message Redacted message.
 * @param stack Redacted stack.
 *
 * @returns New `AggregateError` or `Error` with the redacted text.
 */
const createRedactedError = (error: Error, message: string, stack: string | undefined): Error => {
    const redactedError = error instanceof AggregateError
        ? new AggregateError([], message)
        : new Error(message);

    redactedError.name = error.name;

    if (stack !== undefined) {
        redactedError.stack = stack;
    }

    return redactedError;
};

/**
 * Removes the userinfo components from the message and the stack of an error
 * and from the whole chain of its causes and nested errors.
 *
 * The function changes the error objects in place, so their identity, type and
 * additional properties are kept. If a property cannot be changed, the
 * function returns a new error with the redacted text instead.
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

    const message = redactUrlCredentials(error.message);
    const stack = typeof error.stack === 'string'
        ? redactUrlCredentials(error.stack)
        : error.stack;

    const isMessageRedacted = message === error.message
        || setErrorProperty(error, 'message', message);
    const isStackRedacted = stack === error.stack
        || (typeof stack === 'string' && setErrorProperty(error, 'stack', stack));

    let redactedError = error;

    if (!isMessageRedacted || !isStackRedacted || !redactErrorProperties(error)) {
        redactedError = createRedactedError(error, message, typeof stack === 'string' ? stack : undefined);
    }

    const { cause } = error as Error & { cause?: unknown };
    if (cause !== undefined) {
        const redactedCause = redactErrorCredentials(cause, seen);

        if (
            (redactedError !== error || redactedCause !== cause)
            && !setErrorProperty(redactedError, 'cause', redactedCause)
        ) {
            redactedError = createRedactedError(error, message, typeof stack === 'string' ? stack : undefined);
            setErrorProperty(redactedError, 'cause', redactedCause);
        }
    }

    if (error instanceof AggregateError) {
        if (!(redactedError instanceof AggregateError)) {
            redactedError = createRedactedError(error, message, typeof stack === 'string' ? stack : undefined);
        }

        const redactedErrors = error.errors.map(
            (nestedError) => redactErrorCredentials(nestedError, seen),
        );

        setErrorProperty(redactedError, 'errors', redactedErrors);
    }

    return redactedError;
};

/**
 * Removes the userinfo component from a URL.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns URL without the userinfo component.
 */
export const stripUrlCredentials = (url: string): string => parseUrlCredentials(url).url;
