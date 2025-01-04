'use strict';
import 'source-map-support/register.js';
import process from 'node:process';
import { isSymbolObject } from 'node:util/types';
export const TRUTHY_STRINGS = [
    'true', 'yes', 'y', 'on', // english
    '1', 'high', 'h', // electronics
    'da', 'ja', 'oui', 'si', 'sí'
]; // other languages
export const FALSEY_STRINGS = [
    'false', 'no', 'n', 'off', // english
    '0', 'low', 'l', // electronics
    'nyet', 'niet', 'geen', 'nein', 'non'
]; // other languages
export function isArgTypeName(name) {
    return ['boolean', 'integer', 'string', 'list'].includes(name);
}
export const next = Symbol('next');
export function argTypeName(name) {
    switch (name) {
        case 'boolean':
        case 'integer':
        case 'string':
        case 'list':
            return name;
        default:
            throw new Error(`Unknown argument type "${name}"`);
    }
}
export const stringArg = argTypeName('string');
export const booleanArg = argTypeName('boolean');
export const integerArg = argTypeName('integer');
export const listArg = argTypeName('list');
export class Parser {
    /**
     * Errors from normalizing option definitions. These don't get cleared when
     * re-parsing the command line.
     */
    normalizationErrors = null;
    /**
     * All errors, including errors in the option definition AND the command line.
     * These get cleared when re-parsing the command line, and set to `null` if
     * there are no `normalizationErrors` or copied from `normalizationErrors` if
     * there are.
     */
    errorValues = null;
    /**
     * If the command line has ever been parsed, this will be true.
     */
    isParsed = false;
    /**
     * If new options have been added since the last time the command line was
     * parsed, this will be true.
     */
    hasNewOptions = true;
    /**
     * These are the options that have been added to the parser. Note that these
     * map option names to an array of `OptionsDef` because it is possible to
     * override an option. Only the first option in the array (last added) will
     * be used for parsing the command line, but all the handlers and validators
     * will be called in order for each option, unlesss one of the handlers or
     * validators returns a `stop` value of `true`.
     */
    options = {};
    optionSequence = [];
    parserOptions = {
        argv: process.argv.slice(2),
        env: process.env,
        falsey: FALSEY_STRINGS,
        truthy: TRUTHY_STRINGS
    };
    /**
     * These are the values from the command line before they've been handled
     * or validated but after they've been normalized to their type.
     */
    normalizedValues = null;
    /**
     * These are the values as parsed. It will be empty until the command line
     * has been parsed for the first time.
     */
    values = {};
    constructor(parserOptions, ...optionsDef) {
        this.parserOptions = Object.assign(this.parserOptions, parserOptions);
        this.addOptions(...optionsDef);
    }
    get args() {
        return this.values;
    }
    /**
     * Get the values of the options before they have been handled or validated.
     * Should only be used for debugging handlers and validators.
     */
    get rawNormalizedValues() {
        return this.normalizedValues;
    }
    get errors() {
        return this.errorValues;
    }
    /**
     * Add an option to the options set.
     * @param option The option to add.
     * @param reparseIfNecessary normally, if the command line has already been
     *  parsed, this method will reparse it to ensure it is up to date. Set this
     *  to `false` to prevent that. Generally this should only be used internally
     *  or when adding many options separately.
     */
    addOption(option, reparseIfNecessary = true) {
        this.options[option.name] ||= [];
        this.options[option.name].push(...this.normalizeOptionDef(option));
        this.optionSequence.push(option.name);
        this.hasNewOptions = true;
        if (reparseIfNecessary) {
            this.reparseIfNecessary();
        }
    }
    /**
     * Adds one or more options to the options set. Can accept any number of
     * arguments, each of which can be a single `OptionsDef` or an array of
     * `OptionsDef`.
     * @param optionDefSet
     */
    addOptions(...optionDefSet) {
        for (const ods of optionDefSet) {
            if (Array.isArray(ods)) {
                for (const od of ods) {
                    this.addOption(od, false);
                }
            }
            else {
                this.addOption(ods, false);
            }
        }
        this.reparseIfNecessary();
    }
    /**
     * Check the options for errors. This is to check how options work with each
     * other, not for errors with individual options.
     */
    checkOptions() {
        // duplicate positional arguments
        let positionalCount = Object.keys(this.options).filter(oa => {
            if (this.options[oa]?.length > 0) {
                return this.options[oa][0].arg === 'positional';
            }
        }).length;
        if (positionalCount > 1) {
            this.errorValues ||= {};
            this.errorValues['_positional'] =
                'Cannot have more than one positional argument.';
        }
        // duplicate double-dash arguments
        let doubleDashCount = Object.keys(this.options).filter(oa => {
            if (this.options[oa]?.length > 0) {
                return this.options[oa][0].arg === '--';
            }
        }).length;
        if (doubleDashCount > 1) {
            this.errorValues ||= {};
            this.errorValues['_double_dash'] =
                'Cannot have more than one \'--\' argument.';
        }
    }
    freezeValues() {
        for (const key of Object.keys(this.values)) {
            if (typeof this.values[key] === 'object') {
                Object.freeze(this.values[key]);
            }
        }
        Object.freeze(this.values);
        Object.freeze(this.errorValues);
    }
    handleOptionValues() {
        const optionsSeen = new Set();
        if (!this.normalizedValues) {
            // just a typeguard -- should be impossible
            throw new Error('Cannot handle option values before normalizing.');
        }
        for (const optionName of this.optionSequence) {
            if (optionsSeen.has(optionName)) {
                continue;
            }
            else {
                optionsSeen.add(optionName);
            }
            handlerSequence: for (const optionDef of this.options[optionName].concat(this.normalizeOptionDef({ name: optionName,
                handler: [
                    (value, name) => ({ value, next: false })
                ]
            }))) {
                if (optionDef.handler) {
                    const handlers = (Array.isArray(optionDef.handler)
                        ? optionDef.handler
                        : [optionDef.handler]);
                    let lastResult = this.normalizedValues[optionDef.name];
                    for (const handler of handlers) {
                        const handlerReturn = handler(lastResult, optionDef.name, this.normalizedValues);
                        if (handlerReturn === next) {
                            continue;
                        }
                        else if (isSymbolObject(handlerReturn)) {
                            this.errorValues ||= {};
                            this.errorValues[optionDef.name] =
                                `Unknown handler return symbol for option "${optionDef.name}": ${handlerReturn.toString()}`;
                            break handlerSequence;
                        }
                        else {
                            lastResult = handlerReturn.value;
                            if (!handlerReturn.next) {
                                this.values[optionDef.name] = lastResult;
                                break handlerSequence;
                            }
                        }
                    }
                }
            }
        }
    }
    hasError(optionName) {
        return !!(this.errorValues && Object.hasOwn(this.errorValues, optionName));
    }
    hasErrors() {
        return !!(this.errorValues && Object.keys(this.errorValues).length > 0);
    }
    normalizeOptionDef(def) {
        if (Array.isArray(def)) {
            return def.map(d => this.normalizeOptionDef(d)).flat();
        }
        else {
            const err = (msg) => {
                this.normalizationErrors ||= {};
                this.normalizationErrors[def.name || '_no_name'] = msg;
            };
            // some checks.
            if (!def.name) {
                err('Option definition must have a name.');
            }
            if (typeof def.arg === 'string') {
                if (def.arg !== 'positional' && def.arg !== '--') {
                    err('Option definition must have a valid argument.');
                }
            }
            if (def.required && def.default) {
                err('Required option cannot have a default.');
            }
            if (def.arg === 'positional' && def.env) {
                err('Positional arguments cannot have an environment variable.');
            }
            const argType = argTypeName(def.type || (typeof def.arg === 'string' &&
                [`--`, `positional`].includes(def.arg) ? listArg : stringArg));
            // more checks.
            if (def.arg === 'positional' && argType !== listArg) {
                err('Positional arguments must be lists.');
            }
            if (def.arg === '--' && def.env) {
                err('Double-dash arguments cannot have an environment variable.');
            }
            if (def.arg === '--' && argType !== listArg) {
                err('Double-dash arguments must be lists.');
            }
            // ensure default values are the right type. Default values should always
            // be valid on the command line.
            if (def.default) {
                switch (def.type) {
                    case 'boolean':
                        if (def.default && typeof def.default !== 'boolean') {
                            if (typeof def.default === 'string' &&
                                !(this.parserOptions.truthy.includes(def.default) ||
                                    this.parserOptions.falsey.includes(def.default))) {
                                err('Boolean options must have a boolean default.');
                            }
                        }
                        break;
                    case 'integer':
                        if (def.default && typeof def.default !== 'number') {
                            if (typeof def.default === 'string' &&
                                !Number.parseInt(def.default)) {
                                err('Integer options must have a number default.');
                            }
                        }
                        break;
                    case 'list':
                        if (def.default) {
                            if (typeof def.default === 'string') {
                                def.default = [def.default];
                            }
                            else if (Array.isArray(def.default)) {
                                if (!def.default.every(e => typeof e === 'string')) {
                                    err('List options default array members must all be string');
                                }
                            }
                            else {
                                err('List options must have a string or a string array default.');
                            }
                        }
                        break;
                    case 'string':
                        if (def.default && typeof def.default !== 'string') {
                            err('String options must have a string default.');
                        }
                        break;
                }
            }
            return [Object.assign({
                    arg: [],
                    default: undefined,
                    description: undefined,
                    env: [],
                    handler: [],
                    required: false,
                    silent: false,
                    type: argType,
                    validator: []
                }, def)];
        }
    }
    /**
     * Get the value of the options before they have been normalized or validated.
     */
    normalizeOptionValues() {
        this.normalizedValues = {};
        let argIdx = 0;
        // first scan the command line arguments
        if (this.parserOptions.argv?.length) {
            for (; argIdx < this.parserOptions.argv?.length; argIdx++) {
                const arg = this.parserOptions.argv[argIdx];
                if (arg === '--') {
                    argIdx++;
                    break;
                }
                let argSwitch = arg.replace(/=.*/, '');
                let foundOption = false;
                for (const optionName of Object.keys(this.options)) {
                    if (this.options[optionName]?.length &&
                        this.options[optionName][0].arg?.includes(argSwitch)) {
                        foundOption = true;
                        const optionDef = this.options[optionName][0];
                        let value = (arg === argSwitch
                            ? (optionDef.type === 'boolean'
                                ? true
                                : this.parserOptions.argv[++argIdx])
                            : arg.replace(/.*=/, ''));
                        if (optionDef.type === 'list') {
                            if (this.normalizedValues[optionName]) {
                                this.normalizedValues[optionName]
                                    .push(value);
                            }
                            else {
                                this.normalizedValues[optionName] = [value];
                            }
                        }
                        else {
                            this.normalizedValues[optionName] = value;
                        }
                    }
                }
                if (!foundOption) {
                    // find the positional parameter
                    const positionalOption = Object.keys(this.options).find(k => {
                        const o = this.options[k][0];
                        return (o.arg === 'positional');
                    });
                    if (positionalOption) {
                        this.normalizedValues[positionalOption] ||= [];
                        this.normalizedValues[positionalOption].push(arg);
                    }
                    else {
                        this.errorValues ||= {};
                        this.errorValues[argSwitch] =
                            `Unknown command line option "${argSwitch}"`;
                    }
                }
            }
            // now check for missing positional arguments
            const option = Object.keys(this.options).find(k => {
                const o = this.options[k][0];
                return (o.arg === '--');
            }) || Object.keys(this.options).find(k => {
                const o = this.options[k][0];
                return (o.arg === 'positional');
            });
            if (option) {
                for (; argIdx < this.parserOptions.argv?.length; argIdx++) {
                    const arg = this.parserOptions.argv[argIdx];
                    this.normalizedValues[option] ||= [];
                    this.normalizedValues[option].push(arg);
                }
            }
        }
        // then scan the environment variables
        for (const optionDefKey of Object.keys(this.options)) {
            const optionDefAr = this.options[optionDefKey];
            if (optionDefAr.length < 1) {
                // this should be impossible, and if it happens, we can ignore it.
                continue;
            }
            const optionDef = optionDefAr[0];
            if (Object.hasOwn(this.normalizedValues, optionDefKey)) {
                // this option has already been found in the command line
                continue;
            }
            let foundInEnv = false;
            if (this.parserOptions.env) {
                if (optionDef.env &&
                    Object.hasOwn(this.parserOptions.env, optionDef.env)) {
                    let value = this.parserOptions.env[optionDef.env];
                    if (optionDef.type === 'list') {
                        this.normalizedValues[optionDef.name] = [value];
                    }
                    else {
                        this.normalizedValues[optionDef.name] = value;
                    }
                    foundInEnv = true;
                }
            }
            // check for default value
            if (!foundInEnv && optionDef.default) {
                this.normalizedValues[optionDef.name] = optionDef.default;
            }
            // check required argument
            if (!foundInEnv && optionDef.required) {
                this.errorValues ||= {};
                let errorString = 'Missing required argument in ';
                if (optionDef.arg) {
                    errorString += `command line ${Array.isArray(optionDef.arg)
                        ? optionDef.arg.map(o => '`' + o + '`').join(', ')
                        : optionDef.arg}${optionDef.env ? ' or ' : ''}`;
                }
                if (optionDef.env) {
                    errorString += `environment variable ${optionDef.env}`;
                }
                errorString += '.';
                this.errorValues[optionDef.name] = errorString;
            }
        }
        // now that we have all the values, we can normalize them to type.
        for (const optionDefKey of Object.keys(this.normalizedValues)) {
            const optionDefAr = this.options[optionDefKey];
            if (optionDefAr.length < 1) {
                // this should be impossible, and if it happens, we can ignore it.
                continue;
            }
            const optionDef = optionDefAr[0];
            let value = this.normalizedValues[optionDefKey];
            let isError = false;
            switch (optionDef.type) {
                case 'boolean':
                    if (typeof value === 'string') {
                        let lc = value.toLocaleLowerCase();
                        if (this.parserOptions.truthy.includes(lc)) {
                            value = true;
                        }
                        else if (this.parserOptions.falsey.includes(lc)) {
                            value = false;
                        }
                        else {
                            this.errorValues ||= {};
                            this.errorValues[optionDefKey] =
                                `Could not parse boolean argument "${optionDefKey}" value "${value}"`;
                            isError = true;
                        }
                    }
                    break;
                case 'integer':
                    try {
                        value = Number.parseInt(value);
                        if (Number.isNaN(value)) {
                            throw new Error('NaN');
                        }
                    }
                    catch (e) {
                        this.errorValues ||= {};
                        this.errorValues[optionDefKey] =
                            `Could not parse integer argument "${optionDefKey}" value "${value}"`;
                        isError = true;
                    }
                    break;
                case 'list':
                case 'string':
                    break;
                default:
                    // should be impossible
                    this.errorValues ||= {};
                    this.errorValues[optionDefKey] =
                        `Unknown type "${optionDef.type}" for argument "${optionDefKey}"`;
                    isError = true;
            }
            if (!isError) {
                this.normalizedValues[optionDefKey] = value;
            }
        }
        if (this.errorValues && Object.keys(this.errorValues).length > 0) {
            this.normalizedValues = null;
        }
    }
    parse() {
        // reset errorValues and values
        this.errorValues = this.normalizationErrors !== null
            ? { ...this.normalizationErrors }
            : null;
        this.values = {};
        this.checkOptions();
        this.normalizeOptionValues();
        if (this.normalizedValues) {
            this.validateOptionValues();
            if (!this.hasErrors()) {
                this.handleOptionValues();
            }
        }
        else {
            this.values = {};
        }
        this.freezeValues();
        this.hasNewOptions = false;
        return !this.hasErrors();
    }
    /**
     * Reparse the command line if it has already been parsed.
     */
    reparseIfNecessary() {
        if (this.isParsed && this.hasNewOptions) {
            this.parse();
        }
    }
    validateOptionValues() {
        const optionsSeen = new Set();
        if (!this.normalizedValues) {
            // just a typeguard -- should be impossible
            throw new Error('Cannot validate option values before normalizing.');
        }
        validationSequence: for (const optionName of this.optionSequence) {
            if (optionsSeen.has(optionName)) {
                continue;
            }
            else {
                optionsSeen.add(optionName);
            }
            if (this.hasError(optionName)) {
                // there's already been an error in this option, no neeed to validate
                // it.
                continue;
            }
            for (const optionDef of this.options[optionName]) {
                // test required arguments exist
                if (optionDef.required &&
                    ((!Object.hasOwn(this.normalizedValues, optionDef.name)) ||
                        this.normalizedValues[optionDef.name] === null ||
                        this.normalizedValues[optionDef.name] === undefined)) {
                    this.errorValues ||= {};
                    let errorMessage = `Missing required`;
                    if (optionDef.arg) {
                        if (Array.isArray(optionDef.arg)) {
                            switch (optionDef.arg.length) {
                                case 0:
                                    errorMessage += ' argument';
                                    break;
                                case 1:
                                    errorMessage += ` argument "${optionDef.arg[0]}"`;
                                    break;
                                case 2:
                                    errorMessage += ` arguments "${optionDef.arg[0]}" or "${optionDef.arg[1]}"`;
                                    break;
                                default:
                                    errorMessage += ` arguments "${optionDef.arg.slice(0, -1)
                                        .join('", "')}", or "${optionDef.arg.slice(-1)}"`;
                            }
                        }
                        else {
                            errorMessage += ` argument "${optionDef.arg}"`;
                        }
                        if (optionDef.env && optionDef.env.length) {
                            errorMessage += ` or`;
                        }
                    }
                    if (optionDef.env && optionDef.env.length) {
                        errorMessage += ` environment variable "${optionDef.env}"`;
                    }
                    errorMessage += '.';
                    this.errorValues ||= {};
                    this.errorValues[optionDef.name] = errorMessage;
                    continue validationSequence;
                }
                // run validators
                if (optionDef.validator) {
                    const validators = Array.isArray(optionDef.validator)
                        ? optionDef.validator
                        : [optionDef.validator];
                    let lastResult = next;
                    for (const validator of validators) {
                        lastResult = validator(this.normalizedValues[optionDef.name], optionDef.name, this.normalizedValues);
                        if (lastResult !== next) {
                            if (typeof lastResult === 'string') {
                                this.errorValues ||= {};
                                this.errorValues[optionDef.name] = lastResult;
                            }
                            break validationSequence;
                        }
                    }
                }
            }
        }
    }
}
/**
 * Parse the command line arguments and return the results. Throws if there are
 * any errors at all.
 * @param parserOptions
 * @param optionsDef
 * @returns
 */
