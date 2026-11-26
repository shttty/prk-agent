import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const reactHookRules = {
  "react-hooks/rules-of-hooks": "error",
  "react-hooks/exhaustive-deps": "error",
};

export default tseslint.config(
  { ignores: ["dist/**"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: { "no-undef": "error", ...reactHookRules },
  },
  // Migrated files: typescript-eslint with web/tsconfig.json, the same project `tsc -p web` checks.
  // The no-unsafe-* family stays off: batches migrate in parallel, so a .ts file still imports untyped .js neighbours.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHookRules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      // src/ is a backend: web may only `import type` from its public type layer, never pull runtime in.
      "@typescript-eslint/no-restricted-imports": ["error", {
        patterns: [
          { group: ["**/src/**", "!**/src/gateway/wire/web-types.ts"], message: "web/ imports backend code only from src/gateway/wire/web-types.ts." },
          { group: ["**/src/gateway/wire/web-types.ts"], allowTypeImports: true, message: "web-types.ts holds types only: use `import type`." },
        ],
      }],
    },
  },
  { files: ["vite.config.js", "eslint.config.js"], languageOptions: { globals: globals.node } },
);
