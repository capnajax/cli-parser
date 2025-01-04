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
        global: 'argv',
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
        // first scan the command line arguments
        if (this.parserOptions.argv?.length) {
            for (let argIdx = 0; argIdx < this.parserOptions.argv?.length; argIdx++) {
                const arg = this.parserOptions.argv[argIdx];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3BhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7QUFFYixPQUFPLGdDQUFnQyxDQUFDO0FBRXhDLE9BQU8sT0FBTyxNQUFNLGNBQWMsQ0FBQztBQUNuQyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFakQsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFZO0lBQ3JDLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVO0lBQ3BDLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLGNBQWM7SUFDaEMsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUk7Q0FBQyxDQUFDLENBQUMsa0JBQWtCO0FBQ3BELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBWTtJQUNyQyxPQUFPLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsVUFBVTtJQUNyQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxjQUFjO0lBQy9CLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLO0NBQUMsQ0FBQyxDQUFDLGtCQUFrQjtBQVE1RCxNQUFNLFVBQVUsYUFBYSxDQUFFLElBQVc7SUFDeEMsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNqRSxDQUFDO0FBRUQsTUFBTSxDQUFDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQWtGbkMsTUFBTSxVQUFVLFdBQVcsQ0FBQyxJQUFXO0lBQ3JDLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDZixLQUFLLFNBQVMsQ0FBQztRQUNmLEtBQUssU0FBUyxDQUFDO1FBQ2YsS0FBSyxR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