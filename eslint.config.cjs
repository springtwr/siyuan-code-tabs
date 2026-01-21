const js = require("@eslint/js");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

module.exports = [
    {
        ignores: ["dist", "dev", "node_modules"],
    },
    js.configs.recommended,
    {
        files: ["**/*.{js,cjs,mjs}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            "no-undef": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
    prettier,
];
