import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/cache/**",
      "**/artifacts/**",
      "**/typechain-types/**",
      "**/*.tsbuildinfo",
      "**/.git/**",
      "hardhat.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-case-declarations": "error",
      "no-shadow-restricted-names": "error",
      "prefer-const": "error",
      "no-useless-escape": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-throw-literal": "error",
      "no-implicit-coercion": "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
    },
  },
  // CommonJS files: use require/module.exports, allow console
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.commonjs,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
  // Script files: console output is intentional
  {
    files: [
      "scripts/**/*.ts",
      "implementations/evm/scripts/**/*.ts",
      "implementations/js/scripts/**/*.js",
      "implementations/rust/scripts/**/*.js",
      "implementations/tooling/**/*.js",
    ],
    rules: {
      "no-console": "off",
    },
  },
  // Test files: chai expressions and console output
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "no-console": "off",
    },
  },
];
