import { redactUrlCredentials, stripUrlCredentials } from '../common/url';

/**
 * The number of lines to include before the error line in the error message.
 */
const LINES_BEFORE_DIRECTIVE = 3;

/**
 * Matches an include directive and the URL that follows it.
 */
const INCLUDE_DIRECTIVE_REGEXP = /^(\s*!#include\s+)(\S.*)$/;

/**
 * Removes the userinfo component from the URL in a rule.
 *
 * The generic redaction does not accept every character in the userinfo, for
 * example quotes, so the URL of an include directive is sanitized as a known
 * URL first.
 *
 * @param rule Rule to redact.
 *
 * @returns Rule without the userinfo components.
 */
const redactRule = (rule: string): string => {
    const match = INCLUDE_DIRECTIVE_REGEXP.exec(rule);

    if (!match) {
        return redactUrlCredentials(rule);
    }

    const [, directive, url] = match;

    return redactUrlCredentials(`${directive}${stripUrlCredentials(url)}`);
};

/**
 * Merge an error messages by joining the array strings with a newline character.
 *
 * @param {string[]} messages - The array of message strings to format.
 * @returns {string} The formatted error message.
 */
export const mergeErrorDetails = (messages: string[]): string => `${messages.join('\n')}\n`;

/**
 * Creates and throws a detailed error message with context information.
 *
 * The function removes the userinfo component from every URL in the error rule
 * and in the context lines, so a password does not appear in the message.
 *
 * @param errorDescription The main error message.
 * @param errorRule The rule where the error occurred.
 * @param contextLines The context string (3 lines before) to include in the error message.
 * @param filterUrl The URL of the filter file.
 * @param originalError The original error to include in the error message.
 * @throws {Error} Throws an error with a detailed error message.
 */
export const throwError = (
    errorDescription: string,
    errorRule: string,
    contextLines?: string,
    filterUrl?: string,
    originalError?: unknown,
): void => {
    const sanitizedRule = redactRule(errorRule);
    const errorDetails = [`${errorDescription} '${sanitizedRule}'`];

    if (filterUrl) {
        errorDetails.push(`URL: '${stripUrlCredentials(filterUrl)}'`);
    }

    if (contextLines) {
        errorDetails.push('Context:');
        errorDetails.push(contextLines.split('\n').map(redactRule).join('\n'));
        errorDetails.push(`\t${sanitizedRule}`);
    }

    if (originalError) {
        const originalErrorMessage = originalError instanceof Error
            ? originalError.message
            : String(originalError);
        errorDetails.push(`\t${redactUrlCredentials(originalErrorMessage)}`);
    }

    const formattedErrorMessage = mergeErrorDetails(errorDetails);
    throw new Error(formattedErrorMessage);
};

/**
 * Get (3) lines before the error rule for error messages.
 * @param rulesList List of rules to get context from.
 * @param errorRuleIndex Index of the error line.
 * @returns Lines before the error rule.
 */
export const getContext = (rulesList: string[], errorRuleIndex: number): string => {
    return rulesList
        .slice(Math.max(0, errorRuleIndex - LINES_BEFORE_DIRECTIVE), errorRuleIndex)
        .map((line) => `\t${line}`)
        .join('\n');
};
