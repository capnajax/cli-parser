# args-and-envs

Command line and environment variable parser for all node apps.

**Not stable**. This module went through a major redesign in 0.6.0. Many features are not yet implemented, and the interface may go through additional changes in the near future.

This package was specifically written for the needs of Kubernetes-hosted applications. On Kubernetes, it isn't always easy setting a command line option, especially if the value of said command line option needs to come from a secret. This allows you to provide environment variable substitutes for command line options, and treats them as equivalents.

## Installation

```shell
npm install --save ags-and-envs
```

## Usage

The simplest way to use this is to define an OptionsDef array and use the `parse` method to parse the values.

```typescript
  import process from 'node:process';
  import { ParserOptions, OptionsDef, parse } from 'args-and-envs';

  const parserOptions:ParseOptions = {};

  const optionsDef:OptionsDef = [
    { name: 'xfile',
      arg: ['--xfile', '-x'],
      env: 'FILE',
      required: false
    }
  ];

  let parsedValues
  try {
    parsedValues = parse(parserOptions, optionsDef);
  } catch(e) {
    console.error('Failed to parse options:', e);
    process.exit(1);
  }
```

### ParseOptions

The `ParserOptions` object determines the behaviour of the parser as a whole

Note that, because this module is a work in progess, the stati are marked as follows:

- 🟢 Complete with test coverage,
- 🟡 Incomplete or lacking test coverage,
- 🔴 Not implemented.

🚥 | Property | Default | Description
--- | --- | --- | ---
🟢 | `argv?: string[]` | `process.argv.slice(2)` | The arguments to parse as the command line. Should not include the name of the app itself.
🟢 | `env?: Record<string, string>` | `process.env` | The environment variable set to pass into the parser.
🟢 | `falsey?: string[]` | `['false', 'no', ...]` | A set of values to accept as meaning `false` for `boolean` arguments. Case insensitive.
🔴 | `global?: string\|null` | `argv` | A global variable to set the parsed command line object to. For example, if the value is `argv`, the global variables can be accessed anywhere in the app as `global.argv`.
🟢 | `truthy?: string[]` |  `['true', 'yes', ...]` | A set of values to accept as meaning `true` for `boolean` arguments. Case insensitive.

### OptionsDef

The `OptionsDef` object defines how individual options are handled. Options can be superceded by providing another option definition with the same `name`.

Note that, because this module is a work in progess, the stati are marked as follows:

- 🟢 Complete with test coverage,
- 🟡 Incomplete or lacking test coverage,
- 🔴 Not implemented.

🚥 | Property | Default | Description
--- | --- | --- | ---
🟢 | `arg: string[]\|'positional'\|'--\'` | `[]` | The argument switches to accept. A value of `[ '-o', '--output' ]` means `-o value`, `--output value`, `-o=value`, or `--output=value` would all be accepted. Use `positional` to accept all arguments that are not otherwise accepted. If there is an arg of type `--`, all arguments following a `--` will be captured as that argument. If there is an `--` and no `--` arg type is specified, they'll be captured as `positional` arguments. If neither a `positional`, nor a `--` argument available, a `--` will result in an error.
🟢 | `default?: ArgType` | `undefined` | The default value for an argument if it's not provided on the command line.
🔴 | `description?: string` | `undefined` | A text description of the argument and its meaning. Limited markdown is supported. Used for generating documentation.
🟢 | `env: string\|null` | `null` | An environment variable that can also be used to provide this option. If both the command line argument and the environment variable are present, the command line argument will win.
🟢 | `handler: Handler\|Handler[]` | `[]` | A set of functions to handle the argument. The can change the value of an argument. Only the first handler is called, unless it `{next: true}`, in which case, it'll send its result to the next handler function. These functions must be idempotent, synchronous, and have no side effects. If no handlers are provided, the value of the argument is used unchanged.
🟢 | `required: boolean` | `false` | Set to `true` if the argument is required. Will result in an error if it's not provided. Not applicable with `boolean` arguments, and a value not provided will be assumed `false`, and not applicable to options with default values.
🔴 | `silent: boolean` | `false` | Set to `true` if the argument should not appear in generated documentation.
🟢 | `type: ArgTypeName` | `listArg` if positional, otherwise `stringArg` | The type of the argument. The valid values are `booleanArg`, `'integerArg`,`stringArg`, and `listArg`. For the `positional` and the `--` arguments, only `listArg` is valid.
🟢 | `validator: Validator\|Validator[]` | `[]` | Function that are called on command line options. They return `null` if the value is valid, a string if it is not valid, and `next` to defer to the next validator. These functions must be idempotent, synchronous, and have no side effects. If no validators for an option is provided, it'll assume the option is valid if they parse. A value that does not parse (e.g. an `integerArg` parameter value `'some-string'` does not parse as an integer) will always be invalid.

### Parse object

The example above is for the simplest use case. Most of the time it'll work, but there are cases where you might want to enhance an existing parser or handle errors more intelligently than what the case above provides.

```typescript

  import Parser from 'args-and-envs';

  const parser = new Parser({});

  // options can also be provided as additional parameters to the `Parse`
  // constructor
  parser.addOptions([
    { name: 'xfile',
      arg: ['--xfile', '-x'],
      env: 'FILE',
      required: false
    }
  ]);

  // Complete the actual parsing operation
  const hasErrors = parser.parse();
  const values = parser.args;
  const errors = parser.errors;
```
