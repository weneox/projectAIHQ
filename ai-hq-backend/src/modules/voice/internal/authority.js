import { firstNonEmpty, obj } from "./primitives.js";

export function buildVoiceAuthorityDetails(error = null, runtime = null) {
  const runtimeValue = obj(runtime);
  const authority = obj(runtimeValue.authority);
  const runtimeAuthority = obj(error?.runtimeAuthority);

  const reasonCode = firstNonEmpty(
    runtimeAuthority.reasonCode,
    runtimeAuthority.reason_code,
    authority.reasonCode,
    authority.reason_code,
    error?.code,
    "runtime_authority_unavailable"
  );

  return {
    unavailable: true,
    strict: true,
    reasonCode,
    reason_code: reasonCode,
    authority: {
      ...authority,
      strict: true,
      unavailable: true,
      reasonCode,
      reason_code: reasonCode,
    },
  };
}
