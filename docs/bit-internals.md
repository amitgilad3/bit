
# Bit internals

## Bit Objects

//TODO

## JSDoc parsing

Parsing the Docs yield useful information, such as the description of the component, its arguments, return type and usage examples.
Other parts of the system, the Search, in particular, use that information for a better understanding what a component does.

The JSDoc get discovered by a Regex pattern, and parsing the docs is done by [Doctrine](https://github.com/eslint/doctrine).
