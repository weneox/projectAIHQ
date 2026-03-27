import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const rootRequire = createRequire(new URL("../package.json", import.meta.url));

function shouldTryRootFallback(specifier, error) {
  if (!error || error.code !== "ERR_MODULE_NOT_FOUND") return false;
  if (!specifier || typeof specifier !== "string") return false;
  if (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:") ||
    specifier.startsWith("data:") ||
    specifier.startsWith("node:")
  ) {
    return false;
  }
  return true;
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!shouldTryRootFallback(specifier, error)) throw error;

    const resolved = rootRequire.resolve(specifier);
    return {
      url: pathToFileURL(resolved).href,
      shortCircuit: true,
    };
  }
}
