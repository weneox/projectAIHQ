import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Globe,
  Mail,
  PhoneCall,
  Search,
} from "lucide-react";

import whatsappIcon from "../assets/setup-studio/channels/whatsapp.svg";
import instagramIcon from "../assets/setup-studio/channels/instagram.svg";
import messengerIcon from "../assets/setup-studio/channels/messenger.svg";
import facebookIcon from "../assets/setup-studio/channels/facebook.svg";
import linkedinIcon from "../assets/setup-studio/channels/linkedin.svg";
import googleMapsIcon from "../assets/setup-studio/channels/google-maps.svg";
import websiteIcon from "../assets/setup-studio/channels/weblink.webp";

const TABS = [
  { id: "all", label: "All" },
  { id: "messaging", label: "Business Messaging" },
  { id: "calls", label: "Calls" },
  { id: "email", label: "Email" },
  { id: "live_chat", label: "Live Chat" },
  { id: "sources", label: "Sources" },
];

const CHANNELS = [
  {
    id: "whatsapp",
    category: "messaging",
    title: "WhatsApp Business",
    description:
      "Connect WhatsApp Business messaging for direct customer conversations and automation.",
    badge: "Popular",
    badgeTone: "popular",
    accent: "green",
    iconType: "image",
    icon: whatsappIcon,
    action: "Connect",
  },
  {
    id: "messenger",
    category: "messaging",
    title: "Facebook Messenger",
    description:
      "Connect Messenger to manage customer chats inside one shared operational flow.",
    badge: "Popular",
    badgeTone: "popular",
    accent: "blue",
    iconType: "image",
    icon: messengerIcon,
    action: "Connect",
  },
  {
    id: "instagram",
    category: "messaging",
    title: "Instagram",
    description:
      "Connect Instagram for private messages, comment flows, and business profile context.",
    badge: "Setup",
    badgeTone: "setup",
    accent: "pink",
    iconType: "image",
    icon: instagramIcon,
    action: "Continue",
  },
  {
    id: "website-chat",
    category: "live_chat",
    title: "Website Chat",
    description:
      "Add live website messaging with AI assist, handoff, and operator visibility.",
    badge: "Live",
    badgeTone: "live",
    accent: "sky",
    iconType: "image",
    icon: websiteIcon,
    action: "Manage",
  },
  {
    id: "email",
    category: "email",
    title: "Email",
    description:
      "Connect shared email intake for response drafting, assignment, and tracking.",
    badge: "Connected",
    badgeTone: "connected",
    accent: "slate",
    iconType: "lucide",
    icon: Mail,
    action: "Manage",
  },
  {
    id: "voice",
    category: "calls",
    title: "Voice Calls",
    description:
      "Connect call routing, transcript-aware assistance, and operator control workflows.",
    badge: "Connected",
    badgeTone: "connected",
    accent: "graphite",
    iconType: "lucide",
    icon: PhoneCall,
    action: "Manage",
  },
  {
    id: "facebook-page",
    category: "sources",
    title: "Facebook Page",
    description:
      "Use Facebook Page identity and context as a business signal layer for operations.",
    badge: "Source",
    badgeTone: "neutral",
    accent: "blue",
    iconType: "image",
    icon: facebookIcon,
    action: "Connect",
  },
  {
    id: "google-business",
    category: "sources",
    title: "Google Business",
    description:
      "Bring in Google Business profile, review, and location signals for the business graph.",
    badge: "Source",
    badgeTone: "neutral",
    accent: "amber",
    iconType: "image",
    icon: googleMapsIcon,
    action: "Connect",
  },
  {
    id: "linkedin",
    category: "sources",
    title: "LinkedIn",
    description:
      "Connect professional company identity and audience context as additional business input.",
    badge: "Source",
    badgeTone: "neutral",
    accent: "blue",
    iconType: "image",
    icon: linkedinIcon,
    action: "Connect",
  },
  {
    id: "knowledge-source",
    category: "sources",
    title: "Business Knowledge",
    description:
      "Use approved business information as a structured source for channel behavior.",
    badge: "Internal",
    badgeTone: "neutral",
    accent: "violet",
    iconType: "lucide",
    icon: Building2,
    action: "Review",
  },
  {
    id: "site-presence",
    category: "live_chat",
    title: "Website Presence",
    description:
      "Connect your primary site presence as the surface where chat, forms, and discovery meet.",
    badge: "Ready",
    badgeTone: "connected",
    accent: "sky",
    iconType: "lucide",
    icon: Globe,
    action: "Open",
  },
];

