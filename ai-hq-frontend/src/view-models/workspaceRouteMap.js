import { s } from "../orchestration/contracts/index.js";

export function resolveWorkspaceTarget(targetKind = "") {
  switch (s(targetKind).toLowerCase()) {
    case "truth":
      return {
        destinationSurface: "workspace",
        path: "/truth",
      };
    case "setup":
      return {
        destinationSurface: "workspace",
        path: "/setup/studio",
      };
    case "source_governance":
      return {
        destinationSurface: "expert",
        path: "/expert?section=sources",
      };
    case "policy_controls":
      return {
        destinationSurface: "expert",
        path: "/expert?section=operational",
      };
    case "voice_settings":
      return {
        destinationSurface: "expert",
        path: "/expert?section=operational",
      };
    case "inbox":
      return {
        destinationSurface: "inbox",
        path: "/inbox",
      };
    case "comments":
      return {
        destinationSurface: "publish",
        path: "/publish?focus=moderation",
      };
    case "publish":
      return {
        destinationSurface: "publish",
        path: "/publish",
      };
    default:
      return {
        destinationSurface: "workspace",
        path: "",
      };
  }
}

export function applyWorkspaceRouteMap(item = {}) {
  const targetKind = s(item?.nextAction?.targetKind || item?.target?.kind);
  if (!targetKind) return item;

  const mapped = resolveWorkspaceTarget(targetKind);

  return {
    ...item,
    destinationSurface: mapped.destinationSurface,
    nextAction: item.nextAction
      ? {
          ...item.nextAction,
          destinationSurface: mapped.destinationSurface,
          path: mapped.path,
        }
      : null,
  };
}
