import { apiRequest } from "../../api/client.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function resolveFocusTarget(action = {}, focusTargets = {}) {
  const target = obj(action.target);
  const keys = [
    s(target.field),
    s(target.panel && target.field ? `${target.panel}.${target.field}` : ""),
    s(action.id),
  ].filter(Boolean);

  for (const key of keys) {
    const ref = focusTargets[key];
    const node = ref?.current || ref;
    if (node) return node;
  }

  return null;
}

function assignWindowLocation(path = "", windowRef = globalThis.window) {
  if (!windowRef?.location?.assign || !s(path)) return false;
  windowRef.location.assign(s(path));
  return true;
}

export async function dispatchRepairAction(action = {}, options = {}) {
  const nextAction = obj(action);
  const {
    focusTargets = {},
    oauthHandlers = {},
    windowRef = globalThis.window,
    onBlocked,
    onError,
  } = options;

  try {
    if (nextAction.allowed === false) {
      onBlocked?.(nextAction);
      return { ok: false, reason: "blocked" };
    }

    const kind = s(nextAction.kind || "focus").toLowerCase();
    if (kind === "route" || kind === "admin_route") {
      const assigned = assignWindowLocation(
        s(nextAction?.target?.path || (kind === "admin_route" ? "/admin/secrets" : "")),
        windowRef
      );
      return { ok: assigned, reason: assigned ? "" : "path_missing" };
    }

    if (kind === "oauth") {
      const target = obj(nextAction.target);
      const handlerKey = s(target.provider || nextAction.id).toLowerCase();
      const handler =
        oauthHandlers[handlerKey] ||
        oauthHandlers[s(nextAction.id).toLowerCase()] ||
        oauthHandlers.default;

      if (typeof handler !== "function") {
        return { ok: false, reason: "oauth_handler_missing" };
      }

      const result = await handler(nextAction);
      if (typeof result === "string") {
        assignWindowLocation(result, windowRef);
      }
      return { ok: true, reason: "" };
    }

    if (kind === "api") {
      const target = obj(nextAction.target);
      const path = s(target.path);
      const method = s(target.method || "POST").toUpperCase() || "POST";
      if (!path) return { ok: false, reason: "path_missing" };
      const payload = await apiRequest(path, {
        method,
        body: obj(target.body),
      });
      return { ok: true, reason: "", payload };
    }

    if (kind === "focus") {
      const node = resolveFocusTarget(nextAction, focusTargets);
      if (!node) return { ok: false, reason: "focus_target_missing" };
      node.scrollIntoView?.({ behavior: "smooth", block: "center" });
      node.focus?.();
      return { ok: true, reason: "" };
    }

    return { ok: false, reason: "unsupported_action_kind" };
  } catch (error) {
    onError?.(error, nextAction);
    return { ok: false, reason: "dispatch_failed", error };
  }
}