function resolveSectionTitle(activeTab) {
  switch (activeTab) {
    case "messaging":
      return "Business Messaging";
    case "calls":
      return "Calls";
    case "email":
      return "Email";
    case "live_chat":
      return "Live Chat";
    case "sources":
      return "Sources";
    default:
      return "Channel Catalog";
  }
}

function ChannelIcon({ item }) {
  if (item.iconType === "image") {
    return <img src={item.icon} alt="" className="channels-page__icon-image" />;
  }

  const Icon = item.icon;
  return <Icon size={25} strokeWidth={2.1} />;
}

function ChannelCard({ item }) {
  return (
    <article
      className={[
        "channels-page__card",
        `channels-page__card--${item.accent}`,
      ].join(" ")}
    >
      <div className="channels-page__card-glow" />

      <div className="channels-page__card-top">
        <span
          className={[
            "channels-page__badge",
            `channels-page__badge--${item.badgeTone}`,
          ].join(" ")}
        >
          {item.badge}
        </span>

        <div className="channels-page__icon-shell">
          <ChannelIcon item={item} />
        </div>
      </div>

      <div className="channels-page__card-body">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>

      <div className="channels-page__card-footer">
        <button type="button" className="channels-page__action">
          <span>{item.action}</span>
          <ArrowUpRight size={15} strokeWidth={2.15} />
        </button>
      </div>
    </article>
  );
}

