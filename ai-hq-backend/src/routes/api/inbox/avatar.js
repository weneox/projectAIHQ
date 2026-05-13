import express from "express";

import { isDbReady, isUuid } from "../../../utils/http.js";
import {
  downloadTelegramFileBuffer,
  getTelegramFile,
  resolveTelegramUserAvatar,
} from "../../../utils/telegram.js";
import { getTelegramSecrets } from "../channelConnect/repository.js";
import { TELEGRAM_BOT_TOKEN_SECRET_KEY } from "../channelConnect/telegram.js";
import {
  persistTelegramAvatarMeta,
  resolveTelegramAvatarForThread,
  resolveTelegramTenantIdForThread,
} from "../../../modules/inbox/avatar.js";
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

    const tenantId = await resolveTelegramTenantIdForThread(db, thread);
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