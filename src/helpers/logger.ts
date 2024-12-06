/**
 * The number of lines to include before the error line in the error message.
 */
const LINES_BEFORE_DIRECTIVE = 3;

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
    const errorDetails = [`${errorDescription} '${errorRule}'`];

    if (filterUrl) {
        errorDetails.push(`URL: '${filterUrl}'`);
    }

    if (contextLines) {
        errorDetails.push('Context:');
        errorDetails.push(contextLines);
        errorDetails.push(`\t${errorRule}`);
    }

    if (originalError) {
        const originalErrorMessage = originalError instanceof Error ? originalError.message : String(originalError);
        errorDetails.push(`\t${originalErrorMessage}`);
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
