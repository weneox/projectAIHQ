import { isUuid } from "../../utils/http.js";
import {
  getTelegramFile,
  resolveTelegramUserAvatar,
} from "../../utils/telegram.js";
import { getTenantByKey } from "../../routes/api/channelConnect/repository.js";
import { resolveThreadAvatarState, s } from "./shared.js";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function buildPatchedThreadMeta(thread = {}, patch = {}) {
  const meta = obj(thread?.meta);
  const telegram = obj(meta?.telegram);

  return {
    ...meta,
    telegram: {
      ...telegram,
      ...patch,
    },
  };
}

export async function persistTelegramAvatarMeta(db, thread = {}, patch = {}) {
  if (!db?.query) return null;
  if (!isUuid(thread?.id)) return null;
  if (!s(thread?.tenant_key)) return null;

  const nextMeta = buildPatchedThreadMeta(thread, patch);

  await db.query(
    `
      update inbox_threads
      set meta = $3::jsonb
      where id = $1::uuid
        and tenant_key = $2::text
    `,
    [thread.id, thread.tenant_key, JSON.stringify(nextMeta)]
  );

  return nextMeta;
}

export async function resolveTelegramTenantIdForThread(db, thread = {}) {
  const directTenantId = s(thread?.tenant_id);
  if (directTenantId) return directTenantId;

  const tenantKey = s(thread?.tenant_key);
  if (!tenantKey) return "";

  const tenant = await getTenantByKey(db, tenantKey);
  return s(tenant?.id);
}

export async function resolveTelegramAvatarForThread({
  db,
  thread,
  botToken,
  avatarState,
} = {}) {
  const currentAvatarState = avatarState || resolveThreadAvatarState(thread);
  const externalUserId = s(
    currentAvatarState?.avatarUserId ||
      thread?.external_user_id ||
      thread?.external_thread_id
  );

  if (s(currentAvatarState?.avatarFilePath)) {
    return {
      ok: true,
      status: 200,
      filePath: s(currentAvatarState.avatarFilePath),
      patch: null,
    };
  }

  if (s(currentAvatarState?.avatarFileId)) {
    const fileResult = await getTelegramFile({
      botToken,
      fileId: currentAvatarState.avatarFileId,
    });

    if (!fileResult.ok) {
      return {
        ok: false,
        status: Number(fileResult.status || 502),
        error: s(fileResult.error || "telegram avatar file lookup failed"),
        reasonCode: s(fileResult.reasonCode || "telegram_request_failed"),
        patch: null,
      };
    }

    const filePath = s(fileResult?.result?.file_path);
    if (!filePath) {
      return {
        ok: false,
        status: 404,
        error: "avatar not found",
        reasonCode: "telegram_profile_photo_missing",
        patch: {
          avatarAvailable: false,
          avatarFilePath: null,
          avatarFetchedAt: new Date().toISOString(),
          avatarUserId: externalUserId || null,
        },
      };
    }

    return {
      ok: true,
      status: 200,
      filePath,
      patch: {
        avatarAvailable: true,
        avatarFileId: s(currentAvatarState.avatarFileId) || null,
        avatarFileUniqueId:
          s(
            currentAvatarState.avatarFileUniqueId ||
              fileResult?.result?.file_unique_id
          ) || null,
        avatarFilePath: filePath,
        avatarFetchedAt:
          s(currentAvatarState.avatarFetchedAt) || new Date().toISOString(),
        avatarUserId: externalUserId || null,
      },
    };
  }

  if (!externalUserId) {
    return {
      ok: false,
      status: 404,
      error: "avatar not found",
      reasonCode: "telegram_profile_photo_missing",
      patch: {
        avatarAvailable: false,
        avatarFetchedAt: new Date().toISOString(),
      },
    };
  }

  const avatarResult = await resolveTelegramUserAvatar({
    botToken,
    userId: externalUserId,
  });

  if (!avatarResult.ok) {
    return {
      ok: false,
      status: Number(avatarResult.status || 502),
      error: s(avatarResult.error || "telegram avatar lookup failed"),
      reasonCode: s(avatarResult.reasonCode || "telegram_request_failed"),
      patch: null,
    };
  }

  if (!avatarResult.hasAvatar || !s(avatarResult.filePath)) {
    return {
      ok: false,
      status: 404,
      error: "avatar not found",
      reasonCode: "telegram_profile_photo_missing",
      patch: {
        avatarAvailable: false,
        avatarFileId: null,
        avatarFileUniqueId: null,
        avatarFilePath: null,
        avatarFetchedAt: new Date().toISOString(),
        avatarUserId: externalUserId,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    filePath: s(avatarResult.filePath),
    patch: {
      avatarAvailable: true,
      avatarFileId: s(avatarResult.fileId) || null,
      avatarFileUniqueId: s(avatarResult.fileUniqueId) || null,
      avatarFilePath: s(avatarResult.filePath) || null,
      avatarFetchedAt: new Date().toISOString(),
      avatarUserId: externalUserId,
    },
  };
}
