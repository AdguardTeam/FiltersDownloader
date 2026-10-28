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
 * component of a URL.
 */
const USERINFO_REGEXP = /^([a-z][a-z0-9+.-]*:\/\/|\/\/)([^/?#]*)@/i;

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
 * parse without a base URL.
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

    if (!userinfo) {
        return { url: sanitizedUrl };
    }

    const separatorIndex = userinfo.indexOf(':');
    const username = separatorIndex === -1
        ? userinfo
        : userinfo.slice(0, separatorIndex);
    const password = separatorIndex === -1
        ? ''
        : userinfo.slice(separatorIndex + 1);

    return {
        url: sanitizedUrl,
        credentials: {
            username: decodeUserInfo(username),
            password: decodeUserInfo(password),
        },
    };
};

/**
 * Removes the userinfo component from a URL.
 *
 * @param url URL that may contain a username and a password.
 *
 * @returns URL without the userinfo component.
 */
export const stripUrlCredentials = (url: string): string => parseUrlCredentials(url).url;
