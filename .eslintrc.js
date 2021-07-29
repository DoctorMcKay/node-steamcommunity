module.exports = {
	env: {
		commonjs: true,
		es2021: true,
		node: true
	},
	extends: 'eslint:recommended',
	parserOptions: {
		ecmaVersion: 12
	},
	rules: {
		// Use tabs for indentation and require 'case' in switch to be indented 1 level (default 0)
		indent: ['error', 'tab', {SwitchCase: 1}],
		// Single quotes for strings
		quotes: ['error', 'single'],
		// Always require semicolons
		semi: ['error', 'always'],
		// Don't use 'var'
		'no-var': 'error',
		// Only use quotes in object literal keys as needed
		'quote-props': ['error', 'as-needed'],
		// Don't allow trailing spaces after a line
		'no-trailing-spaces': 'error',
		// Require spaces before and after keywords (like "if")
		'keyword-spacing': 'error',
		// Don't allow unused variables, but allow unused function args (e.g. in callbacks) and global vars
		'no-unused-vars': ['error', {vars: 'local', args: 'none'}]
	}
};
