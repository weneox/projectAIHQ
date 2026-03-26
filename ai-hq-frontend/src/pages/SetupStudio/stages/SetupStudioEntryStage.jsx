import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Link2,
  Loader2,
  Mic,
  PlugZap,
  Square,
  X,
} from "lucide-react";

import websiteIcon from "../../../assets/setup-studio/channels/weblink.webp";
import instagramIcon from "../../../assets/setup-studio/channels/instagram.svg";
import facebookIcon from "../../../assets/setup-studio/channels/facebook.svg";
import linkedinIcon from "../../../assets/setup-studio/channels/linkedin.svg";
import googleMapsIcon from "../../../assets/setup-studio/channels/google-maps.svg";
import {
  getMetaChannelStatus,
  getMetaConnectUrl,
} from "../../../api/settings.js";
import FocusDialog from "../../../components/ui/FocusDialog.jsx";

const DISPLAY_FONT_STYLE = {
  fontFamily:
    '"Sora", "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
};

const INPUT_RESET_STYLE = {
  all: "unset",
  width: "100%",
  minWidth: 0,
  border: "0",
  outline: "0",
  boxShadow: "none",
  background: "transparent",
  color: "#0f172a",
  fontSize: "15px",
  lineHeight: "22px",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const TEXTAREA_RESET_STYLE = {
  width: "100%",
  minWidth: 0,
  border: "0",
  outline: "0",
  boxShadow: "none",
  background: "transparent",
  color: "#0f172a",
  resize: "none",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const TYPING_EXAMPLES = [
  "We are a dental clinic in Baku offering implants, whitening, and consultations in Azerbaijani and English.",
  "We run a women’s fashion boutique with same-day delivery in Baku and most orders coming from Instagram.",
  "We are a law firm helping startups with company setup, contracts, accounting coordination, and tax support.",
  "We operate a premium beauty studio offering hair, nails, makeup, and bridal appointments by booking.",
];

function s(v) {
  return String(v ?? "").replace(/\u00a0/g, " ").trim();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function lower(v) {
  return s(v).toLowerCase();
}

function instagramProfileUrlFromChannel(channel = {}) {
  const username = s(channel?.external_username).replace(/^@+/, "");
  if (username) return `https://instagram.com/${username}`;
  return "";
}

function normalizeInstagramStatusPayload(raw = {}) {
  const channel = obj(raw?.channel);
  const connected =
    Boolean(raw?.connected) &&
    Boolean(raw?.hasToken) &&
    !!s(
      channel?.external_user_id ||
        channel?.external_username ||
        channel?.external_page_id
    );

  return {
    loading: false,
    connecting: false,
    connected,
    hasToken: Boolean(raw?.hasToken),
    username: s(channel?.external_username).replace(/^@+/, ""),
    profileUrl: instagramProfileUrlFromChannel(channel),
    displayName: s(channel?.display_name),
    externalUserId: s(channel?.external_user_id),
    externalPageId: s(channel?.external_page_id),
    channel,
    error: "",
  };
}

const SOURCE_OPTIONS = [
  {
    key: "website",
    label: "Website",
    icon: websiteIcon,
    placeholder: "yourbusiness.com",
    title: "Website",
    description: "Add the main business website.",
    actionLabel: "Save source",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: instagramIcon,
    placeholder: "@yourbrand or instagram.com/yourbrand",
    title: "Instagram",
    description: "Connect the real account, or add a public profile link manually.",
    actionLabel: "Save source",
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: facebookIcon,
    placeholder: "facebook.com/yourbrand",
    title: "Facebook",
    description: "Add the public business page link.",
    actionLabel: "Save source",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: linkedinIcon,
    placeholder: "linkedin.com/company/yourbrand",
    title: "LinkedIn",
    description: "Add the company page link.",
    actionLabel: "Save source",
  },
  {
    key: "google_maps",
    label: "Google Maps",
    icon: googleMapsIcon,
    placeholder: "Business name, city or Maps link",
    title: "Google Maps",
    description: "Add a Maps link, or the business name with city.",
    actionLabel: "Save source",
  },
];

const VISIBLE_SOURCE_KEYS = [
  "website",
  "instagram",
  "facebook",
  "linkedin",
  "google_maps",
];

function sourceByKey(key = "") {
  return SOURCE_OPTIONS.find((item) => item.key === key) || null;
}

function buildInitialSourceDrafts(discoveryForm = {}) {
  const sourceType = s(discoveryForm?.sourceType);
  const sourceValue = s(discoveryForm?.sourceValue || discoveryForm?.websiteUrl);

  if (!sourceType || !sourceValue) return {};
  if (!sourceByKey(sourceType)) return {};

  return {
    [sourceType]: {
      value: sourceValue,
      mode: "manual",
    },
  };
}

function cleanComposerText(raw = "", sourceDrafts = {}) {
  let text = s(raw);

  if (!text) return "";

  text = text.replace(
    /find local businesses,\s*view maps and get driving directions in google maps\.?/gi,
    " "
  );

  for (const source of SOURCE_OPTIONS) {
    const label = s(source.label);
    const record = obj(sourceDrafts[source.key]);
    const value = s(record.value);

    if (value) {
      text = text.split(value).join(" ");
    }

    if (lower(text) === lower(label)) {
      text = "";
    }
  }

  text = text
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;:\-\s]+/, "")
    .replace(/[,:;\-\s]+$/, "")
    .trim();

  return text;
}

function detectInlineSource(raw = "") {
  const text = s(raw);
  if (!text) return null;

  const patterns = [
    {
      type: "instagram",
      regex:
        /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s,]+|(^|[\s(])@[a-z0-9._]{2,}\b/i,
      normalize(match) {
        return s(match).replace(/^[\s(]+/, "");
      },
    },
    {
      type: "facebook",
      regex: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s,]+/i,
    },
    {
      type: "linkedin",
      regex: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,]+/i,
    },
    {
      type: "google_maps",
      regex:
        /(?:https?:\/\/)?(?:www\.)?(?:maps\.app\.goo\.gl|maps\.google\.[^\s/]+|goo\.gl\/maps)\/?[^\s,]*/i,
    },
    {
      type: "website",
      regex:
        /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,]*)?/i,
    },
  ];

  for (const item of patterns) {
    const match = text.match(item.regex);
    if (!match) continue;

    const value = s(
      typeof item.normalize === "function" ? item.normalize(match[0]) : match[0]
    );

    if (!value) continue;
    if (item.type === "website" && /@/.test(value)) continue;

    return {
      sourceType: item.type,
      sourceValue: value,
      fullMatch: match[0],
    };
  }

  return null;
}

