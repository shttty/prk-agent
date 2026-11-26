// Node maps no `.js` specifier to a `.ts` file, while web/ keeps writing `./name.js` after a file is renamed to `name.ts`
// (Vite and tsc resolve that themselves). Node-run unit tests load web/ and shared/ modules directly, so a relative `.js`
// import that does not exist falls back to the `.ts` sibling. Files with JSX never run under Node.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND" || !/^\.\.?\/.*\.js$/.test(specifier)) throw error;
      return nextResolve(`${specifier.slice(0, -3)}.ts`, context);
    }
  },
});
