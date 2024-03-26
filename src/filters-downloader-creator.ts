/**
 * This file is part of AdGuard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * AdGuard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdGuard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with AdGuard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

import { DiffUpdater, UnacceptableResponseError } from '@adguard/diff-builder/diff-updater';
import { isValidChecksum } from './checksum';

/**
 * The utility tool resolves preprocessor directives in filter content.
 *
 * Directives syntax:
 * - `!#if`, `!#endif` — filters maintainers can use these conditions to supply different rules
 *   depending on the ad blocker type.
 * - `condition` — just like in some popular programming languages, pre-processor conditions are based on constants
 *   declared by ad blockers. Ad blocker authors define on their own what exact constants do they declare.
 * - `!#include` — this directive allows to include contents of a specified file into the filter.
 *
 * Condition constants should be declared in FilterCompilerConditionsConstants.
 *
 * More details:
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/917.
 */

/**
 * An interface representing a file download wrapper with methods to retrieve
 * local and external files.
 *
 * @interface IFileDownloader
 */
interface IFileDownloader {
    getLocalFile: (url: string, filterUrlOrigin: string) => Promise<string>,
    getExternalFile: (url: string) => Promise<string>,
}

interface DownloadOptions {
    resolveDirectives: boolean,
    /**
     * These properties might be used in pre-processor directives (`#if`, etc.). They are used to resolve conditions.
     */
    definedExpressions?: DefinedExpressions,
    filterOrigin?: string,
    validateChecksum?: boolean,
    validateChecksumStrict?: boolean
}

/**
 * These options were added separately to the download method to support backward compatibility.
 */
interface LegacyDownloadOptions {
    validateChecksum?: boolean,
    validateChecksumStrict?: boolean
}

/**
 * Options interface for the downloadWithRaw method.
 */
interface DownloadWithRawOptions {
    /**
     * A boolean flag that, when set to true, indicates that the filter
     * should be downloaded entirely from the server without applying differential patches. By default, false.
     */
    force?: boolean,
    /**
     * Filter before conditions and includes resolved, like it was downloaded from the server.
     * By default, undefined.
     */
    rawFilter?: string,
    /**
     * Compiler options to be applied while downloading the filter.
     * By default, undefined.
     */
    definedExpressions?: DefinedExpressions,

    /**
     * A boolean option for controlling the verbosity of logs. If true, it will log more detailed information during the
     * download process.
     * It is disabled (set to false) by default, but could be useful for troubleshooting and debugging.
     */
    verbose?: boolean

    /**
     * Option to run validation of checksum of the downloaded filter. If checksum was not found in the file, it will
     * not throw error unless validateChecksumStrict is set to true.
     */
    validateChecksum?: boolean

    /**
     * Whether checksum validation should throw error or no if checksum was not found in the file.
     * If it is true, it will throw error if checksum was not found in the file.
     */
    validateChecksumStrict?: boolean
}

/**
 * This method downloads filter rules from a specified URL and applies the defined expressions to resolve conditions.
 */
interface DownloadInterface {
    (
        /**
         * The absolute URL from which the filter is to be downloaded.
         */
        url: string,
        /**
         * An object containing defined expressions for condition resolution.
         */
        definedExpressions?: DefinedExpressions,
        /**
         * The options/configuration to be applied while downloading the filter.
         */
        options?: LegacyDownloadOptions
    ): Promise<string[]>
}

/**
 * Downloads filter rules from a specified URL, and returns both the processed filter and raw filter.
 * The raw filter, which is the filter before any conditions are applied or inclusions resolved,
 * is kept for future use, particularly for patch application.
 * If needed, the filter is also patched with any available patches.
 */
interface DownloadWithRawInterface {
    (
        /**
         * The absolute URL from which the filter is to be downloaded.
         */
        url: string,
        /**
         * The options/configuration to be applied while downloading the filter.
         * This is required.
         */
        options: DownloadWithRawOptions
    ): Promise<DownloadResult>;
}

/**
 * An interface representing defined expressions for condition resolution.
 *
 * @interface DefinedExpressions
 */
interface DefinedExpressions {
    adguard?: boolean,
    adguard_ext_chromium?: boolean,
    adguard_ext_firefox?: boolean,
    adguard_ext_edge?: boolean,
    adguard_ext_safari?: boolean,
    adguard_ext_opera?: boolean,
    adguard_ext_android_cb?: boolean
}

