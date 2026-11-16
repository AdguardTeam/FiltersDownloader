/**
 * Collects the message, the stack, the own string properties, the causes, and
 * the nested errors of an error.
 *
 * @param error Error or other value to collect text from.
 *
 * @returns Text of the error and its whole chain.
 */
export const getErrorChainText = (error: unknown): string => {
    if (typeof error === 'string') {
        return error;
    }

    if (!(error instanceof Error)) {
        return String(error);
    }

    const parts = [error.message, error.stack ?? ''];

    Object.keys(error).forEach((property) => {
        const value = (error as unknown as Record<string, unknown>)[property];

        if (typeof value === 'string') {
            parts.push(value);
        }
    });

    const { cause } = error;

    if (cause !== undefined) {
        parts.push(getErrorChainText(cause));
    }

    if (error instanceof AggregateError) {
        error.errors.forEach((nestedError) => {
            parts.push(getErrorChainText(nestedError));
        });
    }

    return parts.join('\n');
};
