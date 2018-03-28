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
const FilterCompiler = (() => {
    "use strict";

    const CONDITION_DIRECTIVE_START = "!#if";
    const CONDITION_DIRECTIVE_END = "!#endif";

    const CONDITION_OPERATOR_NOT = "!";
    const CONDITION_OPERATOR_AND = "&&";
    const CONDITION_OPERATOR_OR = "||";
    const CONDITION_BRACKET_OPEN_CHAR = "(";
    const CONDITION_BRACKET_CLOSE_CHAR = ")";

    const INCLUDE_DIRECTIVE = "!#include";

    let filterCompilerConstants = {};

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
        for (let j = startIndex; j < rules.length; j++) {
            let internalRule = rules[j];

            if (internalRule.startsWith(CONDITION_DIRECTIVE_START)) {
                throw new Error('Invalid directives: Nested conditions are not supported: ' + internalRule);
            }

            if (internalRule.startsWith(CONDITION_DIRECTIVE_END)) {
                return j;
            }
        }

        return -1;
    };

    /**
     * Resolves constant expression
     *
     * @param expression
     */
    const resolveConditionConstant = (expression) => {
        if (!expression) {
            throw new Error('Invalid directives: Empty condition');
        }

        let trim = expression.trim();
        return trim === "true" || FilterCompilerConditionsConstants[trim];
    };

    /**
     * Calculates conditional expression
     *
     * @param expression
     */
    const resolveExpression = (expression) => {
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
            const innerResult = resolveExpression(innerExpression);
            const resolvedInner = expression.substring(0, openBracketIndex) +
                    innerResult + expression.substring(endBracketIndex + 1);

            return resolveExpression(resolvedInner);
        }

        let result;

        // Resolve logical operators
        const indexOfAndOperator = expression.indexOf(CONDITION_OPERATOR_AND);
        const indexOfOrOperator = expression.indexOf(CONDITION_OPERATOR_OR);
        const indexOfNotOperator = expression.indexOf(CONDITION_OPERATOR_NOT);

        if (indexOfOrOperator !== -1) {
            result  = resolveExpression(expression.substring(0, indexOfOrOperator - 1)) ||
                resolveExpression(expression.substring(indexOfOrOperator + CONDITION_OPERATOR_OR.length, expression.length));
        } else if (indexOfAndOperator !== -1) {
            result  = resolveExpression(expression.substring(0, indexOfAndOperator - 1)) &&
                resolveExpression(expression.substring(indexOfAndOperator + CONDITION_OPERATOR_AND.length, expression.length));
        } else if (indexOfNotOperator === 0) {
            result = !resolveExpression(expression.substring(CONDITION_OPERATOR_NOT.length));
        } else {
            result = resolveConditionConstant(expression);
        }

        return result;
    };

    /**
     * Validates and resolves condition directive
     *
     * @param directive
     */
    const resolveCondition = (directive) => {
        const expression = directive.substring(CONDITION_DIRECTIVE_START.length).trim();

        return resolveExpression(expression);
    };

    /**
     * Resolves conditions directives
     *
     * @param rules
     */
    const resolveConditions = (rules) => {
        let result = [];

        for (let i = 0; i < rules.length; i++) {
            let rule = rules[i];

            if (rule.indexOf(CONDITION_DIRECTIVE_START) === 0) {
                let endLineIndex = findConditionEnd(rules, i + 1);
                if (endLineIndex === -1) {
                    throw new Error('Invalid directives: Condition end not found: ' + rule);
                }

                let conditionValue = resolveCondition(rule);
                if (conditionValue) {
                    result = result.concat(rules.slice(i + 1, endLineIndex));
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
     * Executes async request
     *
     * @param url Url
     * @param contentType Content type
     * @param successCallback success callback
     * @param errorCallback error callback
     */
    const executeRequestAsync = (url, contentType, successCallback, errorCallback) => {

        const request = new XMLHttpRequest();
        try {
            request.open('GET', url);
            request.setRequestHeader('Content-type', contentType);
            request.setRequestHeader('Pragma', 'no-cache');
            request.overrideMimeType(contentType);
            request.mozBackgroundRequest = true;
            if (successCallback) {
                request.onload = function () {
                    successCallback(request);
                };
            }
            if (errorCallback) {
                const errorCallbackWrapper = function () {
                    errorCallback(request);
                };
                request.onerror = errorCallbackWrapper;
                request.onabort = errorCallbackWrapper;
                request.ontimeout = errorCallbackWrapper;
            }
            request.send(null);
        } catch (ex) {
            if (errorCallback) {
                errorCallback(request, ex);
            }
        }
    };

    /**
     * Validates and resolves include directive
     *
     * @param directive
     */
    const resolveInclude = function (directive) {
        return new Promise((resolve, reject) => {
            if (directive.indexOf(INCLUDE_DIRECTIVE) !== 0) {
                resolve([directive]);
            } else {
                const url = directive.substring(INCLUDE_DIRECTIVE.length).trim();
                //TODO: Validate url

                const onError = (request, ex) => {
                    reject(ex);
                };

                const onSuccess = (response) => {
                    const responseText = response.responseText;
                    if (!responseText) {
                        onError(response, "Response is empty");
                    }

                    const lines = responseText.split(/[\r\n]+/);
                    //TODO: Compile lines
                    resolve(lines);
                };

                executeRequestAsync(url, "text/plain", onSuccess, onError);
            }
        });
    };

    /**
     * Resolves include directives
     *
     * @param rules
     */
    const resolveIncludes = (rules) => {
        const dfds = [];

        for (let rule of rules) {
            dfds.push(resolveInclude(rule));
        }

        return Promise.all(dfds);
    };

    /**
     * Initializes with constants
     *
     * @param constants object
     */
    const init = (constants) => {
        filterCompilerConstants = constants;
    };

    /**
     * Compiles filter content
     *
     * @param rules Array of strings
     * @param successCallBack
     * @param errorCallback
     */
    const compile = (rules, successCallBack, errorCallback) => {

        try {
            // Resolve 'if' conditions
            const resolvedConditionsResult = resolveConditions(rules);

            // Resolve 'includes' directives
            const promise = resolveIncludes(resolvedConditionsResult);

            promise.then((values) => {
                let result = [];
                values.forEach(function (v) {
                    result = result.concat(v);
                });

                successCallBack(result);
            }, (ex) => {
                if (errorCallback) {
                    errorCallback(ex);
                }
            });

        } catch (ex) {
            if (errorCallback) {
                errorCallback(ex);
            }
        }
    };

    return {
        init: init,
        compile: compile
    };
})();

