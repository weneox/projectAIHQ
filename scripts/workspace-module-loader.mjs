import { registerHooks } from "node:module";

const rootMappings = new Map([
  ["dotenv/config", new URL("../node_modules/dotenv/config.js", import.meta.url).href],
  ["express", new URL("../node_modules/express/index.js", import.meta.url).href],
  ["openai", new URL("../node_modules/openai/index.mjs", import.meta.url).href],
  ["pg", new URL("../node_modules/pg/lib/index.js", import.meta.url).href],
  ["pg/lib/index.js", new URL("../node_modules/pg/lib/index.js", import.meta.url).href],
  ["twilio", new URL("../node_modules/twilio/index.js", import.meta.url).href],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = rootMappings.get(specifier);
    if (mapped) {
      return nextResolve(mapped, context);
    }
    return nextResolve(specifier, context);
  },
});
