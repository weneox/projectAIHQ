function s(v, d = "") {
  return String(v ?? d).trim();
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function getOperatorRouting(tenantConfig = null) {
  const routing = isObj(tenantConfig?.operatorRouting) ? tenantConfig.operatorRouting : {};
  const departments = isObj(routing.departments) ? routing.departments : {};

  return {
    mode: s(
      routing.mode ||
        tenantConfig?.voiceProfile?.transferMode ||
        tenantConfig?.operator?.mode,
      "manual"
    ).toLowerCase(),
    defaultDepartment: s(routing.defaultDepartment).toLowerCase(),
    departments,
  };
}

export function getDepartmentEntry(tenantConfig, departmentKey) {
  const routing = getOperatorRouting(tenantConfig);
  const key = s(departmentKey).toLowerCase();
  if (!key) return null;

  const item = routing.departments?.[key];
  return isObj(item) ? item : null;
}

export function resolveDepartmentForTransfer(tenantConfig, requestedDepartment = "") {
  const routing = getOperatorRouting(tenantConfig);
  const requested = s(requestedDepartment).toLowerCase();

  if (requested) {
    const item = getDepartmentEntry(tenantConfig, requested);
    if (item && String(item.enabled ?? "true").trim() !== "false" && s(item.phone)) {
      return requested;
    }

    const fb = s(item?.fallbackDepartment).toLowerCase();
    if (fb) {
      const fbItem = getDepartmentEntry(tenantConfig, fb);
      if (fbItem && String(fbItem.enabled ?? "true").trim() !== "false" && s(fbItem.phone)) {
        return fb;
      }
    }
  }

  const def = s(routing.defaultDepartment).toLowerCase();
  if (def) {
    const defItem = getDepartmentEntry(tenantConfig, def);
    if (defItem && String(defItem.enabled ?? "true").trim() !== "false" && s(defItem.phone)) {
      return def;
    }
  }

  for (const [key, value] of Object.entries(routing.departments || {})) {
    if (!isObj(value)) continue;
    if (String(value.enabled ?? "true").trim() === "false") continue;
    if (s(value.phone)) return s(key).toLowerCase();
  }

  return "";
}

export function getRequestedDepartment(req) {
  return s(
    req.body?.department ||
      req.body?.Department ||
      req.query?.department ||
      req.query?.Department ||
      req.body?.targetDepartment ||
      req.query?.targetDepartment
  ).toLowerCase();
}