function pickPrimaryAttachedSource(sourceDrafts = {}) {
  for (const key of VISIBLE_SOURCE_KEYS) {
    const record = obj(sourceDrafts[key]);
    if (s(record.value)) {
      return {
        sourceType: key,
        sourceValue: s(record.value),
      };
    }
  }

  return null;
}

function buildInterpretation(raw = "", sourceDrafts = {}) {
  const cleaned = cleanComposerText(raw, sourceDrafts);
  const attached = pickPrimaryAttachedSource(sourceDrafts);

  if (attached?.sourceValue) {
    return {
      sourceType: attached.sourceType,
      sourceValue: attached.sourceValue,
      websiteUrl: attached.sourceType === "website" ? attached.sourceValue : "",
      note: cleaned,
      description: cleaned,
    };
  }

  const inlineSource = detectInlineSource(cleaned);

  if (inlineSource?.sourceValue) {
    const note = s(
      cleaned
        .replace(inlineSource.fullMatch, " ")
        .replace(/^[,;:\-\s]+/, "")
        .replace(/\s{2,}/g, " ")
    );

    return {
      sourceType: inlineSource.sourceType,
      sourceValue: inlineSource.sourceValue,
      websiteUrl:
        inlineSource.sourceType === "website" ? inlineSource.sourceValue : "",
      note,
      description: note,
    };
  }

  return {
    sourceType: "",
    sourceValue: "",
    websiteUrl: "",
    note: cleaned,
    description: cleaned,
  };
}

