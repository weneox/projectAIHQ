export const SOURCE_FUSION_VERSION = "source_fusion_v4";
export const SOURCE_SYNC_VERSION = "source_sync_v8_2";

export const WEBSITE_SOFT_WARNING_CODES = new Set([
  "very_thin_visible_content",
  "thin_visible_content",
  "limited_page_coverage",
  "partial_website_extraction",
  "some_pages_rejected_as_weak_or_placeholder",
  "sitemap_not_found_or_unreadable",
  "entry_fetch_required_fallback",
  "missing_contact_signals",
  "missing_service_signals",
]);

export const WEBSITE_PARTIAL_STAGE_SET = new Set([
  "extract",
  "normalize_observations",
  "persist_observations",
  "load_scoped_observations",
  "synthesize",
  "build_candidates",
]);