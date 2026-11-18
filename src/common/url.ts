/**
 * Matches an absolute URL: a URL with a scheme, or a protocol-relative URL.
 */
export const ABSOLUTE_URL_REGEXP = /^([a-z]+:\/\/|\/\/)/i;

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
 *
 * The WHATWG parser accepts this form as a host with an empty port and a
 * query or a fragment, so the parser cannot detect the credentials. The same
 * form also occurs in a valid URL, for example
 * `http://example.org:?token=a@b`, so the caller must also check that the
 * part before the colon is a username and that the text after the at sign
 * looks like the rest of a URL. See {@link isMalformedUserinfoForm}.
 *
 * A password that starts with digits and then contains `?` or `#`, for
 * example `admin:2024#Secret1`, is not recognized by the parser: it has the
 * same form as a host with a port and a fragment. The redaction of error text
 * recognizes it, because a leak in text is worse than a wrong host. See
 * {@link isDigitFirstMalformedUserinfo}.
 */
const MALFORMED_USERINFO_REGEXP = /^[^:?#\s]*:[?#]/;

/**
 * Matches the text after the at sign of malformed userinfo that starts with a
 * host that looks like the rest of a URL: a name with a dot, a port or an IPv6
 * literal, or the special-use `localhost` name followed by the rest of the
 * URL. The path, query, and fragment that follow the host are not checked.
 *
 * The function is applied to the text after the at sign up to the first
 * whitespace or quote, not to the parse candidate, which ends at the first `/`.
 * This keeps a single-label host with a path, for example
 * `http://admin:#Secret1@localhost/filter.txt`, from being missed.
 *
 * See {@link SINGLE_LABEL_HOST_REGEXP} for the other single-label hosts, for
 * example `http://user:#pw@fileserver/list.txt` and
 * `http://user:#pw@fileserver?format=adblock`.
 */
const MALFORMED_USERINFO_TAIL_REGEXP = /^[^/\\?#:]*[.:]|^localhost(?=[/\\?#])/i;

/**
 * Matches the text after the at sign of malformed userinfo when it starts with
 * a single-label host that is followed by a path, a query, a fragment, or the
 * end of the value, for example `http://user:#pw@fileserver/list.txt` and
 * `http://user:#pw@fileserver?format=adblock`.
 *
 * The host must not contain a dot: a host with a domain is covered by
 * {@link MALFORMED_USERINFO_TAIL_REGEXP}. A label followed by whitespace and
 * more text stays ambiguous with prose, because the text after the at sign is
 * read up to the first whitespace. See {@link isMalformedUserinfoForm}.
 */
const SINGLE_LABEL_HOST_REGEXP = /^[^/\\?#:.]+(?:[/\\?#]|$)/;

/**
 * Checks that the part before the colon of a userinfo component contains a
 * dot. Such a part is a host with an empty port, not a username, for example
 * `example.org:` in `http://example.org:?token=a@b`.
 *
 * @param userinfo Userinfo component.
 *
 * @returns `true` if the part before the colon contains a dot.
 */
const isDottedUserinfoHost = (userinfo: string): boolean => {
    const separatorIndex = userinfo.indexOf(':');

    return separatorIndex !== -1 && userinfo.slice(0, separatorIndex).includes('.');
};

/**
 * Checks that a malformed userinfo match is credentials rather than a valid
 * URL with an empty port and an at sign in the query or fragment.
 *
 * A colon directly before `?` or `#` is the malformed form. The part before
 * the colon must be a username, not a host: a dot in this part means a host
 * with an empty port, for example `http://example.org:?email=user@example.com`.
 *
 * The text after the at sign must look like the rest of a URL: a name with a
 * dot, a port or an IPv6 literal, `localhost`, or a single-label host followed
 * by a path, a query, a fragment, or the end of the value. The last form is
 * ambiguous with an at sign in the query or fragment of a valid URL whose host
 * has no dot, for example `http://localhost:?token=a@b`. A credential leak is
 * worse than a wrong host in a display message, so the ambiguous form is
 * treated as credentials.
 *
 * @param userinfo Userinfo component of the match.
 * @param tail Text after the at sign up to the first whitespace or quote.
 *
 * @returns `true` if the match contains malformed userinfo.
 */
const isMalformedUserinfoForm = (userinfo: string, tail: string): boolean => {
    if (!MALFORMED_USERINFO_REGEXP.test(userinfo) || isDottedUserinfoHost(userinfo)) {
        return false;
    }

    return MALFORMED_USERINFO_TAIL_REGEXP.test(tail)
        || SINGLE_LABEL_HOST_REGEXP.test(tail);
};

/**
 * Matches the userinfo part of a malformed URL where a password starts with
 * digits and then contains `?` or `#`, for example `admin:2024#Secret1`.
 *
 * The part before the colon is a username, so it has no dot. A dotted host
 * with a port and an at sign in the query or fragment, for example
 * `example.org:8080#contact@example.org`, must stay unchanged.
 *
 * A username cannot contain a slash either, so the class excludes `/` and
 * `\`. Without the exclusion, the scheme prefix of
 * {@link DIGIT_FIRST_URL_REGEXP} gives back one of its slashes when the
 * username is empty, and the redaction prints a URL with one slash too few.
 */
const DIGIT_FIRST_USERINFO_PATTERN = String.raw`[^:?#\s./\\]+:\d+[?#]`;

/**
 * Matches malformed userinfo where a password starts with digits and then
 * contains `?` or `#`, for example `admin:2024#Secret1@example.org`.
 */
const DIGIT_FIRST_USERINFO_REGEXP = new RegExp(`^${DIGIT_FIRST_USERINFO_PATTERN}`);

/**
 * Matches a URL prefix and the first at sign of malformed userinfo where a
 * password starts with digits and then contains `?` or `#`, for example
 * `https://admin:2024#Secret1@example.org`.
 *
 * The first at sign after `?` or `#` is the first candidate separator. The
 * leak-safe redaction uses the last at sign before a path, query, or fragment
 * delimiter, or the last at sign in the URL token when there is no delimiter,
 * so a password that contains an at sign is removed too. See
 * {@link getDigitFirstSeparator}.
 */
const DIGIT_FIRST_URL_REGEXP = new RegExp(
    String.raw`^((?:[a-z][a-z0-9+.-]+:[/\\]*)|(?:[/\\]{2,}))(${DIGIT_FIRST_USERINFO_PATTERN}[^/\\@]*)@`,
    'i',
);

/**
 * Checks that a malformed userinfo match contains a password that starts with
 * digits and then contains `?` or `#`.
 *
 * The WHATWG parser accepts this string as a host, a port, and a query or a
 * fragment, so the parser cannot detect the credentials. The redaction accepts
 * the form because a leak in text is worse than a wrong host. The parser still
 * leaves the value unchanged, so the credentials are not sent as Basic auth.
 *
 * `localhost` is treated like any other part before the colon, even though it
 * can be a host: `https://localhost:2024#Secret1@example.org/f.txt` is
 * redacted, and so is the valid `https://localhost:8080#contact@example.org`.
 * A leak is worse than a wrong host in display text. A single-label host after
 * the at sign is redacted for the same reason, as in
 * {@link SINGLE_LABEL_HOST_REGEXP}. An IPv6 literal cannot match
 * {@link DIGIT_FIRST_USERINFO_REGEXP}: it has a colon inside the brackets, so
 * the username part ends at that colon.
 *
 * @param userinfo Userinfo component of the match.
 * @param tail Text after the at sign up to the first whitespace or quote.
 *
 * @returns `true` if the match contains malformed userinfo.
 */
const isDigitFirstMalformedUserinfo = (userinfo: string, tail: string): boolean => {
    if (!DIGIT_FIRST_USERINFO_REGEXP.test(userinfo)) {
        return false;
    }

    return MALFORMED_USERINFO_TAIL_REGEXP.test(tail)
        || SINGLE_LABEL_HOST_REGEXP.test(tail);
};

/**
 * Sticky variants of the userinfo regexps.
 *
 * The `lastIndex` property points to the URL start, so the function does not
 * copy the text before the URL.
 */
const VALID_USERINFO_STICKY_REGEXP = new RegExp(
    VALID_USERINFO_REGEXP.source.replace(/^\^/, ''),
    'iy',
);
const USERINFO_STICKY_REGEXP = new RegExp(
    USERINFO_REGEXP.source.replace(/^\^/, ''),
    'iy',
);
const DIGIT_FIRST_STICKY_REGEXP = new RegExp(
    DIGIT_FIRST_URL_REGEXP.source.replace(/^\^/, ''),
    'iy',
);

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
 * The WHATWG parser keeps a `%` as is and percent-encodes characters such as
 * a space. For example, the password `50% off` becomes `50%%20off`, which is
 * not a valid percent-encoding and cannot be decoded. In this case the raw
 * value is used, so the credentials are sent as typed.
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
 * Matches a character that ends a URL candidate for the WHATWG parser.
 */
const URL_CANDIDATE_END_REGEXP = /[/\\?#\s<>'"]/g;

/**
 * Finds the end of a URL candidate for the WHATWG parser.
 *
 * The candidate starts at a URL prefix and ends at the first character that
 * cannot be part of a URL in text. The function uses the `lastIndex` property,
 * so it does not copy the text after the position.
 *
 * @param text Text that contains a URL.
 * @param from Offset in the text where the search starts.
 *
 * @returns Offset of the first character that ends the candidate.
 */
const getCandidateEnd = (text: string, from: number): number => {
    URL_CANDIDATE_END_REGEXP.lastIndex = from;
    const match = URL_CANDIDATE_END_REGEXP.exec(text);

    return match === null ? text.length : match.index;
};

/**
 * Executes a sticky userinfo regexp at the given offset.
 *
 * @param regexp Sticky userinfo regexp.
 * @param text Text that contains a URL.
 * @param offset Offset of the URL in the text.
 *
 * @returns Match or null.
 */
const execUserinfo = (regexp: RegExp, text: string, offset: number): RegExpExecArray | null => {
    regexp.lastIndex = offset;

    return regexp.exec(text);
};

/**
 * Returns the URL candidate for a userinfo match.
 *
 * @param text Text that contains a URL.
 * @param offset Offset of the URL in the text.
 * @param match Userinfo match.
 *
 * @returns URL candidate for the WHATWG parser.
 */
const getCandidate = (text: string, offset: number, match: RegExpExecArray): string => {
    const end = getCandidateEnd(text, offset + match[0].length);

    return text.slice(offset, end);
};

/**
 * Matches a character that ends a URL in arbitrary text.
 */
const URL_TERMINATOR_REGEXP = /[\s<>'"]/g;

/**
 * Returns the URL that starts at the given position in a text.
 *
 * The function uses the `lastIndex` property, so it does not copy the text
 * after the position.
 *
 * @param text Text that contains the URL.
 * @param offset Offset of the URL in the text.
 *
 * @returns URL candidate.
 */
const getUrlCandidate = (text: string, offset: number): string => {
    URL_TERMINATOR_REGEXP.lastIndex = offset;
    const match = URL_TERMINATOR_REGEXP.exec(text);
    const end = match === null ? text.length : match.index;

    return text.slice(offset, end);
};

/**
 * Returns the offset after the last at sign in the URL token that starts at
 * the given position.
 *
 * The token ends at the first whitespace, quote, or angle bracket, so prose
 * after the URL is not included. A second at sign in the token can belong to a
 * password, so the leak-safe redaction uses the last one to remove the whole
 * password.
 *
 * @param text Text that contains the URL.
 * @param from Offset after the first at sign.
 *
 * @returns Offset after the last at sign in the token, or undefined if the
 * token has no other at sign.
 */
const getLastAtSignInTokenEnd = (text: string, from: number): number | undefined => {
    const token = getUrlCandidate(text, from);
    const lastAtSignIndex = token.lastIndexOf('@');

    return lastAtSignIndex === -1 ? undefined : from + lastAtSignIndex + 1;
};

/**
 * Separator of a leak-safe digit-first userinfo.
 */
interface DigitFirstSeparator {
    /**
     * Offset in the text after the at sign.
     */
    end: number;

    /**
     * Userinfo component before the at sign.
     */
    userinfo: string;
}

/**
 * Finds the separator of a leak-safe digit-first userinfo.
 *
 * The separator is the last at sign before the first `/`, `\`, `?`, or `#`
 * that follows the first at sign. Without such a delimiter, a later at sign
 * can belong to the password, so the separator is the last at sign in the URL
 * token. This keeps a path, query, or fragment and still removes a password
 * that contains an at sign.
 *
 * @param text Text that contains the URL.
 * @param offset Offset of the URL in the text.
 * @param match Match of {@link DIGIT_FIRST_STICKY_REGEXP}.
 *
 * @returns Separator data, or undefined if the match is not digit-first
 * userinfo.
 */
const getDigitFirstSeparator = (
    text: string,
    offset: number,
    match: RegExpExecArray,
): DigitFirstSeparator | undefined => {
    const firstEnd = offset + match[0].length;
    const firstUserinfo = match[2];
    const firstTail = getUrlCandidate(text, firstEnd);

    if (!isDigitFirstMalformedUserinfo(firstUserinfo, firstTail)) {
        return undefined;
    }

    const lastEnd = getLastAtSignInTokenEnd(text, firstEnd);

    if (lastEnd !== undefined) {
        const delimiterIndex = firstTail.search(/[/\\?#]/);
        let separatorEnd = lastEnd;

        if (delimiterIndex !== -1) {
            const atSignIndex = firstTail.slice(0, delimiterIndex).lastIndexOf('@');

            if (atSignIndex === -1) {
                return { end: firstEnd, userinfo: firstUserinfo };
            }

            separatorEnd = firstEnd + atSignIndex + 1;
        }

        const userinfo = text.slice(offset + match[1].length, separatorEnd - 1);

        if (isDigitFirstMalformedUserinfo(userinfo, getUrlCandidate(text, separatorEnd))) {
            return { end: separatorEnd, userinfo };
        }
    }

    return { end: firstEnd, userinfo: firstUserinfo };
};

/**
 * A URL with userinfo found at an offset in a text.
 */
interface ParsedUrlAt {
    /**
     * Scheme or protocol-relative prefix.
     */
    prefix: string;

    /**
     * Offset in the text after the userinfo component and the at sign.
     */
    end: number;

    /**
     * Credentials, or undefined if the userinfo component is empty.
     */
    credentials?: UrlCredentials;
}

/**
 * Finds a URL with userinfo at the given offset in a text.
 *
 * The function does not copy the text before the URL, so it can process every
 * URL in a long line.
 *
 * @param text Text that may contain a URL.
 * @param offset Offset of the URL in the text.
 * @param leakSafe Whether to accept malformed userinfo whose password starts
 * with digits and then contains `?` or `#`. The redaction of error text uses
 * this mode. The parser leaves the value unchanged, because it is a valid URL
 * with a port and an at sign in the query or fragment. The match keeps a path,
 * query, or fragment that follows the host and otherwise ends at the last at
 * sign in the URL token, so a password that contains an at sign is removed
 * too. Prose after the URL is not included, except when the first at sign is
 * followed by whitespace and a later at sign follows: then the match ends at
 * the last at sign in the text, because the text between the at signs can be
 * part of a password.
 *
 * @returns The URL data, or undefined if the URL has no userinfo.
 */
const parseUrlCredentialsAt = (
    text: string,
    offset: number,
    leakSafe = false,
): ParsedUrlAt | undefined => {
    const validMatch = execUserinfo(VALID_USERINFO_STICKY_REGEXP, text, offset);
    const validCandidate = validMatch === null ? undefined : getCandidate(text, offset, validMatch);
    const validParsedUrl = validCandidate === undefined ? undefined : tryParseUrl(validCandidate);

    let match = validMatch;
    let parsedUrl = validParsedUrl;
    let leakSafeEnd: number | undefined;
    let leakSafeUserinfo: string | undefined;

    if (match === null || parsedUrl === undefined) {
        const broadMatch = execUserinfo(USERINFO_STICKY_REGEXP, text, offset);

        if (broadMatch === null) {
            return undefined;
        }

        const candidate = getCandidate(text, offset, broadMatch);
        const candidateParsedUrl = tryParseUrl(candidate);
        const userinfo = broadMatch[2];
        // The candidate ends at the first `/`, so it can keep only the host,
        // for example `localhost` in `http://admin:#Secret1@localhost/f.txt`.
        // The tail is read from the text to recognize a single-label host with
        // a path, query, fragment, or at the end of the value.
        const tail = getUrlCandidate(text, offset + broadMatch[0].length);
        const isMalformedUserinfo = isMalformedUserinfoForm(userinfo, tail);

        const digitFirstMatch = leakSafe
            ? execUserinfo(DIGIT_FIRST_STICKY_REGEXP, text, offset)
            : null;
        const digitFirstSeparator = digitFirstMatch === null
            ? undefined
            : getDigitFirstSeparator(text, offset, digitFirstMatch);

        if (candidateParsedUrl === undefined) {
            // A malformed URL cannot be parsed, so the whole candidate is a
            // malformed userinfo component if the heuristics accept it.
            if (!isMalformedUserinfo && !isCredentialsMatch(broadMatch[1], userinfo)) {
                return undefined;
            }

            if (digitFirstMatch !== null && digitFirstSeparator !== undefined) {
                match = digitFirstMatch;
                leakSafeEnd = digitFirstSeparator.end;
                leakSafeUserinfo = digitFirstSeparator.userinfo;
            } else {
                match = broadMatch;
            }
        } else if (validMatch === null && !isMalformedUserinfo) {
            // The WHATWG parser accepts the candidate and finds no
            // credentials. The at sign is in the query, the fragment, or the
            // following text. Accept only the malformed form where a colon
            // comes directly before `?` or `#`, or the leak-safe form where a
            // password starts with digits and then contains `?` or `#`. The
            // text after the at sign must look like the rest of a URL.
            if (digitFirstMatch === null || digitFirstSeparator === undefined) {
                if (!leakSafe) {
                    return undefined;
                }

                // The first at sign is followed by whitespace, so the text
                // after it is not a URL tail. A password can contain `@` and a
                // space, so fall back to the broad match when it is the
                // digit-first form; a leak is worse than prose after the URL.
                const broadTail = getUrlCandidate(text, offset + broadMatch[0].length);

                if (!isDigitFirstMalformedUserinfo(broadMatch[2], broadTail)) {
                    return undefined;
                }

                match = broadMatch;
            } else {
                // The match ends at the separator that
                // `getDigitFirstSeparator()` picks, so a password that
                // contains an at sign is removed too. A query or fragment
                // after the first at sign is kept, and prose after the token
                // is not included.
                match = digitFirstMatch;
                leakSafeEnd = digitFirstSeparator.end;
                leakSafeUserinfo = digitFirstSeparator.userinfo;
            }
        } else {
            match = broadMatch;
        }

        parsedUrl = candidateParsedUrl;
    }

    const [, prefix, matchUserinfo] = match;
    const userinfo = leakSafeUserinfo ?? matchUserinfo;
    const end = leakSafeEnd ?? offset + match[0].length;

    const separatorIndex = userinfo.indexOf(':');
    const rawUsername = separatorIndex === -1
        ? userinfo
        : userinfo.slice(0, separatorIndex);
    const rawPassword = separatorIndex === -1
        ? ''
        : userinfo.slice(separatorIndex + 1);

    // The WHATWG parser accepts a whitespace in the username, which the
    // conservative match rejects, so prefer the userinfo that it finds. A `%`
    // that does not start a valid percent-encoding makes the decoded part
    // unusable, so the raw part is used then.
    if (parsedUrl !== undefined && (parsedUrl.username !== '' || parsedUrl.password !== '')) {
        return {
            prefix,
            end,
            credentials: {
                username: decodeUserInfo(parsedUrl.username, rawUsername),
                password: decodeUserInfo(parsedUrl.password, rawPassword),
            },
        };
    }

    const tail = getUrlCandidate(text, end);

    if (
        !isMalformedUserinfoForm(userinfo, tail)
        && !isCredentialsMatch(prefix, userinfo)
    ) {
        return undefined;
    }

    const username = decodeUserInfo(rawUsername);
    const password = decodeUserInfo(rawPassword);

    if (username === '' && password === '') {
        return { prefix, end };
    }

    return {
        prefix,
        end,
        credentials: {
            username,
            password,
        },
    };
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
 * username, so its userinfo is used when the URL has one. A `%` that does not
 * start a valid percent-encoding makes the decoded part unusable, so the raw
 * part is used then.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns The URL without userinfo and the credentials, if the URL has
 * userinfo.
 */
export const parseUrlCredentials = (url: string): ParsedUrl => {
    const parsedUrl = parseUrlCredentialsAt(url, 0);

    if (parsedUrl === undefined) {
        return { url };
    }

    const sanitizedUrl = `${parsedUrl.prefix}${url.slice(parsedUrl.end)}`;

    if (parsedUrl.credentials === undefined) {
        return { url: sanitizedUrl };
    }

    return {
        url: sanitizedUrl,
        credentials: parsedUrl.credentials,
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
 * Use this function for log messages, error messages, and other display text.
 * It does not change the URL that the library uses for a request. The package
 * root and the browser entry point export this helper.
 *
 * The function also removes malformed credentials that the WHATWG URL parser
 * does not detect, for example a password that contains `?` or `#`:
 * `https://user:pa#ss@example.org/filter.txt`.
 *
 * A protocol-relative candidate without a colon in the userinfo is usually
 * rule syntax, for example `//scriptlet(...)` or `xpath(//*[...])`, not a URL
 * with a password. It can be a username without a password, which has nothing
 * to redact, so the function leaves such a candidate unchanged.
 *
 * A password that starts with digits and then contains `?` or `#`, for
 * example `admin:2024#Secret1@example.org`, is recognized for redaction. The
 * WHATWG parser accepts this value as a URL with a port and an at sign in the
 * query or fragment, so {@link parseUrlCredentials} leaves it unchanged. A
 * leak in text is worse than a wrong host, so the redaction removes it anyway.
 * The redaction keeps a path, query, or fragment that follows the host and
 * otherwise ends at the last at sign in the URL token, so a password that
 * contains an at sign is removed too, while prose after the URL is not
 * included. The one exception is a first at sign followed by whitespace when
 * a later at sign follows: the redaction then ends at the last at sign in the
 * text, because the text between the at signs can be part of a password. For
 * example, `https://admin:2024#Secret1@example.org?a@b` becomes
 * `https://example.org?a@b`, `https://fileserver:8080?x@example.org&y@z`
 * becomes `https://z`, and
 * `Read https://admin:2024#Secret1@ and user@example.com now` becomes
 * `Read https://example.com now`.
 *
 * A dotted part before the colon is a host with a port and stays unchanged.
 * `localhost` is treated like any other part before the colon, even though it
 * can be a host: both `https://localhost:2024#Secret1@example.org/f.txt` and
 * the valid `https://localhost:8080#contact@example.org` are redacted, because
 * a leak is worse than a wrong host in display text. A valid URL whose
 * single-label host has a numeric port and an at sign in the query or
 * fragment, for example `https://fileserver:8080#x@example.org`, is read as
 * credentials too.
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

        const parsedUrl = parseUrlCredentialsAt(url, index, true);

        if (parsedUrl === undefined) {
            continue;
        }

        const userinfo = url.slice(index + parsedUrl.prefix.length, parsedUrl.end - 1);

        if (PROTOCOL_RELATIVE_REGEXP.test(parsedUrl.prefix) && !userinfo.includes(':')) {
            continue;
        }

        result += url.slice(lastIndex, index) + parsedUrl.prefix;
        lastIndex = parsedUrl.end;
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
        // a fragment, so it cannot detect the credentials. The same form can
        // belong to a valid URL with an empty port, for example
        // `http://example.org:?token=a@b`, so the redaction can shorten such a
        // URL. A leak is worse than a wrong host in arbitrary text, so the
        // redaction stays conservative here. The parser uses the dot rule in
        // {@link isMalformedUserinfoForm} to keep the request target correct.
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
 * Removes credentials from all own enumerable properties of an object.
 *
 * The default error printer shows these properties, so the `path` and `dest`
 * properties of an `fs` error must not keep the userinfo component. A plain
 * object or an array in a cause chain is walked the same way.
 *
 * @param object Object to change.
 * @param getRedactedValue Returns the redacted value of a property.
 *
 * @returns `true` if all properties are redacted.
 */
const redactObjectProperties = (
    object: object,
    getRedactedValue: (value: unknown) => unknown,
): boolean => {
    let isRedacted = true;

    Object.keys(object).forEach((property) => {
        const value = (object as Record<string, unknown>)[property];
        const redactedValue = getRedactedValue(value);

        if (redactedValue !== value && !setObjectProperty(object, property, redactedValue)) {
            isRedacted = false;
        }
    });

    return isRedacted;
};

/**
 * Creates a copy of an object with redacted own enumerable properties.
 *
 * The function is used when the properties of the original object cannot be
 * changed. Nested plain objects and arrays are copied too.
 *
 * @param object Original object.
 * @param getRedactedValue Returns the redacted value of a property.
 * @param seen Map of the objects that are already processed to their redacted
 * value, used to stop on cycles and reuse a redacted copy.
 *
 * @returns Copy with the redacted text.
 */
const createRedactedObject = (
    object: object,
    getRedactedValue: (value: unknown) => unknown,
    seen?: WeakMap<object, unknown>,
): object => {
    const redactedObject = (Array.isArray(object) ? [] : {}) as Record<string, unknown>;

    // Register the copy before the properties are filled, so a reference back
    // to the original object in a cycle points to the copy.
    seen?.set(object, redactedObject);

    Object.keys(object).forEach((property) => {
        const value = (object as Record<string, unknown>)[property];
        redactedObject[property] = getRedactedValue(value);
    });

    return redactedObject;
};

/**
 * Checks if a value is a plain object, for example an object literal from a
 * request config, rather than a class instance such as a `Buffer`.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value is a plain object.
 */
const isPlainObject = (value: object): boolean => {
    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
};

/**
 * Checks if a nested value should be redacted recursively.
 *
 * Only arrays, errors, and plain objects are walked. Other objects, for example
 * a `Buffer` or a `Map`, do not expose their data as own enumerable string
 * properties, so walking them would be wasteful or would not redact anything.
 *
 * @param value Value to check.
 *
 * @returns `true` if the value should be redacted recursively.
 */
const isRedactableObject = (value: unknown): value is object => typeof value === 'object'
    && value !== null
    && (value instanceof Error || Array.isArray(value) || isPlainObject(value));

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
 * A string, a plain object, or an array in the chain is redacted too, including
 * the objects nested in them. The function changes the objects in place, so
 * their identity, type and additional properties are kept. If a property
 * cannot be changed, the function returns a new object with the redacted text
 * instead.
 *
 * @param error Error or other value to redact.
 * @param seen Map of the objects that are already processed to their redacted
 * value, used to stop on cycles and reuse a redacted copy.
 * @param knownUrl URL that can contain any character in the userinfo, or a
 * list of replacements for a path that contains the URL.
 *
 * @returns The same value, or a redacted copy if it cannot be changed in
 * place.
 */
export const redactErrorCredentials = (
    error: unknown,
    seen = new WeakMap<object, unknown>(),
    knownUrl?: string | readonly KnownUrlReplacement[],
): unknown => {
    if (typeof error === 'string') {
        return redactKnownUrlText(error, knownUrl);
    }

    if (typeof error !== 'object' || error === null) {
        return error;
    }

    if (seen.has(error)) {
        return seen.get(error);
    }
    seen.set(error, error);

    // A nested plain object or an array is redacted recursively with the same
    // map, so a cause such as `{ config: { url } }` is covered too.
    const getRedactedValue = (value: unknown): unknown => {
        if (typeof value === 'string') {
            return redactKnownUrlText(value, knownUrl);
        }

        if (isRedactableObject(value)) {
            return redactErrorCredentials(value, seen, knownUrl);
        }

        return value;
    };

    if (!(error instanceof Error)) {
        if (redactObjectProperties(error, getRedactedValue)) {
            return error;
        }

        return createRedactedObject(error, getRedactedValue, seen);
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

    if (!isMessageRedacted || !isStackRedacted || !redactObjectProperties(error, getRedactedValue)) {
        redactedError = createRedactedError(error, message, typeof stack === 'string' ? stack : undefined);
        seen.set(error, redactedError);
    }

    const { cause } = error;
    if (cause !== undefined) {
        const redactedCause = redactErrorCredentials(cause, seen, knownUrl);

        if (
            (redactedError !== error || redactedCause !== cause)
            && !setObjectProperty(redactedError, 'cause', redactedCause)
        ) {
            redactedError = createRedactedError(error, message, typeof stack === 'string' ? stack : undefined);
            seen.set(error, redactedError);
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