function appendText(base = "", addition = "") {
  const a = s(base);
  const b = s(addition);
  if (!a) return b;
  if (!b) return a;
  return `${a}${/[.!?]$/.test(a) ? " " : ". "}${b}`;
}

function useTypingExamples(enabled = true) {
  const [display, setDisplay] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setDisplay("");
      return undefined;
    }

    const examples = TYPING_EXAMPLES;
    let charIndex = 0;
    let deleting = false;
    let mounted = true;
    let timeoutId;

    function tick(currentIndex, currentCharIndex, isDeleting) {
      if (!mounted) return;

      const current = examples[currentIndex % examples.length] || "";

      if (!isDeleting) {
        const nextCharIndex = currentCharIndex + 1;
        setDisplay(current.slice(0, nextCharIndex));

        if (nextCharIndex >= current.length) {
          timeoutId = window.setTimeout(() => {
            tick(currentIndex, nextCharIndex, true);
          }, 1350);
          return;
        }

        timeoutId = window.setTimeout(() => {
          tick(currentIndex, nextCharIndex, false);
        }, 24);
        return;
      }

      const nextCharIndex = currentCharIndex - 1;
      setDisplay(current.slice(0, Math.max(0, nextCharIndex)));

      if (nextCharIndex <= 0) {
        const nextIndex = (currentIndex + 1) % examples.length;
        setExampleIndex(nextIndex);
        timeoutId = window.setTimeout(() => {
          tick(nextIndex, 0, false);
        }, 220);
        return;
      }

      timeoutId = window.setTimeout(() => {
        tick(currentIndex, nextCharIndex, true);
      }, 14);
    }

    timeoutId = window.setTimeout(() => {
      tick(exampleIndex, 0, false);
    }, 420);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [enabled, exampleIndex]);

  return display;
}

function NeoxWordmark() {
  return (
    <div className="inline-flex select-none items-center justify-center">
      <div
        style={DISPLAY_FONT_STYLE}
        className="inline-flex items-end gap-[8px] text-[30px] font-semibold leading-none tracking-[-0.06em] sm:text-[34px] lg:text-[38px]"
      >
        <span className="text-slate-950">NEOX</span>
        <span className="bg-[linear-gradient(180deg,#4b5563_0%,#0f172a_100%)] bg-clip-text text-transparent">
          AI Studio
        </span>
      </div>
    </div>
  );
}

