import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default [
  {
    ignores: ["dist/**"],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "no-undef": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["vite.config.js", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
];
