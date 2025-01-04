'use strict';

import TestBattery from 'test-battery';
import Parser, {
  ArgType,
  booleanArg,
  integerArg,
  listArg,
  next,
  OptionsDef,
  parse,
  stringArg
} from '../src/parser.js';
import { describe, it } from 'node:test';

/**
 * A common set of options for testing with.
 */
const optionsDef = [{
  name: 'integer',
  arg: [ '--int', '--integer', '-i' ],
  env: 'INTEGER',
  type: integerArg,
  required: false,
  default: 10
}, {
  name: 'string',
  arg: [ '--string', '-s' ],
  env: 'STRING',
  type: stringArg,
}, {
  name: 'list',
  arg: [ '--list' ],
  env: 'LIST',
  type: listArg,
}, {
  name: 'boolean',
  arg: [ '--boolean', '-b' ],
  type: booleanArg,
}, {
  name: 'unspecified',
  arg: [ '-u' ],
  required: false
}, {
  name: 'required',
  arg: [ '--required', '-r' ],
  env: 'REQUIRED',
  type: stringArg,
  required: true
}];

describe('options definition validation', function() {
  it('rejects arguments with no name', function(t, done) {
    let battery = new TestBattery('nameless tests');

    const parser = new Parser({
      argv: [ '--required', 'ok' ],
      env: {}
    }, optionsDef);
    parser.addOptions({
      arg: ['--badarg']
    } as unknown as OptionsDef);
    const hasError = !parser.parse();
    battery.test('nameless argument produces error')
      .value(hasError).is.true;

    battery.done(done);
  });

  it('rejects invalid argument types', function(t, done) {
    let battery = new TestBattery('invalid argtype tests');

    const parser = new Parser({
      argv: [ '--required', 'ok' ],
      env: {}
    }, optionsDef);
    try {
      parser.addOptions({
        name: 'badarg',
        arg: ['--badarg'],
        type: 'badtype'
      } as unknown as OptionsDef);
      const hasError = !parser.parse();
      battery.test('bad argument type produces error')
        .value(hasError).is.true;
    } catch (e) {}

    battery.done(done);
  });

  it('rejects required arguments with default values', function(t, done) {
    let battery = new TestBattery('required with default tests');

    const parser = new Parser({
      argv: [ '--required', 'ok', '--badarg', 'ok ok ok' ],
      env: {}
    }, optionsDef);
    parser.addOptions({
      name: 'badarg',
      arg: ['--badarg'],
      required: true,
      default: 'not-ok'
    } as unknown as OptionsDef);
    const hasError = !parser.parse();
    battery.test('required argument with default value produces error')
      .value(hasError).is.true;

    battery.done(done);
  });

  it(
    'rejects if there are more than one `positional` or `--` arguments',
    function(t, done) {
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
      },{
        name: 'positional2',
        arg: 'positional'
      });
      let hasError = !parser.parse();
      battery.test('double-positional produces error')
        .value(hasError).is.true;

      parser = new Parser({
        argv: [ '--required', 'ok', '--', 'yourfile.txt', 'herfile.txt' ],
        env: {}
      }, optionsDef);
      parser.addOptions({
        name: 'dd1',
        arg: '--'
      },{
        name: 'dd2',
        arg: '--'
      });
      hasError = !parser.parse();
      battery.test('double-double-dash produces error')
        .value(hasError).is.true;

      parser = new Parser({
        argv: [ '--required', 'ok', '--', 'yourfile.txt', 'herfile.txt' ],
        env: {}
      }, optionsDef);
      parser.addOptions({
        name: 'positional1',
        arg: 'positional'
      },{
        name: 'dd2',
        arg: '--'
      });
      hasError = !parser.parse();
      battery.test('positional with double-dash is accepted')
        .value(hasError).is.false;

      battery.done(done);
    }
  );

  it('rejects defaults of an incorrect type', function(t, done) {
    let battery = new TestBattery('incorrect default type tests');

    const parser = new Parser({
      argv: [ '--required', 'ok', '--badarg', 'ok ok ok' ],
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

describe('argument normalization exception handling', function() {
  it('unparseable integer', function(t, done) {
    let battery = new TestBattery('unparseable integer tests');

    try {
      const values = parse({
        argv: ['--integer=twelve', '--required=ok'],
        env: {}
      }, optionsDef);
      battery.test('accepts unparseable integer').fail;

    } catch (e) {
    }

    battery.done(done);
  });

  it('unparseable boolean', function(t, done) {
    let battery = new TestBattery('unparseable integer tests');

    try {
      parse({
        argv: ['--boolean=noway', '--required=ok'],
        env: {}
      }, optionsDef);
      battery.test('accepts unparseable boolean').fail;
    } catch (e) {
    }

    battery.done(done);
  });

  it('unknown parameter', function(t, done) {
    let battery = new TestBattery('unparseable integer tests');

    try {
      parse({
        argv: ['--unknown=twelve', '--required=ok'],
        env: {}
      }, optionsDef);
      battery.test('accepts unknown parameter').fail;
    } catch (e) {
    }

    battery.done(done);
  });
});

describe('command line context', function() {
  it('bare booleans without capturing following argument', function(t, done) {
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
    } catch (e) {
      battery.test('accepts bare boolean successful parse').fail;
    }

    battery.done(done);
  });

  it('double-dash captures all arguments following `--`', function(t, done) {
    let battery = new TestBattery('positional tests');

    try {
      const parser = new Parser({
        argv: [ '-s=pineapple', '-r=ok', '--', '--string=afterdd', 'curl' ],
        env: {},
      }, optionsDef);
      parser.addOptions([{
        name: 'doubledash',
        arg: '--'}]);
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
          .value((parser.args.doubledash as string[])[0])
          .value('--string=afterdd')
          .is.strictlyEqual;
        battery.test('doubledash value 1')
          .value((parser.args.doubledash as string[])[1])
          .value('curl')
          .is.strictlyEqual;

      } else {
        battery.test('double-dash handled').fail;
      }
    } catch (e) {
      battery.test('accepts positional - without exception').fail;
    }

    battery.done(done);
  });
});

describe('command line forms', function() {

  it('integer', function(t, done) {
    let battery = new TestBattery('integer tests');

    let values;
    try {
      values = parse({
      argv: ['--integer=12', '--required=ok'],
      env: {}}, optionsDef);
    battery.test('accepts integer - long form')
      .value(values.integer)
      .value(12)
      .is.strictlyEqual;
    } catch (e) {
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
        .is.strictlyEqual
    } catch (e) {
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
      env: {INTEGER: '12'}
    }, optionsDef);
    battery.test('integer from environment variable')
      .value(values.integer)
      .value(12)
      .is.strictlyEqual;

    battery.done(done);

  });

  it('string', function(t, done) {
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
    } catch (e) {
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
    } catch (e) {
      battery.test('accepts string - no default value successful parse').fail;
    }

    try {
      values = parse({
        argv: ['-r', 'ok'],
        env: {STRING: 'pineapple'}
      }, optionsDef);
      battery.test('string from environment variable')
        .value(values.string)
        .value('pineapple')
        .is.strictlyEqual;
    } catch (e) {
      battery.test('string from environment variable successful parse').fail;
    }

    battery.done(done);

  });

  it('list', function(t, done) {
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
        .value((values.list as string[])[0])
        .value('pineapple')
        .is.strictlyEqual;
      battery.test('accepts list - long form value 1')
        .value((values.list as string[])[1])
        .value('orange')
        .is.strictlyEqual;
    } catch (e) {
      battery.test('accepts list - long form array successful parse').fail;
    }


    try {
      values = parse({
        argv: ['-r', 'ok'],
        env: {LIST: 'pineapple'}
      }, optionsDef);

      battery.test('list from environment variable')
        .value(values.list).is.array;
      battery.test('list from environment variable value 0')
        .value((values.list as string[])[0])
        .value('pineapple')
        .is.strictlyEqual;
    } catch (e) {
      battery.test('list from environment variable successful parse').fail;
    }

    battery.done(done);

  });

  it('boolean', function(t, done) {
    let battery = new TestBattery('string tests');
    let values;

    try {
      values = parse({
        argv: ['--boolean=false', '--required=ok'],
        env: {}}, optionsDef);
      battery.test('accepts boolean - long form')
        .value(values.boolean)
        .is.false;
    } catch (e) {
      battery.test('accepts boolean - long form successful parse').fail;
    }

    try {
      values = parse({
        argv: ['--boolean=naw-yeah', '--required=ok'],
        truthy: [ 'naw-yeah' ],
        falsey: [ 'yeah-naw' ],
        env: {}}, optionsDef);
      battery.test('accepts boolean - truthy strings')
        .value(values.boolean)
        .is.true;
    } catch (e) {
      battery.test('accepts boolean - different truthy string').fail;
    }

    try {
      values = parse({
        argv: ['--boolean=yeah-naw', '--required=ok'],
        truthy: [ 'naw-yeah' ],
        falsey: [ 'yeah-naw' ],
        env: {}}, optionsDef);
      battery.test('accepts boolean - falsey strings')
        .value(values.boolean)
        .is.false;
    } catch (e) {
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
    } catch (e) {
      battery.test(
        'accepts boolean - short form, implied true successful parse'
      ).fail;
    }

    try {
      values = parse({
        argv: ['-r', 'ok'],
        env: {}
      }, optionsDef);
      battery.test('accepts boolean - no default value')
        .value(values.boolean)
        .is.undefined;
    } catch (e) {
      battery.test('accepts boolean - no default value successful parse').fail;
    }

    try {
      values = parse({
        argv: ['--boolean=no', '--required=ok'],
        env: {}}, optionsDef);
      battery.test('accepts boolean - other words for false')
        .value(values.boolean)
        .is.false;
    } catch (e) {
      battery.test(
        'accepts boolean - other words for false successful parse'
      ).fail;
    }

    try {
      values = parse({
        argv: ['--boolean=yes', '--required=ok'],
        env: {}}, optionsDef);
      battery.test('accepts boolean - other words for true')
        .value(values.boolean)
        .is.true;
    } catch (e) {
      battery.test(
        'accepts boolean - other words for true successful parse'
      ).fail;
    }

    battery.done(done);
  });

  it('unspecified', function(t, done) {
    let battery = new TestBattery('unspecified tests');
    let values;

    try {
      values = parse({
        argv: ['-u', 'pumpernickle', '--required=ok'],
        env: {}}, optionsDef);
      battery.test('accepts unspecified')
        .value(values.unspecified)
        .value('pumpernickle')
        .is.strictlyEqual;
    } catch (e) {
      battery.test(
        'accepts unspecified (default-string) successful parse'
      ).fail;
    }

    battery.done(done);
  });

  it('required', function(t, done) {
    let battery = new TestBattery('required tests');
    let values;

    try {
      values = parse({
        argv: [],
        env: {}}, optionsDef);
      // this is supposed to fail
      battery.test(
        'accepts required - not provided - has errors successful parse'
      ).fail;
    } catch (e) {
    }

    const parser = new Parser({argv:[], env:{}}, optionsDef);
    parser.addOptions({
      name: 'list',
      arg: [ '--list-required', '-lr' ],
      type: listArg,
      required: true
    })
    parser.parse();
    battery.test('accepts required list -- not provided - has errors')
      .value(parser.errors).is.not.nil;
    battery.test('accepts required list -- not provided - has errors')
      .value(parser.errors?.length).value(0).is.not.equal;

    battery.done(done);
  });

  it('positional arguments', function(t, done) {
    let battery = new TestBattery('positional tests');

    const parser = new Parser({
      argv: [ '--required', 'ok', 'myfile.txt', 'yourfile.txt', 'herfile.txt' ],
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
      .value((parser.args.positional as string[])[0])
      .value('myfile.txt').is.strictlyEqual;
    battery.test('positional param 1')
      .value((parser.args.positional as string[])[1])
      .value('yourfile.txt').is.strictlyEqual;

    battery.done(done);
  });

});

describe('argument handlers', function() {

  it('handlers that return same type', function(t, done) {
    let battery = new TestBattery('handler tests');
    let values;
    try {
      values = parse({
        argv: ['--string=pineapple' ],
        env: {},
      }, [{
        name: 'string',
        arg: [ '--string' ],
        env: 'STRING',
        handler: (value: ArgType|undefined) => {
          if (value !== undefined) {
            switch(value as string) {
            case 'pineapple':
              return {value: 'anana', next: false};
            default:
              return {value, next: false};
            }
          } else {
            return next;
          }
        },
        type: stringArg,
      }]);
      battery.test('handler can change value')
        .value(values.string)
        .value('anana')
        .is.strictlyEqual;
    } catch (e) {
      battery.test('accepts string - handler operated successfully').fail;
    }

    battery.done(done);
  });

  it('handlers that return different type', function(t, done) {
    let battery = new TestBattery('handler tests');
    let values;
    try {
      values = parse({
        argv: ['--string=pineapple' ],
        env: {},
      }, [{
        name: 'string',
        arg: [ '--string' ],
        env: 'STRING',
        handler: (value: ArgType|undefined) => {
          if (value !== undefined) {
            switch(value as string) {
            case 'pineapple':
              return {value: 12, next: false};
            default:
              return {value: 0, next: false};
            }
          } else {
            return next;
          }
        },
        type: stringArg,
      }]);
      battery.test('handler can change value and type')
        .value(values.string)
        .value(12)
        .is.strictlyEqual;
    } catch (e) {
      battery.test('accepts string - convert to integer - handler operated ' +
        'successfully').fail;
    }

    battery.done(done);
  });

  it('handlers that defer to next handler', function(t, done) {
    let battery = new TestBattery('handler tests');
    let values;
    try {
      values = parse({
        argv: ['--string=pineapple' ],
        env: {},
      }, [{
        name: 'string',
        arg: [ '--string' ],
        env: 'STRING',
        handler: [(value: ArgType|undefined) => {
          if (value !== undefined) {
            switch(value) {
            case 'pineapple':
              return {value: 'anana', next: true};
            default:
              return {value: 0, next: false};
            }
          } else {
            return next;
          }
        }, (value: ArgType|undefined) => {
          if (value !== undefined) {
            switch(value) {
              case 'anana':
                return {value: '鳳梨', next: false};
              default:
                return {value: 0, next: false};
              }
            } else {
              return next;
            }
          }],
        type: stringArg,
      }]);
      battery.test('handler can defer to next handler')
        .value(values.string)
        .value('鳳梨')
        .is.strictlyEqual;
    } catch (e) {
      battery.test('accepts string - convert to integer - handler operated ' +
        'successfully').fail;
    }

    battery.done(done);
  });
});

describe('argument validation', () => {

  it('validation', function(t, done) {
    let battery = new TestBattery('handler tests');
    let values;
    try {
      values = parse({
        argv: ['--string=pineapple' ],
        env: {},
      }, [{
        name: 'string',
        arg: [ '--string' ],
        env: 'STRING',
        validator(value) {
          const result = ['anana', 'pineapple', '鳳梨'].includes(value as string)
            ? null
            : 'string is not a pineapple';
          return result;
        }
      }]);
    } catch (e) {
      battery.test('accepts string - accepts pineapple 1').fail;
    }

    try {
      values = parse({
        argv: ['--string=coconut' ],
        env: {},
      }, [{
        name: 'string',
        arg: [ '--string' ],
        env: 'STRING',
        validator(value) {
          return ['anana', 'pineapple', '鳳梨'].includes(value as string)
            ? null
            : 'string is not a pineapple';
        }
      }]);
      battery.test('accepts string - rejects pineapple').fail;
    } catch (e) {
    }

    battery.done(done);
  });

  it('validation with handler', function(t, done) {
    let battery = new TestBattery('handler tests');
    let values;
    try {
      values = parse({
        argv: ['--string=pineapple' ],
        env: {},
      }, [{
        name: 'string',
        arg: [ '--string' ],
        env: 'STRING',
        handler: (value: ArgType|undefined) => {
          if (value !== undefined) {
            switch(value as string) {
            case 'pineapple':
              return {value: 'anana', next: false};
            default:
              return {value, next: false};
            }
          } else {
            return next;
          }
        },
        validator(value) {
          return ['anana', 'pineapple', '鳳梨'].includes(value as string)
            ? null
            : 'string is not a pineapple';
        }
      }]);
      battery.test('accepts string and handles it')
        .value(values.string)
        .value('anana')
        .is.strictlyEqual;
    } catch (e) {
      battery.test('accepts string - accepts pineapple 2').fail;
    }

    try {
      values = parse({
        argv: ['--string=coconut' ],
        env: {},
      }, [{
        name: 'string',
        arg: [ '--string' ],
        env: 'STRING',
        handler: (value: ArgType|undefined) => {
          if (value !== undefined) {
            switch(value) {
            case 'pineapple':
              return {value: 'anana', next: false};
            default:
              return {value, next: false};
            }
          } else {
            return next;
          }
        },
        validator(value) {
          return ['anana', 'pineapple', '鳳梨'].includes(value as string)
            ? null
            : 'string is not a pineapple';
        }
      }]);
      battery.test('accepts string - rejects pineapple').fail;
    } catch (e) {
    }

    battery.done(done);
  });

  it('validation of positional arguments', function(t, done) {
    let battery = new TestBattery('positional tests');

    try {
      const parser = new Parser({
        argv: [ 'anana', 'pamplemousse', 'pomme', '-l=boeuf', '-l=poulet' ],
        env: {},
      });
      parser.addOptions([{
        name: 'positional',
        arg: 'positional',
        validator(value) {
          return ['anana', 'pineapple', '鳳梨'].includes((value as string[])[0])
            ? null
            : 'positional is not a pineapple';
        }
      }, {
        name: 'list',
        arg: [ '--list', '-l' ],
        type: listArg
      }]);
      const parseOk = parser.parse();
      if (parseOk) {

        battery.test('accepts positional is array')
          .value(parser.args.positional)
          .is.array;
        battery.test('accepts positional - first positional is pineapple')
          .value((parser.args.positional as string[])[0])
          .value('anana')
          .is.strictlyEqual;

      } else {
        battery.test('accepts positional - accepts pineapple').fail;
      }
    } catch (e) {
      battery.test('accepts positional - without exception').fail;
    }

    battery.done(done);
  });
});
