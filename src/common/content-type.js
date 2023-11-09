const PREFERRED_CONTENT_TYPE = 'text/plain';

/**
 * Supported content types.
 * @type {(string|string)[]}
 */
const SUPPORTED_CONTENT_TYPES = [
    PREFERRED_CONTENT_TYPE,
    // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1723
    'text/html',
];

/**
 * Returns content type error.
 * @returns {Error}
 */
const getContentTypeError = () => {
    return new Error(`Response content type should be one of: "${SUPPORTED_CONTENT_TYPES.join(', ')}"`);
};

/**
 * Checks if the content type is supported.
 * @param contentTypeHeader content type header
 * @returns {boolean} true if is supported
 */
const isContentTypeSupported = (contentTypeHeader) => {
    if (!contentTypeHeader) {
        return false;
    }
    return SUPPORTED_CONTENT_TYPES.some((ct) => contentTypeHeader.includes(ct));
};

module.exports = { getContentTypeError, isContentTypeSupported, PREFERRED_CONTENT_TYPE };
