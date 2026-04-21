import express from "express";

import { isDbReady, isUuid } from "../../../utils/http.js";
import {
  downloadTelegramFileBuffer,
  getTelegramFile,
  resolveTelegramUserAvatar,
} from "../../../utils/telegram.js";
import { getTelegramSecrets } from "../channelConnect/repository.js";
import { TELEGRAM_BOT_TOKEN_SECRET_KEY } from "../channelConnect/telegram.js";
import { getThreadById } from "./repository.js";
import { resolveThreadAvatarState, s } from "./shared.js";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function getScopedTenantKey(req) {
  return s(req?.auth?.tenantKey || req?.user?.tenantKey || "");
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

async function persistTelegramAvatarMeta(db, thread = {}, patch = {}) {
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

async function resolveTelegramAvatarForThread({
  db,
  thread,
  botToken,
  avatarState,
} = {}) {
  const currentAvatarState = avatarState || resolveThreadAvatarState(thread);
  const externalUserId = s(
    currentAvatarState?.avatarUserId || thread?.external_user_id
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

export function inboxAvatarRoutes({ db }) {
  const r = express.Router();

  r.get("/inbox/threads/:id/avatar", async (req, res) => {
    const threadId = s(req.params?.id);
    const tenantKey = getScopedTenantKey(req);

    if (!isDbReady(db)) {
      return res.status(503).end();
    }

    if (!threadId || !isUuid(threadId)) {
      return res.status(404).end();
    }

    const thread = await getThreadById(db, threadId, tenantKey);
    if (!thread) {
      return res.status(404).end();
    }

    if (lower(thread?.channel) !== "telegram") {
      return res.status(404).end();
    }

    const avatarState = resolveThreadAvatarState(thread);
    const hasNegativeCache =
      avatarState?.avatarAvailable === false &&
      !s(avatarState?.avatarFilePath) &&
      !s(avatarState?.avatarFileId);

    if (hasNegativeCache) {
      return res.status(404).end();
    }

    const tenantId = s(thread?.tenant_id);
    if (!tenantId) {
      return res.status(404).end();
    }

    const secrets = await getTelegramSecrets(db, tenantId);
    const botToken = s(secrets?.[TELEGRAM_BOT_TOKEN_SECRET_KEY]);

    if (!botToken) {
      return res.status(404).end();
    }

    const resolvedAvatar = await resolveTelegramAvatarForThread({
      db,
      thread,
      botToken,
      avatarState,
    });

    if (resolvedAvatar.patch) {
      try {
        await persistTelegramAvatarMeta(db, thread, resolvedAvatar.patch);
      } catch {}
    }

    if (!resolvedAvatar.ok || !s(resolvedAvatar.filePath)) {
      return res.status(Number(resolvedAvatar.status || 404)).end();
    }

    const download = await downloadTelegramFileBuffer({
      botToken,
      filePath: resolvedAvatar.filePath,
    });

    if (!download.ok || !download.buffer) {
      return res.status(Number(download.status || 502) || 502).end();
    }

    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Vary", "Cookie");
    res.setHeader("Content-Type", s(download.contentType || "image/jpeg"));

    if (Number(download.contentLength || 0) > 0) {
      res.setHeader("Content-Length", String(download.contentLength));
    }

    if (s(download.etag)) {
      res.setHeader("ETag", s(download.etag));
    }

    if (s(download.lastModified)) {
      res.setHeader("Last-Modified", s(download.lastModified));
    }

    return res.status(200).end(download.buffer);
  });

  return r;
}