function SourceAction({
  source,
  attached = false,
  connectedOnly = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex h-[42px] items-center gap-2 rounded-full px-3.5 text-[14px] font-medium tracking-[-0.02em] transition ${
        attached
          ? "bg-white text-slate-900 shadow-[0_10px_24px_-18px_rgba(15,23,42,.12)]"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <img
        src={source.icon}
        alt={source.label}
        className="h-[16px] w-[16px] object-contain"
      />

      <span>{source.label}</span>

      {attached ? (
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-[12px] w-[12px]" />
        </span>
      ) : connectedOnly ? (
        <span className="inline-flex h-[8px] w-[8px] rounded-full bg-emerald-500" />
      ) : null}
    </button>
  );
}

function SourceModal({
  source,
  value,
  hasExistingValue = false,
  onChange,
  onSave,
  onRemove,
  onClose,
  instagramMeta = {},
  onInstagramConnect,
  onUseConnectedInstagram,
}) {
  if (!source) return null;

  const isInstagram = source.key === "instagram";
  const connected = Boolean(instagramMeta?.connected);
  const connectedHandle = s(instagramMeta?.username)
    ? `@${s(instagramMeta.username)}`
    : "@instagram";

  return (
    <FocusDialog
      open={!!source}
      onClose={onClose}
      title={`${source.title} source`}
      backdropClassName="bg-[rgba(15,23,42,.14)] backdrop-blur-[14px]"
      panelClassName="w-full max-w-[620px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-[30px] border border-white/80 bg-[rgba(249,249,249,.98)] shadow-[0_32px_80px_-36px_rgba(15,23,42,.28)]"
      >
        <div className="relative px-7 pb-7 pt-7 sm:px-8">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-4">
                <img
                  src={source.icon}
                  alt={source.label}
                  className="h-10 w-10 shrink-0 object-contain"
                />

                <h3
                  style={DISPLAY_FONT_STYLE}
                  className="truncate text-[26px] font-semibold leading-none tracking-[-0.05em] text-slate-950 sm:text-[28px]"
                >
                  {source.title}
                </h3>
              </div>

              <p className="ml-14 mt-3 text-[15px] leading-7 text-slate-500">
                {source.description}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="relative z-10 inline-flex h-11 w-11 shrink-0 self-start items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-700"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {isInstagram ? (
            <div className="mt-7">
              {instagramMeta?.loading ? (
                <div className="flex items-center gap-3 text-[14px] text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking connected Instagram account...
                </div>
              ) : connected ? (
                <div className="rounded-[24px] border border-[rgba(15,23,42,.07)] bg-white/80 px-5 py-5">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Connected account
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={instagramIcon}
                        alt="Instagram"
                        className="h-[22px] w-[22px] shrink-0 object-contain"
                      />
                      <div className="min-w-0 text-left">
                        <div className="truncate text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                          {connectedHandle}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onUseConnectedInstagram}
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-slate-950 px-5 text-[14px] font-medium text-white transition hover:bg-slate-800"
                    >
                      Use connected account
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-[24px] border border-[rgba(15,23,42,.07)] bg-white/72 px-5 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="text-[14px] leading-6 text-slate-500">
                        Connect the real Instagram account first, or add a public profile manually.
                      </div>

                      <button
                        type="button"
                        onClick={onInstagramConnect}
                        disabled={instagramMeta?.connecting}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-[14px] font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {instagramMeta?.connecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlugZap className="h-4 w-4" />
                        )}
                        {instagramMeta?.connecting
                          ? "Connecting..."
                          : "Connect Instagram"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="flex min-h-[56px] items-center gap-3 border-b border-[rgba(15,23,42,.10)] px-1 pb-3">
                      <Link2 className="h-[16px] w-[16px] shrink-0 text-slate-400" />
                      <input
                        type="text"
                        name={`${source.key}-source`}
                        autoComplete="off"
                        spellCheck={false}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={source.placeholder}
                        style={INPUT_RESET_STYLE}
                        autoFocus
                      />
                    </div>
                  </div>
                </>
              )}

              {s(instagramMeta?.error) ? (
                <div className="mt-4 text-[13px] text-rose-700">
                  {instagramMeta.error}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-8">
              <div className="flex min-h-[56px] items-center gap-3 border-b border-[rgba(15,23,42,.10)] px-1 pb-3">
                <Link2 className="h-[16px] w-[16px] shrink-0 text-slate-400" />
                <input
                  type="text"
                  name={`${source.key}-source`}
                  autoComplete="off"
                  spellCheck={false}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={source.placeholder}
                  style={INPUT_RESET_STYLE}
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-5">
            {(!isInstagram || !connected) && (
              <button
                type="button"
                onClick={onSave}
                disabled={!s(value)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-6 text-[14px] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {source.actionLabel}
              </button>
            )}

            {hasExistingValue ? (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex h-10 items-center justify-center text-[14px] font-medium text-slate-500 transition hover:text-slate-950"
              >
                Remove
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center text-[14px] font-medium text-slate-500 transition hover:text-slate-950"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </FocusDialog>
  );
}

export default function SetupStudioEntryStage({
  importingWebsite = false,
  discoveryForm,
  businessForm,
  manualSections,
  hasStoredReview = false,
  hasApprovedTruth = false,
  onSetBusinessField,
  onSetManualSection,
  onSetDiscoveryField,
  onContinueFlow,
  onResumeReview,
  onOpenReviewWorkspace,
  onOpenTruth,
}) {
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const composerRef = useRef("");
  const sourceDraftsRef = useRef({});

  const [composerValue, setComposerValue] = useState(() =>
    cleanComposerText(
      s(discoveryForm?.note || businessForm?.description),
      buildInitialSourceDrafts(discoveryForm)
    )
  );
  const [sourceDrafts, setSourceDrafts] = useState(() =>
    buildInitialSourceDrafts(discoveryForm)
  );
  const [activeSourceKey, setActiveSourceKey] = useState("");
  const [modalValue, setModalValue] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [instagramMeta, setInstagramMeta] = useState({
    loading: true,
    connecting: false,
    connected: false,
    hasToken: false,
    username: "",
    profileUrl: "",
    displayName: "",
    externalUserId: "",
    externalPageId: "",
    channel: null,
    error: "",
  });

  useEffect(() => {
    composerRef.current = composerValue;
  }, [composerValue]);

  useEffect(() => {
    sourceDraftsRef.current = sourceDrafts;
  }, [sourceDrafts]);

  const activeSource = useMemo(
    () => sourceByKey(activeSourceKey),
    [activeSourceKey]
  );

  const interpretation = useMemo(() => {
    return buildInterpretation(composerValue, sourceDrafts);
  }, [composerValue, sourceDrafts]);

  const hasRealSource = !!s(interpretation.sourceValue);
  const hasComposerContent = !!s(composerValue);
  const canContinue = !!(hasComposerContent || hasRealSource);
  const shouldRunTyping =
    !hasComposerContent && !isListening && !isComposerFocused;
  const typingExample = useTypingExamples(shouldRunTyping);

  const refreshInstagramStatus = useCallback(async () => {
    try {
      setInstagramMeta((prev) => ({
        ...prev,
        loading: true,
        error: "",
      }));

      const status = await getMetaChannelStatus();

      setInstagramMeta((prev) => ({
        ...prev,
        ...normalizeInstagramStatusPayload(status),
      }));

      return normalizeInstagramStatusPayload(status);
    } catch (error) {
      const message = s(error?.message || "Failed to load Instagram status");
      setInstagramMeta((prev) => ({
        ...prev,
        loading: false,
        connected: false,
        hasToken: false,
        username: "",
        profileUrl: "",
        displayName: "",
        externalUserId: "",
        externalPageId: "",
        channel: null,
        error: message,
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    refreshInstagramStatus();
  }, [refreshInstagramStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const metaConnected = s(params.get("meta_connected"));
    const metaError = s(params.get("meta_error"));

    if (!metaConnected && !metaError) return;

    if (metaError) {
      setInstagramMeta((prev) => ({
        ...prev,
        error: metaError,
        connecting: false,
      }));
    }

    refreshInstagramStatus().then((status) => {
      if (
        metaConnected === "1" &&
        status?.connected &&
        !s(obj(sourceDraftsRef.current.instagram).value)
      ) {
        const connectedUrl = s(status.profileUrl);
        if (connectedUrl) {
          const nextDrafts = {
            ...sourceDraftsRef.current,
            instagram: {
              value: connectedUrl,
              mode: "connected",
              username: s(status.username),
            },
          };

          const nextComposer = cleanComposerText(
            composerRef.current,
            nextDrafts
          );

          setSourceDrafts(nextDrafts);
          setComposerValue(nextComposer);

          const next = buildInterpretation(nextComposer, nextDrafts);
          onSetDiscoveryField?.("sourceType", next.sourceType || "");
          onSetDiscoveryField?.("sourceValue", next.sourceValue || "");
          onSetDiscoveryField?.("websiteUrl", next.websiteUrl || "");
          onSetDiscoveryField?.("note", next.note || "");

          onSetBusinessField?.("websiteUrl", next.websiteUrl || "");
          onSetBusinessField?.("description", next.description || "");
        }
      }
    });

    params.delete("meta_connected");
    params.delete("meta_error");
    params.delete("channel");

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${
      nextQuery ? `?${nextQuery}` : ""
    }${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [onSetBusinessField, onSetDiscoveryField, refreshInstagramStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    setSpeechSupported(!!SpeechRecognition);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeSource) return;

    if (activeSource.key === "instagram") {
      const current = obj(sourceDrafts[activeSource.key]);
      const currentValue = s(current.value);
      const connectedUrl = s(instagramMeta.profileUrl);
      const fallbackValue = currentValue || connectedUrl;
      setModalValue(fallbackValue);
      return;
    }

    const prev = obj(sourceDrafts[activeSource.key]);
    setModalValue(s(prev.value));
  }, [activeSource, sourceDrafts, instagramMeta.profileUrl]);

  useEffect(() => {
    if (!activeSourceKey) return;

    const body = document.body;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [activeSourceKey]);

  function syncState(
    nextText = composerRef.current,
    nextDrafts = sourceDraftsRef.current
  ) {
    const next = buildInterpretation(nextText, nextDrafts);

    onSetDiscoveryField?.("sourceType", next.sourceType || "");
    onSetDiscoveryField?.("sourceValue", next.sourceValue || "");
    onSetDiscoveryField?.("websiteUrl", next.websiteUrl || "");
    onSetDiscoveryField?.("note", next.note || "");

    onSetBusinessField?.("websiteUrl", next.websiteUrl || "");
    onSetBusinessField?.("description", next.description || "");

    onSetManualSection?.("servicesText", s(manualSections?.servicesText || ""));
    onSetManualSection?.("faqsText", s(manualSections?.faqsText || ""));
    onSetManualSection?.("policiesText", s(manualSections?.policiesText || ""));
  }

  function handleComposerChange(nextText) {
    setComposerValue(nextText);
    syncState(nextText, sourceDraftsRef.current);
  }

  function openSourceModal(sourceKey) {
    setActiveSourceKey(sourceKey);
  }

  function closeSourceModal() {
    setActiveSourceKey("");
    setModalValue("");
  }

  function handleSaveSource() {
    if (!activeSource) return;
    const nextValue = s(modalValue);
    if (!nextValue) return;

    const nextDrafts = {
      ...sourceDraftsRef.current,
      [activeSource.key]: {
        value: nextValue,
        mode:
          activeSource.key === "instagram" &&
          lower(nextValue) === lower(s(instagramMeta.profileUrl))
            ? "connected"
            : "manual",
        username:
          activeSource.key === "instagram" ? s(instagramMeta.username) : "",
      },
    };

    const nextComposer = cleanComposerText(composerRef.current, nextDrafts);

    setSourceDrafts(nextDrafts);
    setComposerValue(nextComposer);
    syncState(nextComposer, nextDrafts);
    closeSourceModal();
  }

  function removeSourceByKey(sourceKey) {
    if (!sourceKey) return;

    const nextDrafts = { ...sourceDraftsRef.current };
    delete nextDrafts[sourceKey];

    const nextComposer = cleanComposerText(composerRef.current, nextDrafts);

    setSourceDrafts(nextDrafts);
    setComposerValue(nextComposer);
    syncState(nextComposer, nextDrafts);

    if (activeSourceKey === sourceKey) {
      closeSourceModal();
    }
  }

  function handleRemoveSource() {
    if (!activeSource) return;
    removeSourceByKey(activeSource.key);
  }

  async function handleInstagramConnect() {
    try {
      setInstagramMeta((prev) => ({
        ...prev,
        connecting: true,
        error: "",
      }));

      const url = await getMetaConnectUrl();
      window.location.assign(url);
    } catch (error) {
      setInstagramMeta((prev) => ({
        ...prev,
        connecting: false,
        error: s(error?.message || "Failed to start Instagram connect"),
      }));
    }
  }

  function handleUseConnectedInstagram() {
    const connectedUrl = s(instagramMeta.profileUrl);
    if (!connectedUrl) return;

    const nextDrafts = {
      ...sourceDraftsRef.current,
      instagram: {
        value: connectedUrl,
        mode: "connected",
        username: s(instagramMeta.username),
      },
    };

    const nextComposer = cleanComposerText(composerRef.current, nextDrafts);

    setSourceDrafts(nextDrafts);
    setComposerValue(nextComposer);
    syncState(nextComposer, nextDrafts);
    closeSourceModal();
  }

  function focusComposer() {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function startVoiceCapture() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError("Voice input is not available in this browser.");
      focusComposer();
      return;
    }

    setSpeechError("");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      setIsComposerFocused(true);
    };

    recognition.onresult = (event) => {
      let nextFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = s(result?.[0]?.transcript);
        if (!transcript) continue;

        if (result.isFinal) {
          nextFinal = appendText(nextFinal, transcript);
        }
      }

      if (nextFinal) {
        finalTranscript = appendText(finalTranscript, nextFinal);
      }
    };

    recognition.onerror = (event) => {
      const code = s(event?.error);

      if (code && code !== "no-speech" && code !== "aborted") {
        setSpeechError("Voice input could not be completed. Please try again.");
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (s(finalTranscript)) {
        const nextText = appendText(composerRef.current, finalTranscript);
        setComposerValue(nextText);
        syncState(nextText, sourceDraftsRef.current);
      }

      focusComposer();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setSpeechError("Voice input could not be started in this browser.");
      focusComposer();
    }
  }

  function stopVoiceCapture() {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch {}

    recognitionRef.current = null;
    setIsListening(false);
  }

  function handleVoiceAction() {
    if (isListening) {
      stopVoiceCapture();
      return;
    }
    startVoiceCapture();
  }

  function handleContinue() {
    flushSync(() => {
      syncState(composerRef.current, sourceDraftsRef.current);
    });

    onContinueFlow?.();
  }

  return (
    <>
      <section className="w-full bg-transparent">
        <div className="mx-auto max-w-[1280px] px-4 py-[42px] sm:px-6 sm:py-[56px] lg:px-8 lg:py-[64px]">
          <div className="mx-auto w-full max-w-[1180px] text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              <NeoxWordmark />

              <h1
                style={DISPLAY_FONT_STYLE}
                className="mx-auto mt-5 max-w-[1040px] text-[31px] font-semibold leading-[1.1] tracking-[-0.045em] text-slate-950 sm:text-[38px] lg:text-[44px]"
              >
                Build your business draft from real signals.
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.04 }}
              className="relative mx-auto mt-10 w-full max-w-[1320px]"
            >
              {hasStoredReview || hasApprovedTruth ? (
                <div className="mb-4 rounded-[28px] border border-[rgba(15,23,42,.07)] bg-white/82 px-5 py-4 text-left shadow-[0_16px_34px_-28px_rgba(15,23,42,.12)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Existing state
                      </div>
                      <div className="mt-1 text-[15px] leading-7 text-slate-600">
                        Start from Entry, or explicitly resume the existing review and approved truth.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {hasStoredReview ? (
                        <>
                          <button
                            type="button"
                            onClick={onResumeReview}
                            className="inline-flex h-[44px] items-center justify-center rounded-full bg-white px-5 text-[14px] font-medium text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,.12)] transition hover:text-slate-950"
                          >
                            Resume review
                          </button>
                          <button
                            type="button"
                            onClick={onOpenReviewWorkspace}
                            className="inline-flex h-[44px] items-center justify-center rounded-full bg-white px-5 text-[14px] font-medium text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,.12)] transition hover:text-slate-950"
                          >
                            Open review workspace
                          </button>
                        </>
                      ) : null}

                      {hasApprovedTruth ? (
                        <button
                          type="button"
                          onClick={onOpenTruth}
                          className="inline-flex h-[44px] items-center justify-center rounded-full bg-white px-5 text-[14px] font-medium text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,.12)] transition hover:text-slate-950"
                        >
                          View approved truth
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="relative overflow-hidden rounded-[34px] border border-[rgba(15,23,42,.07)] bg-[linear-gradient(180deg,rgba(255,255,255,.90)_0%,rgba(249,249,250,.84)_100%)] shadow-[0_20px_44px_-30px_rgba(15,23,42,.12)] backdrop-blur-[12px]">
                <div className="relative px-7 pb-6 pt-7 sm:px-9 sm:pb-7 sm:pt-8">
                  <div className="relative min-h-[108px] text-left sm:min-h-[118px]">
                    <textarea
                      ref={textareaRef}
                      value={composerValue}
                      onChange={(e) => handleComposerChange(e.target.value)}
                      onFocus={() => setIsComposerFocused(true)}
                      onBlur={() => setIsComposerFocused(false)}
                      rows={4}
                      style={TEXTAREA_RESET_STYLE}
                      className="relative z-10 min-h-[108px] w-full bg-transparent p-0 text-[18px] font-normal leading-[1.8] tracking-[-0.03em] text-slate-900 placeholder:text-transparent outline-none focus:outline-none focus:ring-0 sm:min-h-[118px]"
                    />

                    {!composerValue ? (
                      <div className="pointer-events-none absolute inset-0 z-0 text-left">
                        <div className="max-w-[920px] pr-4 text-[18px] leading-[1.8] tracking-[-0.03em] text-slate-400">
                          {typingExample}
                          <motion.span
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{
                              duration: 0.9,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="ml-[2px] inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-slate-300 align-top"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 border-t border-[rgba(15,23,42,.06)] pt-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                          {VISIBLE_SOURCE_KEYS.map((key) => {
                            const source = sourceByKey(key);
                            if (!source) return null;

                            const record = obj(sourceDrafts[key]);
                            const attached = !!s(record.value);
                            const connectedOnly =
                              key === "instagram" &&
                              !attached &&
                              instagramMeta.connected;

                            return (
                              <SourceAction
                                key={key}
                                source={source}
                                attached={attached}
                                connectedOnly={connectedOnly}
                                onClick={() => openSourceModal(key)}
                              />
                            );
                          })}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-4">
                          <button
                            type="button"
                            onClick={handleVoiceAction}
                            className={`inline-flex h-[48px] items-center gap-3 rounded-full px-5 text-[15px] font-medium tracking-[-0.02em] transition ${
                              isListening
                                ? "bg-rose-50 text-rose-700"
                                : "bg-white text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,.12)] hover:text-slate-950"
                            }`}
                          >
                            {isListening ? (
                              <Square className="h-[14px] w-[14px] fill-current" />
                            ) : (
                              <Mic className="h-[18px] w-[18px]" />
                            )}
                            <span>
                              {isListening
                                ? "Listening..."
                                : speechSupported
                                ? "Use voice"
                                : "Voice unavailable"}
                            </span>
                          </button>

                          <div className="text-[14px] tracking-[-0.02em] text-slate-400">
                            {isListening
                              ? "Describe the business naturally."
                              : "Write a short business description or attach your sources."}
                          </div>
                        </div>

                        {speechError ? (
                          <div className="mt-3 text-[14px] text-rose-600">
                            {speechError}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center justify-end">
                        <button
                          type="button"
                          disabled={!canContinue || importingWebsite}
                          onClick={handleContinue}
                          className={`group inline-flex h-[56px] items-center gap-3 rounded-full px-7 text-[16px] font-medium tracking-[-0.03em] transition ${
                            canContinue && !importingWebsite
                              ? "bg-slate-950 text-white hover:bg-slate-800"
                              : "bg-[rgba(15,23,42,.10)] text-white/90"
                          }`}
                        >
                          <span>
                            {importingWebsite ? "Analyzing..." : "Create draft"}
                          </span>

                          {importingWebsite ? (
                            <Loader2 className="h-[17px] w-[17px] animate-spin" />
                          ) : (
                            <ArrowRight className="h-[17px] w-[17px] transition-transform duration-200 group-hover:translate-x-[2px]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {activeSource ? (
        <SourceModal
          source={activeSource}
          value={modalValue}
          hasExistingValue={!!s(obj(sourceDrafts[activeSource.key]).value)}
          onChange={setModalValue}
          onSave={handleSaveSource}
          onRemove={handleRemoveSource}
          onClose={closeSourceModal}
          instagramMeta={instagramMeta}
          onInstagramConnect={handleInstagramConnect}
          onUseConnectedInstagram={handleUseConnectedInstagram}
        />
      ) : null}
    </>
  );
}
