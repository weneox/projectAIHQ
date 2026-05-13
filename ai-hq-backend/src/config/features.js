// src/config/features.js

import { cfg } from "../config.js";

function has(v) {
  return String(v ?? "").trim().length > 0;
}

export function getProviderState() {
  return {
    ai: {
      openai: has(cfg.ai.openaiApiKey),
      gemini: has(cfg.ai.geminiApiKey),
      anthropic: has(cfg.ai.anthropicApiKey),
    },

    media: {
      runway: has(cfg.media.runwayApiKey),
      pika: has(cfg.media.pikaApiKey),
      elevenlabs: has(cfg.media.elevenlabsApiKey),
      creatomate: has(cfg.media.creatomateApiKey),
    },

    meta: {
      oauth:
        has(cfg.meta.appId) &&
        has(cfg.meta.appSecret) &&
        has(cfg.meta.redirectUri),
      pageAccess: has(cfg.meta.pageAccessToken),
      gateway:
        has(cfg.gateway.metaGatewayBaseUrl) &&
        has(cfg.gateway.metaGatewayInternalToken),
    },

    google: {
      places: has(cfg.google?.placesApiKey),
      businessProfileOauth:
        has(cfg.google?.businessProfileClientId) &&
        has(cfg.google?.businessProfileClientSecret) &&
        has(cfg.google?.businessProfileRedirectUri),
    },

    n8n: {
      enabled:
        has(cfg.n8n.webhookUrl) ||
        has(cfg.n8n.webhookBase) ||
        has(cfg.n8n.webhookProposalApprovedUrl) ||
        has(cfg.n8n.webhookPublishUrl) ||
        has(cfg.n8n.scheduleDraftUrl),
      scheduleDraft: has(cfg.n8n.scheduleDraftUrl),
    },

    telegram: {
      enabled:
        cfg.telegram.enabled &&
        has(cfg.telegram.apiBaseUrl) &&
        has(cfg.telegram.webhookBaseUrl),
    },

    push: {
      enabled:
        cfg.push.enabled &&
        has(cfg.push.vapidPublicKey) &&
        has(cfg.push.vapidPrivateKey),
    },

    db: {
      enabled: has(cfg.db.url),
    },

    ws: {
      enabled: has(cfg.ws.authToken),
    },
  };
}

export function getFeatureFlags() {
  const providers = getProviderState();
  const v1LaunchSurface = Boolean(cfg.launch?.v1SurfaceEnabled);
  const aiProviderReady =
    providers.ai.openai || providers.ai.gemini || providers.ai.anthropic;
  const mediaProviderReady =
    providers.media.runway ||
    providers.media.pika ||
    providers.media.elevenlabs ||
    providers.media.creatomate;

  return {
    core: {
      auth: true,
      adminPanel: cfg.auth.adminPanelEnabled && !v1LaunchSurface,
      db: providers.db.enabled,
      ws: providers.ws.enabled,
      auditLog: true,
      agents: !v1LaunchSurface,
      team: true,
      tenants: true,
      settings: true,
      notifications: !v1LaunchSurface,
      mode: true,
    },

    inbox: {
      inbox: true,
      leads: true,
      comments: !v1LaunchSurface,
      metaConnect: providers.meta.oauth,
      metaDm: providers.meta.gateway || providers.meta.pageAccess,
      outboundRetry: cfg.workers.outboundRetryEnabled,
    },

    content: {
      content: !v1LaunchSurface && aiProviderReady,
      analyze: !v1LaunchSurface && aiProviderReady,
      debate: !v1LaunchSurface && providers.ai.openai,
      propose: !v1LaunchSurface && aiProviderReady,
      draftSchedule:
        !v1LaunchSurface &&
        cfg.workers.draftScheduleWorkerEnabled &&
        providers.n8n.scheduleDraft,
      publish:
        !v1LaunchSurface && (providers.n8n.enabled || providers.meta.pageAccess),
    },

    media: {
      render:
        !v1LaunchSurface && (providers.media.creatomate || providers.media.runway),
      imageGeneration:
        !v1LaunchSurface && (providers.media.runway || providers.media.pika),
      videoGeneration:
        !v1LaunchSurface && (providers.media.runway || providers.media.pika),
      tts: !v1LaunchSurface && providers.media.elevenlabs,
      mediaWorker:
        !v1LaunchSurface &&
        cfg.workers.mediaJobWorkerEnabled &&
        mediaProviderReady,
    },

    channels: {
      telegram: !v1LaunchSurface && providers.telegram.enabled,
      push: !v1LaunchSurface && providers.push.enabled,
      meta:
        providers.meta.oauth ||
        providers.meta.pageAccess ||
        providers.meta.gateway,
      voice: !v1LaunchSurface,
      websiteWidget: true,
    },

    sources: {
      websiteImport: true,
      googlePlacesImport: !v1LaunchSurface && providers.google.places,
      googleBusinessProfileConnect:
        !v1LaunchSurface && providers.google.businessProfileOauth,
      sourceSync: true,
      sourceFusion: true,
      reviewQueue: true,
      canonicalTruth: true,
      runtimeProjection: true,
    },

    workflows: {
      n8n: !v1LaunchSurface && providers.n8n.enabled,
      cron: !v1LaunchSurface && has(cfg.security.cronSecret),
      internalCallbacks: !v1LaunchSurface && has(cfg.n8n.callbackToken),
      executions: !v1LaunchSurface,
    },

    ops: {
      incidents: !v1LaunchSurface,
    },

    billing: {
      usageMetering: false,
      pricing: false,
      overage: false,
    },
  };
}

export function hasFeature(path) {
  const flags = getFeatureFlags();
  const parts = String(path || "").split(".").filter(Boolean);

  let cur = flags;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return false;
    cur = cur[p];
  }

  return Boolean(cur);
}
