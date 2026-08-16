import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * A shared ESLint configuration for Node.js backend projects.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = [
  // Base recommended JS rules
  js.configs.recommended,

  // Prettier integration
  eslintConfigPrettier,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Turbo repo plugin
  {
    plugins: {
      turbo: turboPlugin
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn"
    }
  },

  // Ignore generated output
  {
    ignores: ["dist/**", "coverage/**"]
  },

  // Node-specific settings
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "off", // Allow console logging in backend
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-namespace": ["error", { "allowDeclarations": true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ]
    }
  }
];
