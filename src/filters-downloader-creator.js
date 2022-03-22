/**
 * This file is part of Adguard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * Adguard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Adguard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * The utility tool resolves preprocessor directives in filter content.
 *
 * Directives syntax:
 * !#if, !#endif - filters maintainers can use these conditions to supply different rules depending on the ad blocker type.
 * condition - just like in some popular programming languages, pre-processor conditions are based on constants declared by ad blockers. Ad blocker authors define on their own what exact constants do they declare.
 * !#include - this directive allows to include contents of a specified file into the filter.
 *
 * Condition constants should be declared in FilterCompilerConditionsConstants
 *
 * More details:
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/917
 */
const FiltersDownloaderCreator = (FileDownloadWrapper) => {
    "use strict";

    const CONDITION_DIRECTIVE_START = "!#if";
    const CONDITION_DIRECTIVE_END = "!#endif";

    const CONDITION_OPERATOR_NOT = "!";
    const CONDITION_OPERATOR_AND = "&&";
    const CONDITION_OPERATOR_OR = "||";
    const CONDITION_BRACKET_OPEN_CHAR = "(";
    const CONDITION_BRACKET_CLOSE_CHAR = ")";

    const INCLUDE_DIRECTIVE = "!#include";

    const REGEXP_ABSOLUTE_URL = /^([a-z]+:\/\/|\/\/)/i;
    const REGEXP_EXTERNAL_ABSOLUTE_URL = /^((?!file)[a-z]+:\/\/|\/\/)/i;

    /**
     * Checks brackets in string
     *
     * @param str
     */
    const checkBracketsBalance = (str) => {
        let depth = 0;
        for (let i in str) {
            if (str[i] === CONDITION_BRACKET_OPEN_CHAR) {
                // if the char is an opening parenthesis then we increase the depth
                depth++;
            } else if (str[i] === CONDITION_BRACKET_CLOSE_CHAR) {
                // if the char is an closing parenthesis then we decrease the depth
                depth--;
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
     * Finds end of condition block started with startIndex
     *
     * @param rules
     * @param startIndex
     */
    const findConditionEnd = (rules, startIndex) => {
        const stack = [];
        for (let j = startIndex; j < rules.length; j++) {
            let internalRule = rules[j];

            if (internalRule.startsWith(CONDITION_DIRECTIVE_START)) {
                stack.push(CONDITION_DIRECTIVE_START);

            } else if (internalRule.startsWith(CONDITION_DIRECTIVE_END)) {
                if (stack.length > 0) {
                    stack.pop();
                } else {
                    return j;
                }
            }
        }

        return -1;
    };

    /**
     * Resolves constant expression
     *
     * @param expression
     * @param definedProperties
     */
    const resolveConditionConstant = (expression, definedProperties) => {
        if (!expression) {
            throw new Error('Invalid directives: Empty condition');
        }

        let trim = expression.trim();
        return trim === "true" || definedProperties[trim];
    };

    /**
     * Calculates conditional expression
     *
     * @param expression
     * @param definedProperties
     */
    const resolveExpression = (expression, definedProperties) => {
        if (!expression) {
            throw new Error('Invalid directives: Empty condition');
        }

        expression = expression.trim();

        if (!checkBracketsBalance(expression)) {
            throw new Error('Invalid directives: Incorrect brackets: ' + expression);
        }

        //Replace bracketed expressions
        const openBracketIndex = expression.lastIndexOf(CONDITION_BRACKET_OPEN_CHAR);
        if (openBracketIndex !== -1) {
            const endBracketIndex = expression.indexOf(CONDITION_BRACKET_CLOSE_CHAR, openBracketIndex);
            const innerExpression = expression.substring(openBracketIndex + 1, endBracketIndex);
            const innerResult = resolveExpression(innerExpression, definedProperties);
            const resolvedInner = expression.substring(0, openBracketIndex) +
                innerResult + expression.substring(endBracketIndex + 1);

            return resolveExpression(resolvedInner, definedProperties);
        }

        let result;

        // Resolve logical operators
        const indexOfAndOperator = expression.indexOf(CONDITION_OPERATOR_AND);
        const indexOfOrOperator = expression.indexOf(CONDITION_OPERATOR_OR);
        const indexOfNotOperator = expression.indexOf(CONDITION_OPERATOR_NOT);

        if (indexOfOrOperator !== -1) {
            result = resolveExpression(expression.substring(0, indexOfOrOperator - 1), definedProperties) ||
                resolveExpression(expression.substring(indexOfOrOperator + CONDITION_OPERATOR_OR.length, expression.length), definedProperties);
        } else if (indexOfAndOperator !== -1) {
            result = resolveExpression(expression.substring(0, indexOfAndOperator - 1), definedProperties) &&
                resolveExpression(expression.substring(indexOfAndOperator + CONDITION_OPERATOR_AND.length, expression.length), definedProperties);
        } else if (indexOfNotOperator === 0) {
            result = !resolveExpression(expression.substring(CONDITION_OPERATOR_NOT.length), definedProperties);
        } else {
            result = resolveConditionConstant(expression, definedProperties);
        }

        return result;
    };

    /**
     * Validates and resolves condition directive
     *
     * @param directive
     * @param definedProperties
     */
    const resolveCondition = (directive, definedProperties) => {
        const expression = directive.substring(CONDITION_DIRECTIVE_START.length).trim();

        return resolveExpression(expression, definedProperties);
    };

    /**
     * Resolves conditions directives
     *
     * @param rules
     * @param definedProperties
     */
    const resolveConditions = (rules, definedProperties) => {
        if (!definedProperties) {
            return rules;
        }

        let result = [];

        for (let i = 0; i < rules.length; i++) {
            let rule = rules[i];

            if (rule.indexOf(CONDITION_DIRECTIVE_START) === 0) {
                let endLineIndex = findConditionEnd(rules, i + 1);
                if (endLineIndex === -1) {
                    throw new Error('Invalid directives: Condition end not found: ' + rule);
                }

                let conditionValue = resolveCondition(rule, definedProperties);
                if (conditionValue) {
                    let rulesUnderCondition = rules.slice(i + 1, endLineIndex);
                    // Resolve inner conditions in recursion
                    result = result.concat(resolveConditions(rulesUnderCondition, definedProperties));
                }

                // Skip to the end of block
                i = endLineIndex;
            } else if (rule.indexOf(CONDITION_DIRECTIVE_END) === 0) {
                // Found condition end without start
                throw new Error('Invalid directives: Found unexpected condition end: ' + rule);
            } else {
                result.push(rule);
            }
        }

        return result;
    };

    /**
     * Validates url to be the same origin with original filterUrl
     *
     * @param url
     * @param filterUrlOrigin
     */
    const validateUrl = function (url, filterUrlOrigin) {
        if (filterUrlOrigin) {
            if (REGEXP_ABSOLUTE_URL.test(url)) {

                // Include url is absolute
                const urlOrigin = parseURL(url).origin;
                const filterOrigin = parseURL(filterUrlOrigin).origin;
                if (urlOrigin !== filterOrigin) {
                    throw new Error('Include url is rejected with origin: ' + urlOrigin);
                }
            }
        }
    };

    /**
     * Validates and resolves include directive
     *
     * @param {string} line
     * @param {?string} filterOrigin Filter file URL origin or null
     * @param {?object} definedProperties An object with the defined properties. These properties might be used in pre-processor directives (`#if`, etc)
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const resolveInclude = function (line, filterOrigin, definedProperties) {
        if (line.indexOf(INCLUDE_DIRECTIVE) !== 0) {
            return Promise.resolve(line);
        } else {
            const url = line.substring(INCLUDE_DIRECTIVE.length).trim();
            validateUrl(url, filterOrigin);
            return downloadFilterRules(url, filterOrigin, definedProperties);
        }
    };

    /**
     * Resolves include directives
     *
     * @param {Array} rules   array of rules
     * @param {?string} filterOrigin Filter file URL origin or null
     * @param {?object} definedProperties An object with the defined properties. These properties might be used in pre-processor directives (`#if`, etc)
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const resolveIncludes = (rules, filterOrigin, definedProperties) => {
        const dfds = [];

        for (let rule of rules) {
            dfds.push(resolveInclude(rule, filterOrigin, definedProperties));
        }

        return Promise.all(dfds).then((values) => {
            let result = [];

            values.forEach(function (v) {
                if (Array.isArray(v)) {
                    result = result.concat(v);
                } else {
                    result.push(v);
                }
            });

            return result;
        });
    };

    /**
     * Compiles filter content
     *
     * @param {Array} rules Array of strings
     * @param {?string} filterUrlOrigin Filter file URL origin or null
     * @param {?object} definedProperties An object with the defined properties. These properties might be used in pre-processor directives (`#if`, etc)
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const compile = (rules, filterOrigin, definedProperties) => {
        try {
            // Resolve 'if' conditions
            const resolvedConditionsResult = resolveConditions(rules, definedProperties);

            // Resolve 'includes' directives
            return resolveIncludes(resolvedConditionsResult, filterOrigin, definedProperties);
        } catch (ex) {
            return Promise.reject(ex);
        }
    };

    /**
     * Downloads filter rules from url
     *
     * @param {string} url Filter file URL
     * @param {?string} filterUrlOrigin Filter file URL origin or null
     * @param {?object} definedProperties An object with the defined properties. These properties might be used in pre-processor directives (`#if`, etc)
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const downloadFilterRules = (url, filterUrlOrigin, definedProperties) => {
        if (REGEXP_EXTERNAL_ABSOLUTE_URL.test(url) || REGEXP_EXTERNAL_ABSOLUTE_URL.test(filterUrlOrigin)) {
            return externalDownload(url, filterUrlOrigin, definedProperties);
        } else {
            return getLocalFile(url, filterUrlOrigin, definedProperties);
        }
    };

    /**
     * Downloads filter rules from external url
     *
     * @param {string} url Filter file absolute URL or relative path
     * @param {?string} filterUrlOrigin Filter file URL origin or null
     * @param {?object} definedProperties An object with the defined properties. These properties might be used in pre-processor directives (`#if`, etc)
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const externalDownload = (url, filterUrlOrigin, definedProperties) => {

        // getting absolute url for external file with relative url
        if (!REGEXP_ABSOLUTE_URL.test(url) && REGEXP_ABSOLUTE_URL.test(filterUrlOrigin)) {
            url = `${filterUrlOrigin}/${url}`;
        }

        return FileDownloadWrapper.getExternalFile(url, filterUrlOrigin, definedProperties).then((lines) => {
            // Filter origin could change in case url contains subdirectories
            // https://github.com/AdguardTeam/FiltersRegistry/pull/256
            filterUrlOrigin = getFilterUrlOrigin(url, null);

            // Resolve 'if' conditions and 'includes' directives
            const resolvedConditionsResult = resolveConditions(lines, definedProperties);
            return resolveIncludes(resolvedConditionsResult, filterUrlOrigin, definedProperties);
        });
    };

    /**
     * Get filter rules from local path
     *
     * @param {string} url local path
     * @param {?string} filterUrlOrigin origin path
     * @param {?object} definedProperties An object with the defined properties
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const getLocalFile = (url, filterUrlOrigin, definedProperties) => {
        if (filterUrlOrigin) {
            url = `${filterUrlOrigin}/${url}`;
        }

        filterUrlOrigin = getFilterUrlOrigin(url, filterUrlOrigin);

        return FileDownloadWrapper.getLocalFile(url, filterUrlOrigin, definedProperties).then((lines) => {
            filterUrlOrigin = getFilterUrlOrigin(url, null);

            // Resolve 'if' conditions and 'includes' directives
            const resolvedConditionsResult = resolveConditions(lines, definedProperties);
            return resolveIncludes(resolvedConditionsResult, filterUrlOrigin, definedProperties);
        });
    };

    /**
     * Get the `filterUrlOrigin` from url for relative path resolve
     *
     * @param {string} url Filter file URL
     * @param {string|null} filterUrlOrigin  existing origin url
     * @returns {string} valid origin url
     */
    const getFilterUrlOrigin = (url, filterUrlOrigin) => {
        if (filterUrlOrigin) {
            return filterUrlOrigin;
        } else {
            return url.substring(0, url.lastIndexOf('/'));
        }
    };

    /**
     * Downloads a specified filter and interpretes all the pre-processor directives from there.
     *
     * @param {string} url Filter file URL
     * @param {Object} definedProperties An object with the defined properties. These properties might be used in pre-processor directives (`#if`, etc)
     * @returns {Promise} A promise that returns {string} with rules when if resolved and {Error} if rejected.
     */
    const download = async (url, definedProperties) => {
        try {
            let filterUrlOrigin;
            if (url && REGEXP_EXTERNAL_ABSOLUTE_URL.test(url)) {
                filterUrlOrigin = getFilterUrlOrigin(url)
            }

            const response = await downloadFilterRules(url, filterUrlOrigin, definedProperties);

            // only included filters can be empty
            if (response && response.join().trim() == '') {
                throw new Error("Response is empty");
            }

            return response;
        } catch (ex) {
            return Promise.reject(ex);
        }
    };

    /**
     * Parse url
     *
     * @param {string} url
     * @returns {object}  parsed url data
     */
    const parseURL = (url) => {
        if (typeof URL !== 'undefined') {
            return new URL(url);
        } else {
            let URL = require('url').URL;
            return new URL(url);
        }
    };

    return {
        compile: compile,
        download: download,
        resolveConditions: resolveConditions,
        resolveIncludes: resolveIncludes,
        getFilterUrlOrigin: getFilterUrlOrigin
    };
};

module.exports = FiltersDownloaderCreator;
