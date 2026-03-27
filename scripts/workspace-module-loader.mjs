import { register } from "node:module";

const hookUrl = new URL("./workspace-module-loader-hooks.mjs", import.meta.url);

register(hookUrl, import.meta.url);

export function getWorkspaceModuleLoaderStatus() {
  return {
    active: true,
    mode: "module.register",
    hook: hookUrl.href,
  };
}
