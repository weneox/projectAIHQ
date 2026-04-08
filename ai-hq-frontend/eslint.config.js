import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

const vitestGlobals = {
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  vi: "readonly",
};

export default defineConfig([
  globalIgnores([
    "dist/**",
    "coverage/**",
    "test-results/**",
    "node_modules/**",
  ]),

  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^[A-Z_]",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: [
      "vite.config.js",
      "eslint.config.js",
      "postcss.config.js",
      "tailwind.config.js",
      "scripts/**/*.{js,mjs}",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: [
      "src/test/**/*.{js,jsx}",
      "src/**/*.{test,spec}.{js,jsx}",
      "**/*.test.{js,jsx}",
      "**/*.spec.{js,jsx}",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...vitestGlobals,
      },
    },
  },
]);