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
        arg: ['--string'],
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
            console.log('values:', values);
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
    it.todo('bare booleans without capturing following argument');
    it.todo('bare arguments must be detected');
    it.todo('double-dash captures all arguments following `--`');
    it.todo('double-dash with post-options captures all arguments as such');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3Rlc3QvdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7QUFFYixPQUFPLFdBQVcsTUFBTSxjQUFjLENBQUM7QUFDdkMsT0FBTyxNQUFNLEVBQUUsRUFFYixVQUFVLEVBQ1YsVUFBVSxFQUNWLE9BQU8sRUFDUCxJQUFJLEVBRUosS0FBSyxFQUNMLFNBQVMsRUFDVixNQUFNLGtCQUFrQixDQUFDO0FBQzFCLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXpDOztHQUVHO0FBQ0gsTUFBTSxVQUFVLEdBQUcsQ0FBQztRQUNsQixJQUFJLEVBQUUsU0FBUztRQUNmLEdBQUcsRUFBRSxDQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFFO1FBQ25DLEdBQUcsRUFBRSxTQUFTO1FBQ2QsSUFBSSxFQUFFLFVBQVU7UUFDaEIsUUFBUSxFQUFFLEtBQUs7UUFDZixPQUFPLEVBQUUsRUFBRTtLQUNaLEVBQUU7UUFDRCxJQUFJLEVBQUUsUUFBUTtRQUNkLEdBQUcsRUFBRSxDQUFFLFVBQVUsQ0FBRTtRQUNuQixHQUFHLEVBQUUsUUFBUTtRQUNiLElBQUksRUFBRSxTQUFTO0tBQ2hCLEVBQUU7UUFDRCxJQUFJLEVBQUUsTUFBTTtRQUNaLEdBQUcsRUFBRSxDQUFFLFFBQVEsQ0FBRTtRQUNqQixHQUFHLEVBQUUsTUFBTTtRQUNYLElBQUksRUFBRSxPQUFPO0tBQ2QsRUFBRTtRQUNELElBQUksRUFBRSxTQUFTO1FBQ2YsR0FBRyxFQUFFLENBQUUsV0FBVyxFQUFFLElBQUksQ0FBRTtRQUMxQixJQUFJLEVBQUUsVUFBVTtLQUNqQixFQUFFO1FBQ0QsSUFBSSxFQUFFLGFBQWE7UUFDbkIsR0FBRyxFQUFFLENBQUUsSUFBSSxDQUFFO1FBQ2IsUUFBUSxFQUFFLEtBQUs7S0FDaEIsRUFBRTtRQUNELElBQUksRUFBRSxVQUFVO1FB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