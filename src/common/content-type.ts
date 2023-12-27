const PREFERRED_CONTENT_TYPE = 'text/plain';

/**
 * Supported content types.
 */
const SUPPORTED_CONTENT_TYPES = [
    PREFERRED_CONTENT_TYPE,
    // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1723
    'text/html',
];

/**
 * Returns content type error.
 *
 * @returns Error with description of supported content types.
 */
const getContentTypeError = (): Error => {
    return new Error(`Response content type should be one of: "${SUPPORTED_CONTENT_TYPES.join(', ')}"`);
};

/**
 * Checks if the content type is supported.
 *
 * @param contentTypeHeader Content type header.
 *
 * @returns True if supported.
 */
const isContentTypeSupported = (contentTypeHeader: string | null): boolean => {
    if (!contentTypeHeader) {
        return false;
    }
    return SUPPORTED_CONTENT_TYPES.some((ct) => contentTypeHeader.includes(ct));
};

export {
    getContentTypeError,
    isContentTypeSupported,
    PREFERRED_CONTENT_TYPE,
};
