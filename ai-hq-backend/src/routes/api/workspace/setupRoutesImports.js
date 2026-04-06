// ai-hq-backend/src/routes/api/workspace/setupRoutesImports.js

export function registerSetupImportRoutes(
  router,
  {
    db,
    requireSetupActor,
    resolveSourceUrlFromBody,
    resolveInstagramBundleUrl,
    normalizeIncomingSourceType,
    importWebsiteSource,
    importGoogleMapsSource,
    importSource,
    importSourceBundle,
    executeSetupImport,
    s,
  }
) {
  const PRIMARY_SUPPORTED_SOURCE_TYPES = ["website", "google_maps"];
  const BUNDLE_SUPPORTED_SOURCE_TYPES = ["website", "google_maps", "instagram"];

  function normalizeSourceTypeForRoute(value = "") {
    const normalized = s(normalizeIncomingSourceType(value)).trim();
    if (normalized) return normalized;

    const raw = s(value).trim().toLowerCase();
    if (raw === "instagram" || raw === "ig" || raw === "insta") {
      return "instagram";
    }
    if (raw === "google maps" || raw === "google_maps" || raw === "maps") {
      return "google_maps";
    }
    if (raw === "website" || raw === "site" || raw === "web") {
      return "website";
    }

    return "";
  }

  function isPrimarySupportedSourceType(sourceType = "") {
    return PRIMARY_SUPPORTED_SOURCE_TYPES.includes(s(sourceType).trim());
  }

  function buildImportErrorBody(errorCode, reason, extra = {}) {
    return {
      ok: false,
      error: errorCode,
      reason: s(reason) || "request failed",
      ...extra,
    };
  }

  router.post("/setup/import/website", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const url = resolveSourceUrlFromBody(body);

    if (!url) {
      return res.status(400).json(
        buildImportErrorBody("WebsiteImportFailed", "website url is required")
      );
    }

    try {
      const result = await executeSetupImport({
        db,
        actor,
        body,
        requestId: req.requestId,
        log: req.log,
        logLabel: "setup.import.website.requested",
        logContext: { sourceUrl: url },
        executeImport: importWebsiteSource,
        executeArgs: { url },
        response: {
          successMessage: "Website import completed",
          acceptedMessage: "Website import accepted",
          partialMessage: "Website import finished with warnings",
          errorCode: "WebsiteImportFailed",
          errorMessage: "website import failed",
        },
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      req.log?.error("setup.import.website.failed", err, { sourceUrl: url });
      return res.status(400).json(
        buildImportErrorBody(
          "WebsiteImportFailed",
          err?.message || "failed to import website"
        )
      );
    }
  });

  router.post("/setup/import/google-maps", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const url = resolveSourceUrlFromBody(body);

    if (!url) {
      return res.status(400).json(
        buildImportErrorBody(
          "GoogleMapsImportFailed",
          "google maps url is required"
        )
      );
    }

    try {
      const result = await executeSetupImport({
        db,
        actor,
        body,
        requestId: req.requestId,
        log: req.log,
        logLabel: "setup.import.google_maps.requested",
        logContext: { sourceUrl: url },
        executeImport: importGoogleMapsSource,
        executeArgs: { url },
        response: {
          successMessage: "Google Maps import completed",
          acceptedMessage: "Google Maps import accepted",
          partialMessage: "Google Maps import finished with warnings",
          errorCode: "GoogleMapsImportFailed",
          errorMessage: "google maps import failed",
        },
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      req.log?.error("setup.import.google_maps.failed", err, { sourceUrl: url });
      return res.status(400).json(
        buildImportErrorBody(
          "GoogleMapsImportFailed",
          err?.message || "failed to import google maps source"
        )
      );
    }
  });

  router.post("/setup/import/source", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const sourceType = normalizeSourceTypeForRoute(
      body?.sourceType || body?.source_type || body?.type
    );
    const url = resolveSourceUrlFromBody(body);

    if (!sourceType) {
      return res.status(400).json(
        buildImportErrorBody(
          "SourceImportFailed",
          "supported sourceType is required",
          {
            supportedSourceTypes: PRIMARY_SUPPORTED_SOURCE_TYPES,
          }
        )
      );
    }

    if (!isPrimarySupportedSourceType(sourceType)) {
      return res.status(400).json(
        buildImportErrorBody(
          "SourceImportFailed",
          "unsupported source type",
          {
            sourceType,
            supportedSourceTypes: PRIMARY_SUPPORTED_SOURCE_TYPES,
          }
        )
      );
    }

    if (!url) {
      return res.status(400).json(
        buildImportErrorBody("SourceImportFailed", "source url is required", {
          sourceType,
          supportedSourceTypes: PRIMARY_SUPPORTED_SOURCE_TYPES,
        })
      );
    }

    try {
      const result = await executeSetupImport({
        db,
        actor,
        body,
        requestId: req.requestId,
        log: req.log,
        logLabel: "setup.import.source.requested",
        logContext: {
          sourceType,
          sourceUrl: url,
        },
        executeImport: importSource,
        executeArgs: {
          sourceType,
          url,
        },
        response: {
          successMessage: `${sourceType} import completed`,
          acceptedMessage: `${sourceType} import accepted`,
          partialMessage: `${sourceType} import finished with warnings`,
          errorCode: "SourceImportFailed",
          errorMessage: "source import failed",
        },
        responseBody(resultBody) {
          return {
            ...resultBody,
            sourceType,
            supportedSourceTypes: PRIMARY_SUPPORTED_SOURCE_TYPES,
          };
        },
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      req.log?.error("setup.import.source.failed", err, {
        sourceType,
        sourceUrl: url,
      });
      return res.status(400).json(
        buildImportErrorBody(
          "SourceImportFailed",
          err?.message || "failed to import source",
          {
            sourceType,
            supportedSourceTypes: PRIMARY_SUPPORTED_SOURCE_TYPES,
          }
        )
      );
    }
  });

  router.post("/setup/import/bundle", async (req, res) => {
    const actor = requireSetupActor(req, res);
    if (!actor) return;

    const body = req.body || {};
    const websiteUrl = s(
      body?.websiteUrl || body?.website_url || resolveSourceUrlFromBody(body)
    );
    const instagramUrl = resolveInstagramBundleUrl(body);

    if (!websiteUrl) {
      return res.status(400).json(
        buildImportErrorBody(
          "SetupBundleImportFailed",
          "website url is required",
          {
            supportedSourceTypes: BUNDLE_SUPPORTED_SOURCE_TYPES,
          }
        )
      );
    }

    try {
      const result = await executeSetupImport({
        db,
        actor,
        body,
        requestId: req.requestId,
        log: req.log,
        logLabel: "setup.import.bundle.requested",
        logContext: {
          websiteUrl,
          instagramUrl,
        },
        executeImport: importSourceBundle,
        executeArgs: {
          websiteUrl,
          instagramUrl,
        },
        response: {
          successMessage: "Setup bundle import completed",
          acceptedMessage: "Setup bundle import accepted",
          partialMessage: "Setup bundle import finished with warnings",
          errorCode: "SetupBundleImportFailed",
          errorMessage: "setup bundle import failed",
        },
        responseBody(resultBody) {
          return {
            ...resultBody,
            supportedSourceTypes: BUNDLE_SUPPORTED_SOURCE_TYPES,
          };
        },
      });

      return res.status(result.status).json(result.body);
    } catch (err) {
      req.log?.error("setup.import.bundle.failed", err, {
        websiteUrl,
        instagramUrl,
      });
      return res.status(400).json(
        buildImportErrorBody(
          "SetupBundleImportFailed",
          err?.message || "failed to import setup bundle",
          {
            supportedSourceTypes: BUNDLE_SUPPORTED_SOURCE_TYPES,
          }
        )
      );
    }
  });
}