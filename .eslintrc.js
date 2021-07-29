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
		// Use tabs for indentation
		indent: ['error', 'tab'],
		// Single quotes for strings
		quotes: ['warn', 'single'],
		// Always require semicolons
		semi: ['error', 'always'],
		// Don't use 'var'
		'no-var': 'warn',
		// Only use quotes in object literal keys as needed
		'quote-props': ['warn', 'as-needed']
	}
};
