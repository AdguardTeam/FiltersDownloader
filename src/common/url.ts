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
 * Matches the scheme or the protocol-relative prefix and the userinfo
 * component of a URL that the WHATWG parser accepts. In such a URL the
 * authority ends at the first `/`, `\`, `?` or `#`, so an at sign in the query
 * or fragment is not a userinfo separator.
 */
const VALID_USERINFO_REGEXP = /^((?:[a-z][a-z0-9+.-]+:[/\\]*)|(?:[/\\]{2,}))([^/\\?#]*)@/i;

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
 * Matches malformed userinfo where a colon comes directly before `?` or `#`.
 * This form never occurs in a valid URL, so it is safe to treat it as
 * credentials even when the WHATWG parser accepts the URL as a host with a
 * query or a fragment.
 *
 * A password that starts with digits and then contains `?` or `#`, for
 * example `admin:2024#Secret1`, is not recognized: it has the same form as a
 * host with a port and a fragment.
 */
const MALFORMED_USERINFO_REGEXP = /^[^:?#\s]*:[?#]/;

/**
 * Matches a URL with a userinfo component inside arbitrary text. The prefix
 * must contain a scheme or at least two slashes, so an at sign in a plain path
 * or a rule is not treated as a userinfo separator. Whitespace, quotes and
 * angle brackets end the userinfo component, so several URLs in one text and
 * a colon in a sentence are not merged into one match.
 */
const URL_WITH_USERINFO_REGEXP = /((?<![a-z0-9+.-])(?:[a-z][a-z0-9+.-]+:[/\\]*)|(?<![/\\])[/\\]{2,})([^/\\\s<>'"]*)@/gi;

/**
 * Matches a URL whose userinfo component contains a colon. The password can
 * contain spaces, question marks, hash signs and at signs. The part before the
 * colon must not contain these characters, so a colon in a sentence is not
 * treated as a credential separator.
 */
const URL_WITH_COLON_USERINFO_REGEXP = new RegExp(
    String.raw`((?<![a-z0-9+.-])(?:[a-z][a-z0-9+.-]+:[/\\]*)|(?<![/\\])[/\\]{2,})`
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
 * Matches a protocol-relative URL prefix.
 */
const PROTOCOL_RELATIVE_REGEXP = /^[/\\]{2}/;

/**
 * Base URL used to parse a protocol-relative URL, which the WHATWG parser
 * cannot parse without a base.
 */
const PROTOCOL_RELATIVE_BASE_URL = 'https://example.invalid';

/**
 * Parses a URL with the WHATWG URL parser.
 *
 * A protocol-relative URL is parsed against a dummy base, so its authority and
 * query are recognized too.
 *
 * @param url URL to parse.
 *
 * @returns Parsed URL, or undefined if the URL cannot be parsed.
 */
const tryParseUrl = (url: string): URL | undefined => {
    try {
        return new URL(url);
    } catch {
        if (!PROTOCOL_RELATIVE_REGEXP.test(url)) {
            return undefined;
        }

        try {
            return new URL(url, PROTOCOL_RELATIVE_BASE_URL);
        } catch {
            return undefined;
        }
    }
};

/**
 * Decodes a percent-encoded userinfo component.
 *
 * The WHATWG parser encodes a literal `%` as `%25`, but it keeps a `%` that is
 * not a valid escape sequence. For example, the password `50% off` becomes
 * `50%%20off`, which cannot be decoded. In this case the raw value is used, so
 * the credentials are sent as typed.
 *
 * @param value Percent-encoded userinfo component.
 * @param rawValue Raw userinfo component, used if the percent-encoding is
 * malformed.
 *
 * @returns Decoded value, or the raw value if the percent-encoding is
 * malformed.
 */
const decodeUserInfo = (value: string, rawValue = value): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return rawValue;
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
 * When the WHATWG parser accepts the URL, the authority ends at the first
 * `/`, `\`, `?` or `#`, so an at sign in the query or fragment is not treated
 * as a userinfo separator. The parser also accepts whitespace in the
 * username, so its userinfo is used when the URL has one. A literal `%` in a
 * credential makes the decoded part unusable, so the raw part is used then.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns The URL without userinfo and the credentials, if the URL has
 * userinfo.
 */
export const parseUrlCredentials = (url: string): ParsedUrl => {
    const parsedUrl = tryParseUrl(url);

    let match = (parsedUrl ? VALID_USERINFO_REGEXP : USERINFO_REGEXP).exec(url);

    // A URL that the WHATWG parser accepts can hide malformed userinfo behind
    // `?` or `#`, for example `https://admin:#Secret1@example.org`. The parser
    // treats `admin` as the host and the rest as the fragment. A colon
    // directly before `?` or `#` never occurs in a valid userinfo, so use the
    // broad match for this form.
    if (!match && parsedUrl) {
        const malformedMatch = USERINFO_REGEXP.exec(url);

        if (malformedMatch && MALFORMED_USERINFO_REGEXP.test(malformedMatch[2])) {
            match = malformedMatch;
        }
    }

    if (!match) {
        return { url };
    }

    const [, prefix, userinfo] = match;

    const separatorIndex = userinfo.indexOf(':');
    const rawUsername = separatorIndex === -1
        ? userinfo
        : userinfo.slice(0, separatorIndex);
    const rawPassword = separatorIndex === -1
        ? ''
        : userinfo.slice(separatorIndex + 1);

    // The WHATWG parser accepts a whitespace in the username, which the
    // conservative match rejects, so prefer the userinfo that it finds. A
    // literal `%` makes the decoded part unusable, so the raw part is used
    // then.
    const parsedCredentials = parsedUrl
        && (parsedUrl.username !== '' || parsedUrl.password !== '')
        ? {
            username: decodeUserInfo(parsedUrl.username, rawUsername),
            password: decodeUserInfo(parsedUrl.password, rawPassword),
        }
        : undefined;

    if (
        parsedCredentials === undefined
        && !MALFORMED_USERINFO_REGEXP.test(userinfo)
        && !isCredentialsMatch(prefix, userinfo)
    ) {
        return { url };
    }

    const sanitizedUrl = `${prefix}${url.slice(match[0].length)}`;

    if (parsedCredentials) {
        return {
            url: sanitizedUrl,
            credentials: parsedCredentials,
        };
    }

    const username = decodeUserInfo(rawUsername);
    const password = decodeUserInfo(rawPassword);

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
 * Matches the start of a URL inside a path or other text. The scheme needs at
 * least two characters, so a Windows drive letter is not a scheme.
 */
const EMBEDDED_URL_REGEXP = /(?<![a-z0-9+.-])(?:[a-z][a-z0-9+.-]+:[/\\]*|[/\\]{2,})/gi;

/**
 * Removes the userinfo component from every URL in a value.
 *
 * A URL can start at the beginning of the value or inside a path, for example
 * `/filters/https:/user:password@example.org/filter.txt`. An error line can
 * contain several URLs, so the function processes every one of them.
 *
 * @param url Value that may contain URLs with a username and a password.
 *
 * @returns Value without the userinfo components.
 */
export const stripUrlCredentials = (url: string): string => {
    if (!url.includes('@')) {
        return url;
    }

    let result = '';
    let lastIndex = 0;

    for (const match of url.matchAll(EMBEDDED_URL_REGEXP)) {
        const { index = 0 } = match;

        if (index < lastIndex) {
            continue;
        }

        const urlPart = url.slice(index);
        const sanitizedUrl = parseUrlCredentials(urlPart).url;

        if (sanitizedUrl === urlPart) {
            continue;
        }

        // The parser removed the userinfo component and the at sign from the
        // URL that starts at the match. The rest of the value is unchanged.
        const userinfoEnd = match[0].length + urlPart.length - sanitizedUrl.length;

        result += url.slice(lastIndex, index) + match[0];
        lastIndex = index + userinfoEnd;
    }

    if (lastIndex === 0) {
        return url;
    }

    return result + url.slice(lastIndex);
};

/**
 * Matches whitespace in a userinfo candidate.
 */
const WHITESPACE_REGEXP = /\s/;

/**
 * Matches a character that ends the authority of a URL.
 */
const AUTHORITY_END_REGEXP = /[/\\?#]/;

/**
 * Matches a character that ends a URL in arbitrary text.
 */
const URL_TERMINATOR_REGEXP = /[\s<>'"]/;

/**
 * Returns the URL that starts at the given position in a text.
 *
 * @param text Text that contains the URL.
 * @param offset Offset of the URL in the text.
 *
 * @returns URL candidate.
 */
const getUrlCandidate = (text: string, offset: number): string => {
    const rest = text.slice(offset);
    const terminatorIndex = rest.search(URL_TERMINATOR_REGEXP);

    return terminatorIndex === -1
        ? rest
        : rest.slice(0, terminatorIndex);
};

/**
 * Removes the userinfo component from every URL in a text.
 *
 * The function is conservative. When a URL is followed by text that contains
 * an at sign, the text can belong to a malformed password that contains
 * whitespace, so the text is redacted together with the URL. Library-generated
 * messages pass the known URL separately, so their text is not shortened.
 *
 * @param text Text that may contain URLs with credentials.
 *
 * @returns Text without the userinfo components.
 */
export const redactUrlCredentials = (text: string): string => {
    if (!text.includes('@')) {
        return text;
    }

    const redactMatch = (
        match: string,
        prefix: string,
        userinfo: string,
        offset: number,
        textWithUrl: string,
    ): string => {
        if (SCHEME_WITHOUT_SLASHES_REGEXP.test(prefix) && !HTTP_SCHEME_REGEXP.test(prefix)) {
            return match;
        }

        if (!AMBIGUOUS_USERINFO_REGEXP.test(userinfo)) {
            return prefix;
        }

        // A colon directly before `?` or `#` is malformed userinfo. The WHATWG
        // parser treats this form as a host with an empty port and a query or
        // a fragment, so it cannot detect the credentials.
        if (MALFORMED_USERINFO_REGEXP.test(userinfo)) {
            return prefix;
        }

        const candidate = getUrlCandidate(textWithUrl, offset);
        const parsedUrl = tryParseUrl(candidate);

        // A malformed URL cannot be parsed, so the whole ambiguous userinfo
        // candidate is a malformed userinfo component.
        if (parsedUrl === undefined) {
            return prefix;
        }

        // The WHATWG parser accepts the candidate URL but finds no
        // credentials. The at sign is in the query, the fragment or the
        // following text. However, a whitespace-separated candidate can also
        // be the first word of a password, for example
        // `https://user:123 secret@example.org`, and the newline-free text
        // after it belongs to the password. The candidate can end at a port,
        // and `new URL()` hides a port that is the default port of the scheme,
        // for example `https://user:443 secret@example.org`. Redacting is the
        // leak-safe choice for every whitespace-separated candidate.
        if (parsedUrl.username === '' && parsedUrl.password === '') {
            return WHITESPACE_REGEXP.test(userinfo) ? prefix : match;
        }

        // Whitespace can be part of a password in a malformed URL, and the
        // candidate up to the whitespace is a valid URL with credentials, so
        // the text after the whitespace can belong either to the password or
        // to the following prose. Redacting the whole match is the only
        // leak-safe choice.
        if (WHITESPACE_REGEXP.test(userinfo)) {
            return prefix;
        }

        // In a valid URL the authority ends at the first `?` or `#`, so only
        // the userinfo component of the authority is removed, not the query or
        // fragment that follows it.
        const authority = candidate.slice(prefix.length);
        const authorityEnd = authority.search(AUTHORITY_END_REGEXP);
        const authorityText = authorityEnd === -1
            ? authority
            : authority.slice(0, authorityEnd);
        const atSignIndex = authorityText.lastIndexOf('@');

        return `${prefix}${match.slice(prefix.length + atSignIndex + 1)}`;
    };

    return text
        .replace(URL_WITH_COLON_USERINFO_REGEXP, redactMatch)
        .replace(URL_WITH_USERINFO_REGEXP, redactMatch);
};

/**
 * Replacement for a URL or a path that contains a URL: the original value and
 * the value without the userinfo component.
 */
export type KnownUrlReplacement = readonly [value: string, sanitizedValue: string];

/**
 * Returns the known URL replacements for a string or a replacement list.
 *
 * @param knownUrl Known URL or replacement list.
 *
 * @returns Replacement list.
 */
const getKnownUrlReplacements = (
    knownUrl?: string | readonly KnownUrlReplacement[],
): readonly KnownUrlReplacement[] => {
    if (knownUrl === undefined) {
        return [];
    }

    if (typeof knownUrl === 'string') {
        return [[knownUrl, stripUrlCredentials(knownUrl)]];
    }

    return knownUrl;
};

/**
 * Removes the credentials from a known URL value in a text and from the other
 * URL forms in the text.
 *
 * The generic {@link redactUrlCredentials} does not accept some characters in
 * the userinfo, for example quotes, so a known URL is replaced first.
 *
 * @param text Text to redact.
 * @param knownUrl URL that can contain any character in the userinfo, or a
 * list of replacements for a path that contains the URL.
 *
 * @returns Redacted text.
 */
const redactKnownUrlText = (
    text: string,
    knownUrl?: string | readonly KnownUrlReplacement[],
): string => {
    const replacements = getKnownUrlReplacements(knownUrl)
        .filter(([value, sanitizedValue]) => value !== '' && value !== sanitizedValue)
        .sort(([firstValue], [secondValue]) => secondValue.length - firstValue.length);

    const textWithSanitizedUrls = replacements.reduce(
        (result, [value, sanitizedValue]) => result.split(value).join(sanitizedValue),
        text,
    );

    return redactUrlCredentials(textWithSanitizedUrls);
};

/**
 * Sets a property of an object to a new value.
 *
 * The function first tries a normal assignment. If the property does not allow
 * it, for example the read-only `message` of a `DOMException`, the function
 * defines an own property with the new value.
 *
 * @param object Object to change.
 * @param property Property name.
 * @param value New value.
 *
 * @returns `true` if the property has the new value.
 */
const setObjectProperty = (object: object, property: string, value: unknown): boolean => {
    try {
        if (Reflect.set(object, property, value)) {
            return true;
        }
    } catch {
        // A read-only property can reject an assignment, define it below.
    }

    try {
        Object.defineProperty(object, property, {
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
 * Removes credentials from all own enumerable string properties of an object.
 *
 * The default error printer shows these properties, so the `path` and `dest`
 * properties of an `fs` error must not keep the userinfo component. A plain
 * object in a cause chain is handled the same way.
 *
 * @param object Object to change.
 * @param knownUrl URL that can contain any character in the userinfo, or a
 * list of replacements for a path that contains the URL.
 *
 * @returns `true` if all properties are redacted.
 */
const redactObjectProperties = (
    object: object,
    knownUrl?: string | readonly KnownUrlReplacement[],
): boolean => {
    let isRedacted = true;

    Object.keys(object).forEach((property) => {
        const value = (object as Record<string, unknown>)[property];

        if (typeof value !== 'string') {
            return;
        }

        const redactedValue = redactKnownUrlText(value, knownUrl);

        if (redactedValue !== value && !setObjectProperty(object, property, redactedValue)) {
            isRedacted = false;
        }
    });

    return isRedacted;
};

/**
 * Creates a copy of an object with redacted own enumerable string properties.
 *
 * The function is used when the properties of the original object cannot be
 * changed.
 *
 * @param object Original object.
 * @param knownUrl URL that can contain any character in the userinfo, or a
 * list of replacements for a path that contains the URL.
 *
 * @returns Copy with the redacted text.
 */
const createRedactedObject = (
    object: object,
    knownUrl?: string | readonly KnownUrlReplacement[],
): object => {
    const redactedObject = (Array.isArray(object) ? [] : {}) as Record<string, unknown>;

    Object.keys(object).forEach((property) => {
        const value = (object as Record<string, unknown>)[property];
        redactedObject[property] = typeof value === 'string'
            ? redactKnownUrlText(value, knownUrl)
            : value;
    });

    return redactedObject;
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
 * Removes the userinfo components from the message and the stack of an error,
 * from its own enumerable string properties, and from the whole chain of its
 * causes and nested errors.
 *
 * A string or a plain object in the chain is redacted too. The function
 * changes the objects in place, so their identity, type and additional
 * properties are kept. If a property cannot be changed, the function returns a
 * new object with the redacted text instead.
 *
 * @param error Error or other value to redact.
 * @param seen Objects that are already processed, used to stop on cycles.
 * @param knownUrl URL that can contain any character in the userinfo, or a
 * list of replacements for a path that contains the URL.
 *
 * @returns The same value, or a redacted copy if it cannot be changed in
 * place.
 */
export const redactErrorCredentials = (
    error: unknown,
    seen = new WeakSet<object>(),
    knownUrl?: string | readonly KnownUrlReplacement[],
): unknown => {
    if (typeof error === 'string') {
        return redactKnownUrlText(error, knownUrl);
    }

    if (typeof error !== 'object' || error === null) {
        return error;
    }

    if (seen.has(error)) {
        return error;
    }
    seen.add(error);

    if (!(error instanceof Error)) {
        if (redactObjectProperties(error, knownUrl)) {
            return error;
        }

        return createRedactedObject(error, knownUrl);
    }

    const message = redactKnownUrlText(error.message, knownUrl);
    const stack = typeof error.stack === 'string'
        ? redactKnownUrlText(error.stack, knownUrl)
        : error.stack;

    const isMessageRedacted = message === error.message
        || setObjectProperty(error, 'message', message);
    const isStackRedacted = stack === error.stack
        || (typeof stack === 'string' && setObjectProperty(error, 'stack', stack));

    let redactedError = error;

    if (!isMessageRedacted || !isStackRedacted || !redactObjectProperties(error, knownUrl)) {
        redactedError = createRedactedError(error, message, typeof stack === 'string' ? stack : undefined);
    }

    const { cause } = error;
    if (cause !== undefined) {
        const redactedCause = redactErrorCredentials(cause, seen, knownUrl);

        if (
            (redactedError !== error || redactedCause !== cause)
            && !setObjectProperty(redactedError, 'cause', redactedCause)
        ) {
            redactedError = createRedactedError(error, message, typeof stack === 'string' ? stack : undefined);
            setObjectProperty(redactedError, 'cause', redactedCause);
        }
    }

    if (error instanceof AggregateError) {
        const redactedErrors = error.errors.map(
            (nestedError) => redactErrorCredentials(nestedError, seen, knownUrl),
        );

        setObjectProperty(redactedError, 'errors', redactedErrors);
    }

    return redactedError;
};
