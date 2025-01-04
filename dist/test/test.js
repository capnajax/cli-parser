'use strict';
import TestBattery from 'test-battery';
import Parser, { booleanArg, integerArg, listArg, next, parse, stringArg } from '../src/parser.js';
import { describe, it } from 'node:test';
/**
 * A common set of options for testing with.
 */
const optionsDef = [{
        name: 'integer',
        arg: ['--int', '--integer', '-i'],
        env: 'INTEGER',
        type: integerArg,
        required: false,
        default: 10
    }, {
        name: 'string',
        arg: ['--string', '-s'],
        env: 'STRING',
        type: stringArg,
    }, {
        name: 'list',
        arg: ['--list'],
        env: 'LIST',
        type: listArg,
    }, {
        name: 'boolean',
        arg: ['--boolean', '-b'],
        type: booleanArg,
    }, {
        name: 'unspecified',
        arg: ['-u'],
        required: false
    }, {
        name: 'required',
        arg: ['--required', '-r'],
        env: 'REQUIRED',
        type: stringArg,
        required: true
    }];
describe('options definition validation', function () {
    it('rejects arguments with no name', function (t, done) {
        let battery = new TestBattery('nameless tests');
        const parser = new Parser({
            argv: ['--required', 'ok'],
            env: {}
        }, optionsDef);
        parser.addOptions({
            arg: ['--badarg']
        });
        const hasError = !parser.parse();
        battery.test('nameless argument produces error')
            .value(hasError).is.true;
        battery.done(done);
    });
    it('rejects invalid argument types', function (t, done) {
        let battery = new TestBattery('invalid argtype tests');
        const parser = new Parser({
            argv: ['--required', 'ok'],
            env: {}
        }, optionsDef);
        try {
            parser.addOptions({
                name: 'badarg',
                arg: ['--badarg'],
                type: 'badtype'
            });
            const hasError = !parser.parse();
            battery.test('bad argument type produces error')
                .value(hasError).is.true;
        }
        catch (e) { }
        battery.done(done);
    });
    it('rejects required arguments with default values', function (t, done) {
        let battery = new TestBattery('required with default tests');
        const parser = new Parser({
            argv: ['--required', 'ok', '--badarg', 'ok ok ok'],
            env: {}
        }, optionsDef);
        parser.addOptions({
            name: 'badarg',
            arg: ['--badarg'],
            required: true,
            default: 'not-ok'
        });
        const hasError = !parser.parse();
        battery.test('required argument with default value produces error')
            .value(hasError).is.true;
        battery.done(done);
    });
    it('rejects if there are more than one `positional` or `--` arguments', function (t, done) {
        let battery = new TestBattery('positional tests');
        let parser = new Parser({
            argv: [
                '--required', 'ok', 'myfile.txt', 'yourfile.txt', 'herfile.txt'
            ],
            env: {}
        }, optionsDef);
        parser.addOptions({
            name: 'positional1',
            arg: 'positional'
        }, {
            name: 'positional2',
            arg: 'positional'
        });
        let hasError = !parser.parse();
        battery.test('double-positional produces error')
            .value(hasError).is.true;
        parser = new Parser({
            argv: ['--required', 'ok', '--', 'yourfile.txt', 'herfile.txt'],
            env: {}
        }, optionsDef);
        parser.addOptions({
            name: 'dd1',
            arg: '--'
        }, {
            name: 'dd2',
            arg: '--'
        });
        hasError = !parser.parse();
        battery.test('double-double-dash produces error')
            .value(hasError).is.true;
        parser = new Parser({
            argv: ['--required', 'ok', '--', 'yourfile.txt', 'herfile.txt'],
            env: {}
        }, optionsDef);
        parser.addOptions({
            name: 'positional1',
            arg: 'positional'
        }, {
            name: 'dd2',
            arg: '--'
        });
        hasError = !parser.parse();
        battery.test('positional with double-dash is accepted')
            .value(hasError).is.false;
        battery.done(done);
    });
    it('rejects defaults of an incorrect type', function (t, done) {
        let battery = new TestBattery('incorrect default type tests');
        const parser = new Parser({
            argv: ['--required', 'ok', '--badarg', 'ok ok ok'],
            env: {}
        }, optionsDef);
        parser.addOptions({
            name: 'badarg',
            arg: ['--badarg'],
            required: true,
            type: integerArg,
            default: 'twelve'
        });
        const hasError = !parser.parse();
        battery.test('default of incorrect type produces error')
            .value(hasError).is.true;
        battery.done(done);
    });
    it.todo('rejects handlers with an incorrect signature');
    it.todo('rejects validators with an incorrect signature');
});
describe('argument normalization exception handling', function () {
    it('unparseable integer', function (t, done) {
        let battery = new TestBattery('unparseable integer tests');
        try {
            const values = parse({
                argv: ['--integer=twelve', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts unparseable integer').fail;
        }
        catch (e) {
        }
        battery.done(done);
    });
    it('unparseable boolean', function (t, done) {
        let battery = new TestBattery('unparseable integer tests');
        try {
            parse({
                argv: ['--boolean=noway', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts unparseable boolean').fail;
        }
        catch (e) {
        }
        battery.done(done);
    });
    it('unknown parameter', function (t, done) {
        let battery = new TestBattery('unparseable integer tests');
        try {
            parse({
                argv: ['--unknown=twelve', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts unknown parameter').fail;
        }
        catch (e) {
        }
        battery.done(done);
    });
});
describe('command line context', function () {
    it('bare booleans without capturing following argument', function (t, done) {
        let battery = new TestBattery('unparseable integer tests');
        try {
            const values = parse({
                argv: ['--boolean', '--string=guava', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts bare boolean')
                .value(values.boolean)
                .is.true;
            battery.test('accepts following argument')
                .value(values.string)
                .value('guava')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts bare boolean successful parse').fail;
        }
        battery.done(done);
    });
    it('double-dash captures all arguments following `--`', function (t, done) {
        let battery = new TestBattery('positional tests');
        try {
            const parser = new Parser({
                argv: ['-s=pineapple', '-r=ok', '--', '--string=afterdd', 'curl'],
                env: {},
            }, optionsDef);
            parser.addOptions([{
                    name: 'doubledash',
                    arg: '--'
                }]);
            const parseOk = parser.parse();
            if (parseOk) {
                battery.test('string is pineapple')
                    .value(parser.args.string)
                    .value('pineapple')
                    .is.strictlyEqual;
                battery.test('doubledash is array')
                    .value(parser.args.doubledash)
                    .is.array;
                battery.test('doubledash value 0')
                    .value(parser.args.doubledash[0])
                    .value('--string=afterdd')
                    .is.strictlyEqual;
                battery.test('doubledash value 1')
                    .value(parser.args.doubledash[1])
                    .value('curl')
                    .is.strictlyEqual;
            }
            else {
                battery.test('double-dash handled').fail;
            }
        }
        catch (e) {
            battery.test('accepts positional - without exception').fail;
        }
        battery.done(done);
    });
});
describe('command line forms', function () {
    it('integer', function (t, done) {
        let battery = new TestBattery('integer tests');
        let values;
        try {
            values = parse({
                argv: ['--integer=12', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts integer - long form')
                .value(values.integer)
                .value(12)
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts integer - long form successful parse').fail;
        }
        try {
            values = parse({
                argv: ['-i', '12', '-r', 'ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts integer - short form')
                .value(values.integer)
                .value(12)
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts integer - short form successful parse').fail;
        }
        values = parse({
            argv: ['-r', 'ok'],
            env: {}
        }, optionsDef);
        battery.test('accepts integer - default value')
            .value(values.integer)
            .value(10)
            .is.strictlyEqual;
        values = parse({
            argv: ['-r', 'ok'],
            env: { INTEGER: '12' }
        }, optionsDef);
        battery.test('integer from environment variable')
            .value(values.integer)
            .value(12)
            .is.strictlyEqual;
        battery.done(done);
    });
    it('string', function (t, done) {
        let battery = new TestBattery('string tests');
        let values;
        try {
            values = parse({
                argv: ['--string=pineapple', '--required=ok'],
                env: {},
            }, optionsDef);
            battery.test('accepts string - long form')
                .value(values.string)
                .value('pineapple')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts string - long form successful parse').fail;
        }
        try {
            values = parse({
                argv: ['-r', 'ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts string - no default value')
                .value(values.string)
                .is.undefined;
        }
        catch (e) {
            battery.test('accepts string - no default value successful parse').fail;
        }
        try {
            values = parse({
                argv: ['-r', 'ok'],
                env: { STRING: 'pineapple' }
            }, optionsDef);
            battery.test('string from environment variable')
                .value(values.string)
                .value('pineapple')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('string from environment variable successful parse').fail;
        }
        battery.done(done);
    });
    it('list', function (t, done) {
        let battery = new TestBattery('list tests');
        let values;
        try {
            values = parse({
                argv: ['--list=pineapple', '--list=orange', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts list - long form array')
                .value(values.list).is.array;
            battery.test('accepts list - long form value 0')
                .value(values.list[0])
                .value('pineapple')
                .is.strictlyEqual;
            battery.test('accepts list - long form value 1')
                .value(values.list[1])
                .value('orange')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts list - long form array successful parse').fail;
        }
        try {
            values = parse({
                argv: ['-r', 'ok'],
                env: { LIST: 'pineapple' }
            }, optionsDef);
            battery.test('list from environment variable')
                .value(values.list).is.array;
            battery.test('list from environment variable value 0')
                .value(values.list[0])
                .value('pineapple')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('list from environment variable successful parse').fail;
        }
        battery.done(done);
    });
    it('boolean', function (t, done) {
        let battery = new TestBattery('string tests');
        let values;
        try {
            values = parse({
                argv: ['--boolean=false', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts boolean - long form')
                .value(values.boolean)
                .is.false;
        }
        catch (e) {
            battery.test('accepts boolean - long form successful parse').fail;
        }
        try {
            values = parse({
                argv: ['--boolean=naw-yeah', '--required=ok'],
                truthy: ['naw-yeah'],
                falsey: ['yeah-naw'],
                env: {}
            }, optionsDef);
            battery.test('accepts boolean - truthy strings')
                .value(values.boolean)
                .is.true;
        }
        catch (e) {
            battery.test('accepts boolean - different truthy string').fail;
        }
        try {
            values = parse({
                argv: ['--boolean=yeah-naw', '--required=ok'],
                truthy: ['naw-yeah'],
                falsey: ['yeah-naw'],
                env: {}
            }, optionsDef);
            battery.test('accepts boolean - falsey strings')
                .value(values.boolean)
                .is.false;
        }
        catch (e) {
            battery.test('accepts boolean - different falsey string').fail;
        }
        try {
            values = parse({
                argv: ['-b', '-r', 'ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts boolean - short form, implied true')
                .value(values.boolean)
                .is.true;
        }
        catch (e) {
            battery.test('accepts boolean - short form, implied true successful parse').fail;
        }
        try {
            values = parse({
                argv: ['-r', 'ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts boolean - no default value')
                .value(values.boolean)
                .is.undefined;
        }
        catch (e) {
            battery.test('accepts boolean - no default value successful parse').fail;
        }
        try {
            values = parse({
                argv: ['--boolean=no', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts boolean - other words for false')
                .value(values.boolean)
                .is.false;
        }
        catch (e) {
            battery.test('accepts boolean - other words for false successful parse').fail;
        }
        try {
            values = parse({
                argv: ['--boolean=yes', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts boolean - other words for true')
                .value(values.boolean)
                .is.true;
        }
        catch (e) {
            battery.test('accepts boolean - other words for true successful parse').fail;
        }
        battery.done(done);
    });
    it('unspecified', function (t, done) {
        let battery = new TestBattery('unspecified tests');
        let values;
        try {
            values = parse({
                argv: ['-u', 'pumpernickle', '--required=ok'],
                env: {}
            }, optionsDef);
            battery.test('accepts unspecified')
                .value(values.unspecified)
                .value('pumpernickle')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts unspecified (default-string) successful parse').fail;
        }
        battery.done(done);
    });
    it('required', function (t, done) {
        let battery = new TestBattery('required tests');
        let values;
        try {
            values = parse({
                argv: [],
                env: {}
            }, optionsDef);
            // this is supposed to fail
            battery.test('accepts required - not provided - has errors successful parse').fail;
        }
        catch (e) {
        }
        const parser = new Parser({ argv: [], env: {} }, optionsDef);
        parser.addOptions({
            name: 'list',
            arg: ['--list-required', '-lr'],
            type: listArg,
            required: true
        });
        parser.parse();
        battery.test('accepts required list -- not provided - has errors')
            .value(parser.errors).is.not.nil;
        battery.test('accepts required list -- not provided - has errors')
            .value(parser.errors?.length).value(0).is.not.equal;
        battery.done(done);
    });
    it('positional arguments', function (t, done) {
        let battery = new TestBattery('positional tests');
        const parser = new Parser({
            argv: ['--required', 'ok', 'myfile.txt', 'yourfile.txt', 'herfile.txt'],
            env: {}
        }, optionsDef);
        parser.addOptions({
            name: 'positional',
            arg: 'positional'
        });
        const hasError = !parser.parse();
        battery.test('positional type has no errors')
            .value(hasError).is.false;
        battery.endIfErrors();
        battery.test('positional type defaults to array')
            .value(parser.args.positional).is.array;
        battery.test('positional param 0')
            .value(parser.args.positional[0])
            .value('myfile.txt').is.strictlyEqual;
        battery.test('positional param 1')
            .value(parser.args.positional[1])
            .value('yourfile.txt').is.strictlyEqual;
        battery.done(done);
    });
});
describe('argument handlers', function () {
    it('handlers that return same type', function (t, done) {
        let battery = new TestBattery('handler tests');
        let values;
        try {
            values = parse({
                argv: ['--string=pineapple'],
                env: {},
            }, [{
                    name: 'string',
                    arg: ['--string'],
                    env: 'STRING',
                    handler: (value) => {
                        if (value !== undefined) {
                            switch (value) {
                                case 'pineapple':
                                    return { value: 'anana', next: false };
                                default:
                                    return { value, next: false };
                            }
                        }
                        else {
                            return next;
                        }
                    },
                    type: stringArg,
                }]);
            battery.test('handler can change value')
                .value(values.string)
                .value('anana')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts string - handler operated successfully').fail;
        }
        battery.done(done);
    });
    it('handlers that return different type', function (t, done) {
        let battery = new TestBattery('handler tests');
        let values;
        try {
            values = parse({
                argv: ['--string=pineapple'],
                env: {},
            }, [{
                    name: 'string',
                    arg: ['--string'],
                    env: 'STRING',
                    handler: (value) => {
                        if (value !== undefined) {
                            switch (value) {
                                case 'pineapple':
                                    return { value: 12, next: false };
                                default:
                                    return { value: 0, next: false };
                            }
                        }
                        else {
                            return next;
                        }
                    },
                    type: stringArg,
                }]);
            battery.test('handler can change value and type')
                .value(values.string)
                .value(12)
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts string - convert to integer - handler operated ' +
                'successfully').fail;
        }
        battery.done(done);
    });
    it('handlers that defer to next handler', function (t, done) {
        let battery = new TestBattery('handler tests');
        let values;
        try {
            values = parse({
                argv: ['--string=pineapple'],
                env: {},
            }, [{
                    name: 'string',
                    arg: ['--string'],
                    env: 'STRING',
                    handler: [(value) => {
                            if (value !== undefined) {
                                switch (value) {
                                    case 'pineapple':
                                        return { value: 'anana', next: true };
                                    default:
                                        return { value: 0, next: false };
                                }
                            }
                            else {
                                return next;
                            }
                        }, (value) => {
                            if (value !== undefined) {
                                switch (value) {
                                    case 'anana':
                                        return { value: '鳳梨', next: false };
                                    default:
                                        return { value: 0, next: false };
                                }
                            }
                            else {
                                return next;
                            }
                        }],
                    type: stringArg,
                }]);
            battery.test('handler can defer to next handler')
                .value(values.string)
                .value('鳳梨')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts string - convert to integer - handler operated ' +
                'successfully').fail;
        }
        battery.done(done);
    });
});
describe('argument validation', () => {
    it('validation', function (t, done) {
        let battery = new TestBattery('handler tests');
        let values;
        try {
            values = parse({
                argv: ['--string=pineapple'],
                env: {},
            }, [{
                    name: 'string',
                    arg: ['--string'],
                    env: 'STRING',
                    validator(value) {
                        const result = ['anana', 'pineapple', '鳳梨'].includes(value)
                            ? null
                            : 'string is not a pineapple';
                        return result;
                    }
                }]);
        }
        catch (e) {
            battery.test('accepts string - accepts pineapple 1').fail;
        }
        try {
            values = parse({
                argv: ['--string=coconut'],
                env: {},
            }, [{
                    name: 'string',
                    arg: ['--string'],
                    env: 'STRING',
                    validator(value) {
                        return ['anana', 'pineapple', '鳳梨'].includes(value)
                            ? null
                            : 'string is not a pineapple';
                    }
                }]);
            battery.test('accepts string - rejects pineapple').fail;
        }
        catch (e) {
        }
        battery.done(done);
    });
    it('validation with handler', function (t, done) {
        let battery = new TestBattery('handler tests');
        let values;
        try {
            values = parse({
                argv: ['--string=pineapple'],
                env: {},
            }, [{
                    name: 'string',
                    arg: ['--string'],
                    env: 'STRING',
                    handler: (value) => {
                        if (value !== undefined) {
                            switch (value) {
                                case 'pineapple':
                                    return { value: 'anana', next: false };
                                default:
                                    return { value, next: false };
                            }
                        }
                        else {
                            return next;
                        }
                    },
                    validator(value) {
                        return ['anana', 'pineapple', '鳳梨'].includes(value)
                            ? null
                            : 'string is not a pineapple';
                    }
                }]);
            battery.test('accepts string and handles it')
                .value(values.string)
                .value('anana')
                .is.strictlyEqual;
        }
        catch (e) {
            battery.test('accepts string - accepts pineapple 2').fail;
        }
        try {
            values = parse({
                argv: ['--string=coconut'],
                env: {},
            }, [{
                    name: 'string',
                    arg: ['--string'],
                    env: 'STRING',
                    handler: (value) => {
                        if (value !== undefined) {
                            switch (value) {
                                case 'pineapple':
                                    return { value: 'anana', next: false };
                                default:
                                    return { value, next: false };
                            }
                        }
                        else {
                            return next;
                        }
                    },
                    validator(value) {
                        return ['anana', 'pineapple', '鳳梨'].includes(value)
                            ? null
                            : 'string is not a pineapple';
                    }
                }]);
            battery.test('accepts string - rejects pineapple').fail;
        }
        catch (e) {
        }
        battery.done(done);
    });
    it('validation of positional arguments', function (t, done) {
        let battery = new TestBattery('positional tests');
        try {
            const parser = new Parser({
                argv: ['anana', 'pamplemousse', 'pomme', '-l=boeuf', '-l=poulet'],
                env: {},
            });
            parser.addOptions([{
                    name: 'positional',
                    arg: 'positional',
                    validator(value) {
                        return ['anana', 'pineapple', '鳳梨'].includes(value[0])
                            ? null
                            : 'positional is not a pineapple';
                    }
                }, {
                    name: 'list',
                    arg: ['--list', '-l'],
                    type: listArg
                }]);
            const parseOk = parser.parse();
            if (parseOk) {
                battery.test('accepts positional is array')
                    .value(parser.args.positional)
                    .is.array;
                battery.test('accepts positional - first positional is pineapple')
                    .value(parser.args.positional[0])
                    .value('anana')
                    .is.strictlyEqual;
            }
            else {
                battery.test('accepts positional - accepts pineapple').fail;
            }
        }
        catch (e) {
            battery.test('accepts positional - without exception').fail;
        }
        battery.done(done);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3Rlc3QvdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7QUFFYixPQUFPLFdBQVcsTUFBTSxjQUFjLENBQUM7QUFDdkMsT0FBTyxNQUFNLEVBQUUsRUFFYixVQUFVLEVBQ1YsVUFBVSxFQUNWLE9BQU8sRUFDUCxJQUFJLEVBRUosS0FBSyxFQUNMLFNBQVMsRUFDVixNQUFNLGtCQUFrQixDQUFDO0FBQzFCLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXpDOztHQUVHO0FBQ0gsTUFBTSxVQUFVLEdBQUcsQ0FBQztRQUNsQixJQUFJLEVBQUUsU0FBUztRQUNmLEdBQUcsRUFBRSxDQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFFO1FBQ25DLEdBQUcsRUFBRSxTQUFTO1FBQ2QsSUFBSSxFQUFFLFVBQVU7UUFDaEIsUUFBUSxFQUFFLEtBQUs7UUFDZixPQUFPLEVBQUUsRUFBRTtLQUNaLEVBQUU7UUFDRCxJQUFJLEVBQUUsUUFBUTtRQUNkLEdBQUcsRUFBRSxDQUFFLFVBQVUsRUFBRSxJQUFJLENBQUU7UUFDekIsR0FBRyxFQUFFLFFBQVE7UUFDYixJQUFJLEVBQUUsU0FBUztLQUNoQixFQUFFO1FBQ0QsSUFBSSxFQUFFLE1BQU07UUFDWixHQUFHLEVBQUUsQ0FBRSxRQUFRLENBQUU7UUFDakIsR0FBRyxFQUFFLE1BQU07UUFDWCxJQUFJLEVBQUUsT0FBTztLQUNkLEVBQUU7UUFDRCxJQUFJLEVBQUUsU0FBUztRQUNmLEdBQUcsRUFBRSxDQUFFLFdBQVcsRUFBRSxJQUFJLENBQUU7UUFDMUIsSUFBSSxFQUFFLFVBQVU7S0FDakIsRUFBRTtRQUNELElBQUksRUFBRSxhQUFhO1FBQ25CLEdBQUcsRUFBRSxDQUFFLElBQUksQ0FBRTtRQUNiLFFBQVEsRUFBRSxLQUFLO0tBQ2hCLEVBQUU7UUFDRCxJQUFJLEVB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