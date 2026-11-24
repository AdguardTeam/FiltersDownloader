import {
    type KnownUrlReplacement,
    redactKnownUrlText,
    redactUrlCredentials,
    stripKnownUrlCredentials,
    stripUrlCredentials,
} from '../common/url';

/**
 * The number of lines to include before the error line in the error message.
 */
const LINES_BEFORE_DIRECTIVE = 3;

/**
 * Matches an include directive and its target, with or without a whitespace
 * before the target, for example `!#include user:pass@example.org/file.txt` or
 * `!#includeuser:pass@example.org/file.txt`.
 *
 * The directive parser takes everything after `!#include` as the target, so
 * the redaction must not rely on a whitespace to separate the two.
 */
const INCLUDE_DIRECTIVE_REGEXP = /^(\s*!#include)(\s*)(\S.*)$/;

/**
 * Removes the userinfo component from the target of an include directive.
 *
 * The directive names a download source, so a scheme-less value is redacted
 * too, including a password that starts with whitespace. A line that is not an
 * include directive stays unchanged: a rule can contain a `name:value@`
 * segment that is not a credential, for example
 * `||example.com^$replace=/foo:bar@baz/`.
 *
 * @param line Line to redact.
 *
 * @returns Line without the userinfo component of the include target.
 */
const redactIncludeDirective = (line: string): string => {
    const match = INCLUDE_DIRECTIVE_REGEXP.exec(line);

    if (match === null) {
        return line;
    }

    const [, directive, whitespace, target] = match;

    return `${directive}${whitespace}${stripKnownUrlCredentials(target)}`;
};

/**
 * Matches a comment line, for example `! Contact: user@example.org`.
 */
const COMMENT_LINE_REGEXP = /^\s*!/;

/**
 * Removes the userinfo component from a rule line.
 *
 * An include directive target is a download source, so its scheme-less value
 * is redacted. A comment line is redacted scheme-lessly too: a comment is not
 * a filtering rule, and a password in it is still a leak. The syntax of an
 * actual rule stays unchanged, so a rule that contains a `name:value@` segment
 * for another reason, for example `||example.com^$replace=/foo:bar@baz/`,
 * keeps it.
 *
 * @param line Line to redact.
 * @param knownUrl Known URL or replacement list.
 *
 * @returns Line without the userinfo components.
 */
const redactRuleLine = (
    line: string,
    knownUrl?: string | readonly KnownUrlReplacement[],
): string => {
    const lineWithKnownUrls = redactIncludeDirective(redactKnownUrlText(line, knownUrl));
    const redactedLine = COMMENT_LINE_REGEXP.test(lineWithKnownUrls)
        ? stripUrlCredentials(lineWithKnownUrls, true)
        : stripUrlCredentials(lineWithKnownUrls);

    return redactUrlCredentials(redactedLine);
};

/**
 * Removes the userinfo component from a message that the library generated.
 *
 * The message can contain a scheme-less path or URL, for example an `ENOENT`
 * path or a resolved include URL, so the scheme-less pass is applied to a line
 * without a leading tab. A line with a leading tab is a rule or a context line
 * of a nested error, so it keeps the rule-aware pass and its syntax stays
 * intact.
 *
 * @param text Message to redact.
 * @param knownUrl Known URL or replacement list.
 *
 * @returns Message without the userinfo components.
 */
const redactMessage = (
    text: string,
    knownUrl?: string | readonly KnownUrlReplacement[],
): string => text
    .split('\n')
    .map((line) => (line.startsWith('\t')
        ? redactRuleLine(line, knownUrl)
        : redactUrlCredentials(stripUrlCredentials(redactKnownUrlText(line, knownUrl), true))))
    .join('\n');

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
 * The function removes the userinfo component from every URL in the error rule,
 * in the context lines, and in the original error message, so a password does
 * not appear in the message.
 *
 * An include target is a download source, so its scheme-less userinfo is
 * removed too. A rule that is not an include directive keeps its syntax, for
 * example `||example.com^$replace=/foo:bar@baz/`.
 *
 * @param errorDescription The main error message.
 * @param errorRule The rule where the error occurred.
 * @param contextLines The context string (3 lines before) to include in the error message.
 * @param filterUrl The URL of the filter file.
 * @param originalError The original error to include in the error message.
 * @param knownUrl A value that the caller resolved for the download, together
 * with its redacted form, so the original error message is redacted even when
 * the value has the userinfo in its path.
 * @throws {Error} Throws an error with a detailed error message.
 */
export const throwError = (
    errorDescription: string,
    errorRule: string,
    contextLines?: string,
    filterUrl?: string,
    originalError?: unknown,
    knownUrl?: string | readonly KnownUrlReplacement[],
): void => {
    const sanitizedRule = redactRuleLine(errorRule, knownUrl);
    const errorDetails = [`${errorDescription} '${sanitizedRule}'`];

    if (filterUrl) {
        errorDetails.push(`URL: '${stripKnownUrlCredentials(filterUrl)}'`);
    }

    if (contextLines) {
        errorDetails.push('Context:');
        errorDetails.push(
            contextLines.split('\n').map((line) => redactRuleLine(line, knownUrl)).join('\n'),
        );
        errorDetails.push(`\t${sanitizedRule}`);
    }

    if (originalError) {
        const originalErrorMessage = originalError instanceof Error
            ? originalError.message
            : String(originalError);
        errorDetails.push(`\t${redactMessage(originalErrorMessage, knownUrl)}`);
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