export function parse(parserOptions, ...optionsDef) {
    const parser = new Parser(parserOptions);
    parser.addOptions(...optionsDef);
    if (!parser.parse()) {
        throw new Error('Could not parse command line.', { cause: parser.errors });
    }
    else {
        return parser.args;
    }
}
export default Parser;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7QUFFYixPQUFPLGdDQUFnQyxDQUFDO0FBRXhDLE9BQU8sT0FBTyxNQUFNLGNBQWMsQ0FBQztBQUNuQyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFakQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFZO0lBQ3JDLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVO0lBQ3BDLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLGNBQWM7SUFDaEMsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUk7Q0FBQyxDQUFDLENBQUMsa0JBQWtCO0FBQ3BELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBWTtJQUNyQyxPQUFPLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsVUFBVTtJQUNyQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxjQUFjO0lBQy9CLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLO0NBQUMsQ0FBQyxDQUFDLGtCQUFrQjtBQVE1RCxNQUFNLFVBQVUsYUFBYSxDQUFFLElBQVc7SUFDeEMsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqRSxDQUFDO0FBRUQsTUFBTSxDQUFDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQWlGbkMsTUFBTSxVQUFVLFdBQVcsQ0FBQyxJQUFXO0lBQ3JDLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDZixLQUFLLFNBQVMsQ0FBQztRQUNmLEtBQUssU0FBUyxDQUFDO1FBQ2YsS0FBSyxR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