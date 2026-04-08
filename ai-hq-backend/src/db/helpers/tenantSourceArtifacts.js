import crypto from "node:crypto";

import { createTenantKnowledgeHelpers } from "./tenantKnowledge.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function arr(v, fallback = []) {
  return Array.isArray(v) ? v : fallback;
}

function obj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function iso(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function hasQueryApi(db) {
  return !!db && typeof db.query === "function";
}

async function q(db, text, params = []) {
  if (!hasQueryApi(db)) {
    throw new Error("tenantSourceArtifacts: db.query(...) is required");
  }
  return db.query(text, params);
}

function normalizeVisibility(v = "") {
  const value = s(v).toLowerCase();
  if (["public", "private", "restricted", "hybrid"].includes(value)) return value;
  return "private";
}

function normalizeCaptureMethod(v = "") {
  const value = s(v).toLowerCase();
  if (
    ["crawler", "api", "oauth", "upload", "webhook", "manual", "ocr", "import", "system"].includes(
      value
    )
  ) {
    return value;
  }
  return "system";
}

function normalizeStatus(v = "") {
  const value = s(v).toLowerCase();
  if (["active", "superseded", "discarded", "error"].includes(value)) return value;
  return "active";
}

function normalizeArtifactType(v = "") {
  const value = s(v).toLowerCase();
  if (
    [
      "website_site",
      "website_page",
      "website_sitemap",
      "website_feed",
      "website_asset_ref",
      "place_details",
      "business_profile_payload",
      "social_profile",
      "social_post",
      "social_comment",
      "message_thread",
      "message",
      "document_file",
      "document_page",
      "spreadsheet_sheet",
      "slide_deck",
      "slide",
      "image",
      "video",
      "audio",
      "transcript",
      "api_payload",
      "manual_note",
      "other",
    ].includes(value)
  ) {
    return value;
  }
  return "other";
}

function normalizeChunkType(v = "") {
  const value = s(v).toLowerCase();
  if (
    ["text", "heading", "paragraph", "list_item", "faq", "table_row", "metadata", "summary", "other"].includes(
      value
    )
  ) {
    return value;
  }
  return "text";
}

function normalizeQualityLabel(value = "", score = 0) {
  const normalized = s(value).toLowerCase();
  if (["low", "medium", "high", "very_high"].includes(normalized)) return normalized;
  if (score >= 0.86) return "very_high";
  if (score >= 0.65) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

function normalizeScore(v, d = 0) {
  const x = Number(v);
  if (!Number.isFinite(x)) return d;
  if (x > 1 && x <= 100) return Math.max(0, Math.min(1, x / 100));
  return Math.max(0, Math.min(1, x));
}

function safeText(value = "") {
  return s(value);
}

function sha256(value = "") {
  const text = safeText(value);
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex");
}

function rowToArtifact(row) {
  if (!row) return null;
  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    source_id: s(row.source_id),
    source_run_id: s(row.source_run_id),
    artifact_type: s(row.artifact_type),
    artifact_key: s(row.artifact_key),
    parent_artifact_id: s(row.parent_artifact_id),
    capture_method: s(row.capture_method),
    status: s(row.status),
    visibility: s(row.visibility),
    source_type: s(row.source_type),
    source_url: s(row.source_url),
    canonical_url: s(row.canonical_url),
    title: s(row.title),
    page_type: s(row.page_type),
    raw_text: s(row.raw_text),
    extracted_text: s(row.extracted_text),
    raw_json: obj(row.raw_json),
    links_json: arr(row.links_json),
    metadata_json: obj(row.metadata_json),
    quality_score: normalizeScore(row.quality_score, 0),
    quality_label: s(row.quality_label),
    text_length: n(row.text_length, 0),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function rowToChunk(row) {
  if (!row) return null;
  return {
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: s(row.tenant_key),
    source_id: s(row.source_id),
    source_run_id: s(row.source_run_id),
    artifact_id: s(row.artifact_id),
    chunk_key: s(row.chunk_key),
    chunk_index: n(row.chunk_index, 0),
    chunk_type: s(row.chunk_type),
    section_label: s(row.section_label),
    section_title: s(row.section_title),
    text_content: s(row.text_content),
    normalized_text: s(row.normalized_text),
    char_count: n(row.char_count, 0),
    token_estimate: n(row.token_estimate, 0),
    metadata_json: obj(row.metadata_json),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export function createTenantSourceArtifactsHelpers({ db }) {
  if (!hasQueryApi(db)) {
    throw new Error("createTenantSourceArtifactsHelpers: valid db.query(...) adapter required");
  }

  const knowledge = createTenantKnowledgeHelpers({ db });

  return {
    async resolveTenantIdentity(input = {}) {
      return knowledge.resolveTenantIdentity(input);
    },

    async upsertRawArtifact(input = {}) {
      const tenant = await knowledge.resolveTenantIdentity({
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });

      if (!tenant) {
        throw new Error("tenantSourceArtifacts.upsertRawArtifact: tenant not found");
      }

      const artifactKey = s(input.artifactKey);
      if (!artifactKey) {
        throw new Error("tenantSourceArtifacts.upsertRawArtifact: artifactKey is required");
      }

      const sourceText = safeText(input.rawText);
      const extractedText = safeText(input.extractedText);
      const contentHash = s(input.contentHash) || sha256(sourceText || extractedText);
      const checksum = s(input.checksumSha256) || contentHash;
      const qualityScore = normalizeScore(input.qualityScore, 0);
      const qualityLabel = normalizeQualityLabel(input.qualityLabel, qualityScore);
      const rawJson = obj(input.rawJson);
      const linksJson = arr(input.linksJson);
      const mediaRefsJson = arr(input.mediaRefsJson);
      const metadataJson = obj(input.metadataJson);

      const result = await q(
        db,
        `
          insert into tenant_source_raw_artifacts (
            tenant_id,
            tenant_key,
            source_id,
            source_run_id,
            artifact_type,
            artifact_key,
            parent_artifact_id,
            capture_method,
            status,
            visibility,
            source_type,
            source_url,
            canonical_url,
            external_artifact_id,
            title,
            subtitle,
            page_type,
            mime_type,
            language,
            http_status,
            byte_size,
            text_length,
            content_hash,
            checksum_sha256,
            raw_text,
            extracted_text,
            raw_html,
            raw_json,
            headers_json,
            links_json,
            media_refs_json,
            metadata_json,
            quality_score,
            quality_label,
            occurred_at,
            fetched_at
          )
          values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29::jsonb,$30::jsonb,$31::jsonb,
            $32::jsonb,$33,$34,$35,$36
          )
          on conflict (source_run_id, artifact_key)
          where source_run_id is not null
          do update set
            parent_artifact_id = excluded.parent_artifact_id,
            capture_method = excluded.capture_method,
            status = excluded.status,
            visibility = excluded.visibility,
            source_type = excluded.source_type,
            source_url = excluded.source_url,
            canonical_url = excluded.canonical_url,
            external_artifact_id = excluded.external_artifact_id,
            title = excluded.title,
            subtitle = excluded.subtitle,
            page_type = excluded.page_type,
            mime_type = excluded.mime_type,
            language = excluded.language,
            http_status = excluded.http_status,
            byte_size = excluded.byte_size,
            text_length = excluded.text_length,
            content_hash = excluded.content_hash,
            checksum_sha256 = excluded.checksum_sha256,
            raw_text = excluded.raw_text,
            extracted_text = excluded.extracted_text,
            raw_html = excluded.raw_html,
            raw_json = excluded.raw_json,
            headers_json = excluded.headers_json,
            links_json = excluded.links_json,
            media_refs_json = excluded.media_refs_json,
            metadata_json = excluded.metadata_json,
            quality_score = excluded.quality_score,
            quality_label = excluded.quality_label,
            occurred_at = excluded.occurred_at,
            fetched_at = excluded.fetched_at,
            updated_at = now()
          returning *
        `,
        [
          tenant.tenant_id,
          tenant.tenant_key,
          s(input.sourceId) || null,
          s(input.sourceRunId) || null,
          normalizeArtifactType(input.artifactType),
          artifactKey,
          s(input.parentArtifactId) || null,
          normalizeCaptureMethod(input.captureMethod),
          normalizeStatus(input.status),
          normalizeVisibility(input.visibility),
          s(input.sourceType),
          s(input.sourceUrl),
          s(input.canonicalUrl),
          s(input.externalArtifactId),
          s(input.title),
          s(input.subtitle),
          s(input.pageType),
          s(input.mimeType || "text/plain"),
          s(input.language),
          Number.isFinite(Number(input.httpStatus)) ? Number(input.httpStatus) : null,
          Math.max(
            0,
            n(
              input.byteSize,
              Buffer.byteLength(
                safeText(input.rawHtml) || sourceText || extractedText,
                "utf8"
              )
            )
          ),
          Math.max(0, n(input.textLength, (sourceText || extractedText).length)),
          contentHash,
          checksum,
          sourceText,
          extractedText,
          safeText(input.rawHtml),
          JSON.stringify(rawJson),
          JSON.stringify(obj(input.headersJson)),
          JSON.stringify(linksJson),
          JSON.stringify(mediaRefsJson),
          JSON.stringify(metadataJson),
          qualityScore,
          qualityLabel,
          input.occurredAt || null,
          input.fetchedAt || null,
        ]
      );

      return rowToArtifact(result.rows[0]);
    },

    async replaceArtifactChunks(input = {}) {
      const artifactId = s(input.artifactId);
      if (!artifactId) {
        throw new Error("tenantSourceArtifacts.replaceArtifactChunks: artifactId is required");
      }

      const tenant = await knowledge.resolveTenantIdentity({
        tenantId: input.tenantId,
        tenantKey: input.tenantKey,
      });

      if (!tenant) {
        throw new Error("tenantSourceArtifacts.replaceArtifactChunks: tenant not found");
      }

      await q(
        db,
        `
          delete from tenant_source_artifact_chunks
          where artifact_id = $1
        `,
        [artifactId]
      );

      const rows = [];

      for (const [idx, rawChunk] of arr(input.chunks).entries()) {
        const chunk = obj(rawChunk);
        const chunkKey = s(chunk.chunkKey || `chunk_${idx + 1}`);
        if (!chunkKey) continue;

        const textContent = safeText(chunk.textContent);
        const normalizedText = safeText(chunk.normalizedText || textContent);

        const result = await q(
          db,
          `
            insert into tenant_source_artifact_chunks (
              tenant_id,
              tenant_key,
              source_id,
              source_run_id,
              artifact_id,
              chunk_key,
              chunk_index,
              chunk_type,
              page_number,
              section_label,
              section_title,
              text_content,
              normalized_text,
              char_count,
              token_estimate,
              language,
              metadata_json
            )
            values (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb
            )
            returning *
          `,
          [
            tenant.tenant_id,
            tenant.tenant_key,
            s(input.sourceId) || null,
            s(input.sourceRunId) || null,
            artifactId,
            chunkKey,
            idx,
            normalizeChunkType(chunk.chunkType),
            Number.isFinite(Number(chunk.pageNumber)) ? Number(chunk.pageNumber) : null,
            s(chunk.sectionLabel),
            s(chunk.sectionTitle),
            textContent,
            normalizedText,
            Math.max(0, n(chunk.charCount, textContent.length)),
            Math.max(0, n(chunk.tokenEstimate, Math.ceil(textContent.length / 4))),
            s(chunk.language),
            JSON.stringify(obj(chunk.metadataJson)),
          ]
        );

        rows.push(rowToChunk(result.rows[0]));
      }

      return rows;
    },
  };
}

export default createTenantSourceArtifactsHelpers;