export interface DownloadResult {
    /**
     * Might be the same as raw filter if no conditions or includes were resolved.
     */
    filter: string[];

    /**
     * The raw filter, which is the filter before any conditions are applied or inclusions resolved.
     */
    rawFilter: string;

    /**
     * Flag to indicate if the patch update failed.
     *
     * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2717}
     */
    isPatchUpdateFailed?: boolean;
}

/**
 * An interface representing a Filters Downloader, which provides methods to compile, download,
 * resolve conditions, resolve includes, and get the filter URL origin.
 *
 * @interface IFiltersDownloader
 */
interface IFiltersDownloader {
    compile: (rules: string[], filterOrigin?: string, expressions?: DefinedExpressions) => Promise<string[]>;
    download: DownloadInterface;
    downloadWithRaw: DownloadWithRawInterface;
    resolveConditions: (rules: string[], expressions?: DefinedExpressions) => string[];
    resolveIncludes: (rules: string[], filterOrigin?: string, expressions?: DefinedExpressions) => Promise<string[]>;
    getFilterUrlOrigin: (url: string, filterUrlOrigin?: string) => string;
}

const FiltersDownloaderCreator = (FileDownloadWrapper: IFileDownloader): IFiltersDownloader => {
    const CONDITION_IF_DIRECTIVE_START = '!#if';
    const CONDITION_ELSE_DIRECTIVE_START = '!#else';
    const CONDITION_DIRECTIVE_END = '!#endif';

    const CONDITION_OPERATOR_NOT = '!';
    const CONDITION_OPERATOR_AND = '&&';
    const CONDITION_OPERATOR_OR = '||';
    const CONDITION_BRACKET_OPEN_CHAR = '(';
    const CONDITION_BRACKET_CLOSE_CHAR = ')';

    const INCLUDE_DIRECTIVE = '!#include';

    const REGEXP_ABSOLUTE_URL = /^([a-z]+:\/\/|\/\/)/i;
    const REGEXP_EXTERNAL_ABSOLUTE_URL = /^((?!file)[a-z]+:\/\/|\/\/)/i;

    /**
     * Checks if the opening and closing brackets in a string are balanced.
     *
     * @param str The input string to check for bracket balance.
     * @returns Returns `true` if the brackets are balanced, `false` otherwise.
     */
    const checkBracketsBalance = (str: string): boolean => {
        let depth = 0;

        for (let i = 0; i < str.length; i += 1) {
            if (str[i] === CONDITION_BRACKET_OPEN_CHAR) {
                // if the char is an opening parenthesis, then we increase the depth
                depth += 1;
            } else if (str[i] === CONDITION_BRACKET_CLOSE_CHAR) {
                // if the char is a closing parenthesis, then we decrease the depth
                depth -= 1;
            }
            //  if the depth is negative we have a closing parenthesis
            //  before any matching opening parenthesis
            if (depth < 0) {
                return false;
            }
        }

        // If the depth is not null then a closing parenthesis is missing
        if (depth > 0) {
            return false;
        }

        return true;
    };

    /**
     * Parses url and returns its origin.
     *
     * @param url URL to parse.
     *
     * @returns URL origin if url can be parsed.
     * @throws If url cannot be parsed.
     */
    const getUrlOrigin = (url: string): string => {
        try {
            const { origin } = new URL(url);

            return origin;
        } catch (e) {
            throw new Error(`Invalid url: '${url}'`);
        }
    };

    /**
     * Get the `filterOrigin` from url for relative path resolve.
     *
     * @param url Filter file URL.
     * @param filterUrlOrigin Existing origin url.
     * @returns Valid origin url.
     */
    const getFilterUrlOrigin = (url: string, filterUrlOrigin?: string): string => {
        if (filterUrlOrigin) {
            return filterUrlOrigin;
        }
        return url.substring(0, url.lastIndexOf('/'));
    };

    /**
     * Finds end of condition block started with startIndex.
     *
     * @param rules Array of all rules.
     * @param endDirective End directive for the condition block — `!#else` or `!#endif`.
     * @param startIndex Index of the start for presumed condition block.
     * @param endIndex Index of the end for presumed condition block,
     * needed for `!#else` directive if index of `!#endif` was found before to limit the search.
     *
     * @returns Index of the end of the condition block for the `endDirective`.
     */
    const findConditionBlockEnd = (
        rules: string[],
        endDirective: string,
        startIndex: number,
        endIndex: number,
    ): number => {
        const stack: string[] = [];

        for (let i = startIndex; i < endIndex; i += 1) {
            const rule = rules[i];

            if (rule.startsWith(CONDITION_IF_DIRECTIVE_START)) {
                stack.push(CONDITION_IF_DIRECTIVE_START);
            } else if (rule.startsWith(endDirective)) {
                if (stack.length > 0) {
                    stack.pop();
                } else {
                    return i;
                }
            }
        }

        return -1;
    };

    /**
     * Resolves a conditional expression to a boolean value based
     * on defined properties.
     *
     * @param expression The conditional expression to resolve.
     * @param definedExpressions An object containing defined properties for evaluation.
     *
     * @throws Throws an error if the expression is empty.
     *
     * @returns Returns `true` if the expression evaluates to `true` or a defined
     * property exists; otherwise, returns `false`.
     */
    const resolveConditionConstant = (expression: string, definedExpressions?: DefinedExpressions): boolean => {
        if (!expression) {
            throw new Error('Invalid directives: Empty condition');
        }

        const trimmedExpression = expression.trim();

        if (trimmedExpression === 'true') {
            return true;
        }

        const expressionAsKey = trimmedExpression as keyof DefinedExpressions;
        if (definedExpressions?.[expressionAsKey] === true) {
            return true;
        }

        return false;
    };

    /**
     * Resolves a conditional expression and returns whether the expression
     * evaluates to `true` or `false` based on defined properties.
     *
     * @param rawExpression The raw conditional expression to resolve.
     * @param definedProperties An object containing defined expressions for
     * condition resolution.
     *
     * @returns Boolean `true` if the expression evaluates to `true`,
     * `false` otherwise.
     *
     * @throws Error If the expression is empty or contains incorrect brackets.
     */
    const resolveExpression = (rawExpression: string, definedProperties?: DefinedExpressions): boolean => {
        if (!rawExpression) {
            throw new Error('Invalid directives: Empty condition');
        }

        const expression = rawExpression.trim();

        if (!checkBracketsBalance(expression)) {
            throw new Error(`Invalid directives: Incorrect brackets: ${expression}`);
        }

        // Replace bracketed expressions
        const openBracketIndex = expression.lastIndexOf(CONDITION_BRACKET_OPEN_CHAR);
        if (openBracketIndex !== -1) {
            const endBracketIndex = expression.indexOf(CONDITION_BRACKET_CLOSE_CHAR, openBracketIndex);
            const innerExpression = expression.substring(openBracketIndex + 1, endBracketIndex);
            const innerResult = resolveExpression(innerExpression, definedProperties);
            const resolvedInner = expression.substring(0, openBracketIndex)
                + innerResult + expression.substring(endBracketIndex + 1);

            return resolveExpression(resolvedInner, definedProperties);
        }

        let result;

        // Resolve logical operators
        const indexOfAndOperator = expression.indexOf(CONDITION_OPERATOR_AND);
        const indexOfOrOperator = expression.indexOf(CONDITION_OPERATOR_OR);
        const indexOfNotOperator = expression.indexOf(CONDITION_OPERATOR_NOT);

        if (indexOfOrOperator !== -1) {
            result = resolveExpression(
                expression.substring(0, indexOfOrOperator - 1),
                definedProperties,
            ) || resolveExpression(
                expression.substring(indexOfOrOperator + CONDITION_OPERATOR_OR.length, expression.length),
                definedProperties,
            );
        } else if (indexOfAndOperator !== -1) {
            result = resolveExpression(
                expression.substring(0, indexOfAndOperator - 1),
                definedProperties,
            ) && resolveExpression(
                expression.substring(indexOfAndOperator + CONDITION_OPERATOR_AND.length, expression.length),
                definedProperties,
            );
        } else if (indexOfNotOperator === 0) {
            result = !resolveExpression(expression.substring(CONDITION_OPERATOR_NOT.length), definedProperties);
        } else {
            result = resolveConditionConstant(expression, definedProperties);
        }

        return result;
    };

    /**
     * Resolves a conditional directive and returns whether the condition is true based on defined properties.
     *
     * @param directive The conditional directive to resolve.
     * @param definedProperties An object containing defined expressions for condition resolution.
     * @returns `true` if the condition is true, `false` otherwise.
     */
    const resolveCondition = (directive: string, definedProperties?: DefinedExpressions): boolean => {
        const expression = directive.substring(CONDITION_IF_DIRECTIVE_START.length).trim();

        return resolveExpression(expression, definedProperties);
    };

    /**
     * Resolves conditional directives in a list of filtering rules based on
     * defined properties.
     *
     * @param rules The list of filtering rules to resolve.
     * @param definedExpressions An object containing defined expressions for
     * condition resolution.
     *
     * @returns The resolved filtering rules after processing conditional directives.
     *
     * @throws Throws an error if invalid conditional directives are encountered.
     */
    const resolveConditions = (
        rules: string[],
        definedExpressions?: DefinedExpressions,
    ): string[] => {
        if (!definedExpressions) {
            return rules;
        }

        let result: string[] = [];

        for (let i = 0; i < rules.length; i += 1) {
            const rule = rules[i];

            if (rule.indexOf(CONDITION_IF_DIRECTIVE_START) === 0) {
                const endLineIndex = findConditionBlockEnd(
                    rules,
                    CONDITION_DIRECTIVE_END,
                    i + 1,
                    rules.length,
                );
                if (endLineIndex === -1) {
                    throw new Error(`Invalid directives: Condition end not found: ${rule}`);
                }

                const elseLineIndex = findConditionBlockEnd(
                    rules,
                    CONDITION_ELSE_DIRECTIVE_START,
                    i + 1,
                    endLineIndex,
                );
                const isConditionMatched = resolveCondition(rule, definedExpressions);

                // if there is no 'else' branch for the condition
                if (elseLineIndex === -1) {
                    if (isConditionMatched) {
                        const rulesUnderCondition = rules.slice(i + 1, endLineIndex);
                        // Resolve inner conditions in recursion
                        result = result.concat(resolveConditions(rulesUnderCondition, definedExpressions));
                    }
                } else {
                    // check if there is something after !#else
                    if (rules[elseLineIndex].trim().length !== CONDITION_ELSE_DIRECTIVE_START.length) {
                        throw new Error(`Invalid directives: Found invalid !#else: ${rule}`);
                    }

                    if (isConditionMatched) {
                        const rulesForConditionTrue = rules.slice(i + 1, elseLineIndex);
                        // Resolve inner conditions in recursion
                        result = result.concat(resolveConditions(rulesForConditionTrue, definedExpressions));
                    } else {
                        const rulesForConditionFalse = rules.slice(elseLineIndex + 1, endLineIndex);
                        // Resolve inner conditions in recursion
                        result = result.concat(resolveConditions(rulesForConditionFalse, definedExpressions));
                    }
                }

                // Skip to the end of block
                i = endLineIndex;
            } else if (rule.indexOf(CONDITION_ELSE_DIRECTIVE_START) === 0) {
                // Found !#else without !#if
                throw new Error(`Invalid directives: Found unexpected condition else branch: ${rule}`);
            } else if (rule.indexOf(CONDITION_DIRECTIVE_END) === 0) {
                // Found !#endif without !#if
                throw new Error(`Invalid directives: Found unexpected condition end: ${rule}`);
            } else {
                result.push(rule);
            }
        }

        return result;
    };

    /**
     * Validates a URL to ensure it matches the expected origin.
     *
     * @param url The URL to validate.
     * @param filterUrlOrigin The expected origin URL. If provided, the function
     * checks if the URL matches this origin.
     * @throws Throws an error if the URL is absolute and its origin doesn't
     * match the expected origin.
     */
    const validateUrl = (url: string, filterUrlOrigin?: string): void => {
        if (filterUrlOrigin) {
            if (REGEXP_ABSOLUTE_URL.test(url)) {
                // Include url is absolute
                const urlOrigin = getUrlOrigin(url);
                const filterOrigin = getUrlOrigin(filterUrlOrigin);
                if (urlOrigin !== filterOrigin) {
                    throw new Error(`Include url is rejected with origin: ${urlOrigin}`);
                }
            }
        }
    };

    /**
     * Validates and resolves include directive.
     *
     * @param line Line with directive.
     * @param filterOrigin Filter file URL origin or undefined.
     * @param definedExpressions An object with the defined properties.
     * These properties might be used in pre-processor directives (`#if`, etc.).
     * @returns A promise that returns string with rules if resolved and Error if rejected.
     */
    const resolveInclude = async (
        line: string,
        filterOrigin?: string,
        definedExpressions?: DefinedExpressions,
    ): Promise<string | string[]> => {
        if (line.indexOf(INCLUDE_DIRECTIVE) !== 0) {
            return Promise.resolve(line);
        }
        const url = line.substring(INCLUDE_DIRECTIVE.length).trim();
        validateUrl(url, filterOrigin);

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const { filter } = await downloadFilterRules(url, {
            filterOrigin,
            definedExpressions,
            resolveDirectives: true,
        });

        const MAX_LINES_TO_SCAN = 50;
        // Math.min inside for loop, because filter.length changes
        for (let i = 0; i < Math.min(MAX_LINES_TO_SCAN, filter.length); i += 1) {
            if (filter[i].trim().startsWith('! Diff-Path:')) {
                filter.splice(i, 1);
            }
        }

        return filter;
    };

    /**
     * Resolves include directives.
     *
     * @param rules Array of rules.
     * @param filterOrigin Filter file URL origin or null.
     * @param definedExpressions An object with the defined expressions for conditions resolution.
     * These properties might be used in pre-processor directives (`#if`, etc.).
     * @returns A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const resolveIncludes = async (
        rules: string [],
        filterOrigin?: string,
        definedExpressions?: DefinedExpressions,
    ): Promise<string[]> => {
        const promises = rules.map((rule) => resolveInclude(rule, filterOrigin, definedExpressions));

        let result: string[] = [];
        // We do not use here Promise.all because it freezes the Chromium browsers and electron built on it, if there
        // are more than 1_100_00 promises. Also, we consider that wa can afford promises to be resolved sequentially.
        for (let i = 0; i < promises.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const resolved = await promises[i];
            if (Array.isArray(resolved)) {
                result = result.concat(resolved);
            } else {
                result.push(resolved);
            }
        }

        return result;
    };

    /**
     * Splits filter by lines.
     * @param filter Filter to split.
     * @returns Array of strings.
     */
    const splitFilter = (filter: string): string[] => {
        return filter.trim().split(/[\r\n]+/);
    };

    /**
     * Downloads filter rules from an external URL or a local path and resolves
     * pre-processor directives.
     *
     * @param url Filter file absolute URL or relative path.
     * @param downloadOptions Options to be applied while downloading the filter.
     *
     * @returns A promise that returns an array of strings with rules when
     * resolved or an Error if rejected.
     * @throws Error if validateChecksum flag is true and checksum is invalid.
     */
    const externalDownload = async (
        url: string,
        downloadOptions?: DownloadOptions,
    ): Promise<DownloadResult> => {
        const filterUrlOrigin = downloadOptions?.filterOrigin;

        const filterUrl = !REGEXP_ABSOLUTE_URL.test(url) && REGEXP_ABSOLUTE_URL.test(filterUrlOrigin || '')
            // getting absolute url for external file with relative url
            ? `${filterUrlOrigin}/${url}`
            : url;

        const rawFilter = await FileDownloadWrapper.getExternalFile(filterUrl);

        if (downloadOptions && downloadOptions.validateChecksum) {
            if (!isValidChecksum(rawFilter, downloadOptions.validateChecksumStrict)) {
                throw new Error('Invalid checksum');
            }
        }

        const filter = splitFilter(rawFilter);

        if (!downloadOptions?.resolveDirectives) {
            return {
                filter,
                rawFilter,
            };
        }

        const urlOrigin = getFilterUrlOrigin(filterUrl);
        const conditionsResult = resolveConditions(filter, downloadOptions.definedExpressions);
        const includesResult = await resolveIncludes(
            conditionsResult,
            urlOrigin,
            downloadOptions.definedExpressions,
        );

        return {
            filter: includesResult,
            rawFilter,
        };
    };

    /**
     * Compiles filter content.
     *
     * @param rules Array of strings.
     * @param filterOrigin Filter file URL origin or null.
     * @param definedProperties An object with the defined properties.
     * These properties might be used in pre-processor directives (`#if`, etc.).
     * @returns A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const compile = (
        rules: string[],
        filterOrigin?: string,
        definedProperties?: DefinedExpressions,
    ): Promise<string[]> => {
        // Resolve 'if' conditions
        const resolvedConditionsResult = resolveConditions(rules, definedProperties);

        // Resolve 'includes' directives
        return resolveIncludes(resolvedConditionsResult, filterOrigin, definedProperties);
    };

    /**
     * Gets filter rules from a local path and resolves pre-processor directives.
     *
     * @param url Path to the local file.
     * @param downloadOptions Options to be applied while downloading the filter.
     * @returns A promise that returns an array of strings with rules when resolved or an Error if rejected.
     * @throws Error if validateChecksum flag is true and checksum is invalid.
     */
    const getLocalFile = async (
        url: string,
        downloadOptions: DownloadOptions,
    ): Promise<DownloadResult> => {
        const { filterOrigin } = downloadOptions;

        const urlToLoad = filterOrigin
            ? `${filterOrigin}/${url}`
            : url;

        const origin = getFilterUrlOrigin(urlToLoad, filterOrigin);
        const rawFilter = await FileDownloadWrapper.getLocalFile(urlToLoad, origin);

        if (downloadOptions && downloadOptions.validateChecksum) {
            if (!isValidChecksum(rawFilter, downloadOptions.validateChecksumStrict)) {
                throw new Error('Invalid checksum');
            }
        }

        const filterContent = splitFilter(rawFilter);

        if (!downloadOptions?.resolveDirectives) {
            return {
                filter: filterContent,
                rawFilter,
            };
        }

        const urlOrigin = getFilterUrlOrigin(urlToLoad);
        // Resolve 'if' conditions and 'includes' directives
        const conditionsResult = resolveConditions(filterContent, downloadOptions.definedExpressions);
        const includesResult = await resolveIncludes(conditionsResult, urlOrigin, downloadOptions.definedExpressions);
        return {
            filter: includesResult,
            rawFilter,
        };
    };

    /**
     * Downloads filter rules from a URL and resolves pre-processor directives.
     *
     * @param url Filter file URL.
     * @param downloadOptions
     * These properties might be used in pre-processor directives (`#if`, etc.).
     *
     * @returns A promise that returns an array of strings with rules when
     * resolved or an Error if rejected.
     */
    const downloadFilterRules = (
        url: string,
        downloadOptions: DownloadOptions,
    ): Promise<DownloadResult> => {
        if (
            REGEXP_EXTERNAL_ABSOLUTE_URL.test(url)
            || REGEXP_EXTERNAL_ABSOLUTE_URL.test(downloadOptions.filterOrigin || '')
        ) {
            return externalDownload(url, downloadOptions);
        }
        return getLocalFile(url, downloadOptions);
    };

    /**
     * Downloads a specified filter and resolves all the pre-processor directives from there.
     *
     * @param url The URL of the filter to download.
     * @param definedExpressions An object with the defined properties.
     * These properties might be used in pre-processor directives (`#if`, etc.).
     * @param options Options to be applied while downloading the filter.
     *
     * @returns A promise that resolves with a list of rules and rejects with an error if unable to download.
     * @throws Error if validateChecksum flag is true and checksum is invalid.
     */
    const download = async (
        url: string,
        definedExpressions?: DefinedExpressions,
        options?: LegacyDownloadOptions,
    ): Promise<string[]> => {
        let filterUrlOrigin;
        if (url && REGEXP_EXTERNAL_ABSOLUTE_URL.test(url)) {
            filterUrlOrigin = getFilterUrlOrigin(url);
        }

        const result = await downloadFilterRules(url, {
            filterOrigin: filterUrlOrigin,
            definedExpressions,
            resolveDirectives: true,
            validateChecksum: options?.validateChecksum,
            validateChecksumStrict: options?.validateChecksumStrict,
        });

        // only included filters can be empty
        if (result.filter && result.filter.join().trim() === '') {
            throw new Error('Response is empty');
        }

        return result.filter;
    };

    /**
     * Resolves conditions and includes based on the provided raw filter, options, and filter URL origin.
     *
     * @param rawFilter The raw filter to be resolved.
     * @param options The options used in the resolution process.
     * @param filterUrlOrigin The origin of the filter URL.
     *
     * @returns A Promise that resolves to the result of resolving the includes.
     */
    async function resolveConditionsAndIncludes(
        rawFilter: string,
        options: DownloadWithRawOptions,
        filterUrlOrigin?: string,
    ): Promise<string[]> {
        const filter = splitFilter(rawFilter);
        const resolvedConditionsResult = resolveConditions(filter, options.definedExpressions);
        return resolveIncludes(
            resolvedConditionsResult,
            filterUrlOrigin,
            options.definedExpressions,
        );
    }

    /**
     * Downloads filter rules from a URL and resolves pre-processor directives.
     *
     * @param url Filter file URL.
     * @param options Options to be applied while downloading the filter.
     *
     * @returns A promise that returns an array of strings with rules.
     */
    async function downloadAndProcess(url: string, options: DownloadWithRawOptions): Promise<DownloadResult> {
        let filterUrlOrigin;
        if (url && REGEXP_EXTERNAL_ABSOLUTE_URL.test(url)) {
            filterUrlOrigin = getFilterUrlOrigin(url);
        }

        const result = await downloadFilterRules(url, {
            filterOrigin: filterUrlOrigin,
            definedExpressions: options.definedExpressions,
            // `false` for not resolving directives
            resolveDirectives: false,
            validateChecksum: options.validateChecksum,
            validateChecksumStrict: options.validateChecksumStrict,
        });

        // only included filters can be empty
        if (result.filter && result.filter.join().trim() === '') {
            throw new Error('Response is empty');
        }

        const includesResult = await resolveConditionsAndIncludes(result.rawFilter, options, filterUrlOrigin);

        return {
            filter: includesResult,
            rawFilter: result.rawFilter,
        };
    }

    /**
     * Downloads filter rules from a URL without resolving pre-processor directives.
     *
     * @param url Filter file URL.
     * @param options Options to be applied while downloading the filter.
     *
     * @returns A promise that returns an array of strings with rules when
     * resolved or an Error if rejected.
     *
     * @throws An error if
     * - validateChecksum flag is true and checksum is invalid;
     * - DiffUpdater.applyPatch() fails and the thrown error is not {@link UnacceptableResponseError}.
     */
    const downloadWithRaw: DownloadWithRawInterface = async (url, options) => {
        options.verbose ??= false;
        options.force ??= false;

        let filterUrlOrigin;
        if (url && REGEXP_EXTERNAL_ABSOLUTE_URL.test(url)) {
            filterUrlOrigin = getFilterUrlOrigin(url);
        }

        // if options.force, then download the whole filter
        // if !options.rawFilter, then return result as is, since it is not possible to apply
        // patches without the raw filter
        if (options.force || !options.rawFilter) {
            return downloadAndProcess(url, options);
        }

        let rawFilter: string | null = '';

        try {
            rawFilter = await DiffUpdater.applyPatch({
                filterUrl: url,
                filterContent: options.rawFilter,
                verbose: options.verbose,
            });
        } catch (e) {
            if (e instanceof UnacceptableResponseError) {
                return {
                    filter: splitFilter(options.rawFilter),
                    rawFilter: options.rawFilter,
                    isPatchUpdateFailed: true,
                };
            }

            // if the error is not UnacceptableResponseError, then rethrow it further
            throw e;
        }

        // applyPatch returns null if there is no Diff-Path in the filter metadata
        if (rawFilter === null) {
            const downloadResult = await downloadAndProcess(url, options);
            return downloadResult;
        }

        // if nothing changed, then return result as is
        if (rawFilter === options.rawFilter) {
            return {
                filter: splitFilter(options.rawFilter),
                rawFilter: options.rawFilter,
            };
        }

        const resolveResult = await resolveConditionsAndIncludes(
            rawFilter,
            options,
            filterUrlOrigin,
        );

        return {
            filter: resolveResult,
            rawFilter,
        };
    };

    return {
        compile,
        download,
        downloadWithRaw,
        resolveConditions,
        resolveIncludes,
        getFilterUrlOrigin,
    };
};

export {
    IFiltersDownloader,
    DefinedExpressions,
    FiltersDownloaderCreator,
};