export default function Channels() {
  const [activeTab, setActiveTab] = useState("all");
  const [query, setQuery] = useState("");

  const visibleChannels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return CHANNELS.filter((item) => {
      const matchesTab = activeTab === "all" ? true : item.category === activeTab;
      const matchesQuery =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.badge.toLowerCase().includes(normalizedQuery);

      return matchesTab && matchesQuery;
    });
  }, [activeTab, query]);

  return (
    <>
      <style>{`
        .channels-page {
          width: 100%;
          padding: 2px 0 24px;
          background: transparent;
        }

        .channels-page__toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 24px;
        }

        .channels-page__tabs {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 28px;
          min-width: 0;
        }

        .channels-page__tab {
          position: relative;
          border: 0;
          background: transparent;
          padding: 0 0 12px;
          font-size: 15px;
          font-weight: 600;
          color: #687484;
          cursor: pointer;
          transition: color 160ms ease;
          white-space: nowrap;
        }

        .channels-page__tab:hover {
          color: #2563eb;
        }

        .channels-page__tab--active {
          color: #2563eb;
        }

        .channels-page__tab--active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 4px;
          border-radius: 999px;
          background: #2563eb;
        }

        .channels-page__search {
          flex: 0 0 328px;
          display: flex;
          align-items: center;
          gap: 12px;
          height: 48px;
          padding: 0 14px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            0 8px 24px rgba(15, 23, 42, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.86);
          color: #6b7280;
        }

        .channels-page__search input {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          font-size: 14px;
          color: #111827;
        }

        .channels-page__search input::placeholder {
          color: #9aa3b0;
        }

        .channels-page__section-title {
          margin: 0 0 16px;
          font-size: 15px;
          font-weight: 600;
          color: #202632;
          letter-spacing: -0.02em;
        }

        .channels-page__grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 18px;
        }

        .channels-page__card {
          position: relative;
          min-height: 240px;
          display: flex;
          flex-direction: column;
          padding: 16px 16px 12px;
          border-radius: 20px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            0 14px 34px rgba(15, 23, 42, 0.05),
            inset 0 1px 0 rgba(255, 255, 255, 0.84);
          overflow: hidden;
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .channels-page__card:hover {
          transform: translateY(-4px);
          border-color: rgba(15, 23, 42, 0.12);
          box-shadow:
            0 22px 44px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.88);
        }

        .channels-page__card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent 46%);
        }

        .channels-page__card-glow {
          position: absolute;
          right: -18px;
          top: -18px;
          width: 170px;
          height: 170px;
          border-radius: 999px;
          filter: blur(16px);
          opacity: 0.9;
          pointer-events: none;
        }

        .channels-page__card--green .channels-page__card-glow {
          background: radial-gradient(circle, rgba(34, 197, 94, 0.10), transparent 72%);
        }

        .channels-page__card--blue .channels-page__card-glow {
          background: radial-gradient(circle, rgba(59, 130, 246, 0.10), transparent 72%);
        }

        .channels-page__card--pink .channels-page__card-glow {
          background: radial-gradient(circle, rgba(236, 72, 153, 0.10), transparent 72%);
        }

        .channels-page__card--amber .channels-page__card-glow {
          background: radial-gradient(circle, rgba(245, 158, 11, 0.10), transparent 72%);
        }

        .channels-page__card--sky .channels-page__card-glow {
          background: radial-gradient(circle, rgba(14, 165, 233, 0.10), transparent 72%);
        }

        .channels-page__card--slate .channels-page__card-glow {
          background: radial-gradient(circle, rgba(100, 116, 139, 0.09), transparent 72%);
        }

        .channels-page__card--graphite .channels-page__card-glow {
          background: radial-gradient(circle, rgba(71, 85, 105, 0.09), transparent 72%);
        }

        .channels-page__card--violet .channels-page__card-glow {
          background: radial-gradient(circle, rgba(139, 92, 246, 0.09), transparent 72%);
        }

        .channels-page__card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .channels-page__badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: -0.01em;
          border: 1px solid transparent;
        }

        .channels-page__badge--popular {
          color: #16a34a;
          background: rgba(34, 197, 94, 0.10);
          border-color: rgba(34, 197, 94, 0.16);
        }

        .channels-page__badge--setup {
          color: #b86814;
          background: rgba(245, 158, 11, 0.10);
          border-color: rgba(245, 158, 11, 0.16);
        }

        .channels-page__badge--live {
          color: #0f9a72;
          background: rgba(16, 185, 129, 0.10);
          border-color: rgba(16, 185, 129, 0.16);
        }

        .channels-page__badge--connected {
          color: #2563eb;
          background: rgba(37, 99, 235, 0.10);
          border-color: rgba(37, 99, 235, 0.16);
        }

        .channels-page__badge--neutral {
          color: #6b7280;
          background: rgba(107, 114, 128, 0.08);
          border-color: rgba(107, 114, 128, 0.13);
        }

        .channels-page__icon-shell {
          width: 58px;
          height: 58px;
          flex: 0 0 58px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.92) 100%);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 10px 22px rgba(15, 23, 42, 0.05);
          color: #18212d;
        }

        .channels-page__icon-image {
          width: 36px;
          height: 36px;
          object-fit: contain;
          display: block;
        }

        .channels-page__card-body {
          flex: 1 1 auto;
          min-height: 0;
        }

        .channels-page__card-body h3 {
          margin: 0;
          font-size: 21px;
          line-height: 1.12;
          letter-spacing: -0.04em;
          color: #202632;
          font-weight: 700;
        }

        .channels-page__card-body p {
          margin: 12px 0 0;
          max-width: 92%;
          font-size: 14px;
          line-height: 1.58;
          color: #697586;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .channels-page__card-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(15, 23, 42, 0.07);
        }

        .channels-page__action {
          height: 38px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.10);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.94) 100%);
          color: #202632;
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease;
        }

        .channels-page__action:hover {
          transform: translateY(-1px);
          border-color: rgba(15, 23, 42, 0.15);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }

        .channels-page__empty {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.92);
          color: #6b7280;
          font-size: 14px;
        }

        @media (max-width: 1100px) {
          .channels-page__toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .channels-page__search {
            flex: 0 0 auto;
            width: 100%;
          }
        }

        @media (max-width: 720px) {
          .channels-page {
            padding: 2px 0 20px;
          }

          .channels-page__tabs {
            gap: 18px;
          }

          .channels-page__tab {
            font-size: 14px;
            padding-bottom: 10px;
          }

          .channels-page__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="channels-page">
        <div className="channels-page__toolbar">
          <div className="channels-page__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={[
                  "channels-page__tab",
                  activeTab === tab.id ? "channels-page__tab--active" : "",
                ].join(" ")}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="channels-page__search">
            <Search size={20} strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Channel Catalog"
            />
          </label>
        </div>

        <h2 className="channels-page__section-title">
          {resolveSectionTitle(activeTab)}
        </h2>

        {visibleChannels.length ? (
          <div className="channels-page__grid">
            {visibleChannels.map((item) => (
              <ChannelCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="channels-page__empty">
            Nothing matched your search.
          </div>
        )}
      </div>
    </>
  );
}