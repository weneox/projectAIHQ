export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_BUSINESS_FORM = {
  companyName: "",
  description: "",
  timezone: "Asia/Baku",
  language: "en",
  websiteUrl: "",
  primaryPhone: "",
  primaryEmail: "",
  primaryAddress: "",
  behavior: {},
};

export const DEFAULT_MANUAL_SECTIONS = {
  servicesText: "",
  faqsText: "",
  policiesText: "",
};

export const DEFAULT_DISCOVERY_FORM = {
  websiteUrl: "",
  note: "",
};

export const DEFAULT_SETUP_META = {
  readinessScore: 0,
  readinessLabel: "",
  missingSteps: [],
  primaryMissingStep: "",
  nextRoute: "/",
  nextSetupRoute: "/setup/studio",
  nextStudioStage: "",
  setupCompleted: false,
  pendingCandidateCount: 0,
  approvedKnowledgeCount: 0,
  serviceCount: 0,
  playbookCount: 0,
  runtimeKnowledgeCount: 0,
  runtimeServiceCount: 0,
  runtimePlaybookCount: 0,
};
