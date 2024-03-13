import MD5 from 'crypto-js/md5';
import Base64 from 'crypto-js/enc-base64';

const CHECKSUM_PATTERN = /^\s*!\s*checksum[\s-:]+([\w+/=]+).*[\r\n]+/i;

/**
 * The maximum number of characters to search for the checksum pattern.
 */
const CHECKSUM_SEARCH_LIMIT = 200;

/**
 * Removes the checksum line from the given content string.
 * @param content The content to remove the checksum from.
 * @returns The content with the checksum line removed.
 */
const removeChecksumLine = (content: string): string => {
    const partOfResponse = content.substring(0, CHECKSUM_SEARCH_LIMIT);
    const match = partOfResponse.match(CHECKSUM_PATTERN);
    if (match) {
        content = content.replace(match[0], '');
    }
    return content;
};

/**
 * Normalizes a message string by removing carriage return characters ('\r') and
 * replacing multiple newline characters ('\n') with a single newline character.
 * This function standardizes the format of newline characters in the message.
 *
 * @param content The string to normalize.
 *
 * @returns The normalized message with '\r' removed and consecutive '\n'
 * characters replaced with a single '\n'.
 */
const normalizeContent = (content: string): string => {
    content = removeChecksumLine(content);
    content = content.replace(/\r/g, '');
    content = content.replace(/\n+/g, '\n');
    return content;
};

/**
 * Calculates the checksum of the given content using the MD5 hashing algorithm
 * and encodes it in Base64. It normalizes the content by removing carriage
 * returns and replacing multiple newlines with a single newline.
 * The checksum is then formatted with a trailing special comment identifier.
 * Trailing '=' characters in the Base64 encoded string are removed to match
 * the expected format.
 *
 * @see
 * {@link https://adblockplus.org/en/filters#special-comments Adblock Plus special comments}
 * {@link https://hg.adblockplus.org/adblockplus/file/tip/addChecksum.py Adblock Plus checksum script}
 *
 * @param content The content to hash.
 *
 * @returns The formatted checksum string.
 */
export const calculateChecksumMD5 = (content: string): string => {
    content = normalizeContent(content);
    const checksum = Base64.stringify(MD5(content));

    return checksum.trim().replace(/=+$/g, '');
};

/**
 * Parses the checksum from the given content string.
 *
 * @param str The content string to parse.
 * @returns The checksum value or null if not found.
 */
const parseChecksum = (str: string): string | null => {
    const partOfResponse = str.substring(0, CHECKSUM_SEARCH_LIMIT);
    const checksumMatch = partOfResponse.match(CHECKSUM_PATTERN);
    if (!checksumMatch) {
        return null;
    }
    return checksumMatch[1] ?? null;
};

/**
 * Checks if the given filter has a valid checksum. If the filter does not have
 * a checksum, it returns false unless the strict parameter is true.
 *
 * @param filter The filter to check.
 * @param strict If true, the function returns true if the filter does not have a
 * checksum.
 * @returns True if the filter has a valid checksum, false otherwise.
 */
export const isValidChecksum = (filter: string, strict = false): boolean => {
    const expectedChecksum = parseChecksum(filter);
    if (!expectedChecksum) {
        return !strict;
    }
    const actualChecksum = calculateChecksumMD5(filter);
    return actualChecksum === expectedChecksum;
};
