// src/pages/Contact.tsx
import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DEFAULT_LANG, LANGS, type Lang } from "../i18n/lang";

type Status = "idle" | "loading" | "success" | "error";

function isLang(value: string | undefined | null): value is Lang {
  if (!value) return false;
  return (LANGS as readonly string[]).includes(value);
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function useLocalizedPath() {
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang = isLang(paramLang) ? paramLang : DEFAULT_LANG;

  return (path: string) => {
    if (path === "/") return `/${lang}`;
    return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
  };
}

const PROD_BACKEND_FALLBACK = "https://neox-backend-production.up.railway.app";
const API_BASE_RAW =
  ((globalThis as any)?.__NEOX_API__ as string | undefined) ||
  (import.meta as any)?.env?.VITE_API_BASE ||
  PROD_BACKEND_FALLBACK;

const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "");

const contactEmail = "info@weneox.com";
const contactPhone = "+994 51 800 55 77";
const whatsappNumber = "994518005577";

const contactMethods = [
  {
    title: "Email",
    value: contactEmail,
    href: `mailto:${contactEmail}`,
    icon: Mail,
  },
  {
    title: "Telefon",
    value: contactPhone,
    href: `tel:${contactPhone.replace(/\s+/g, "")}`,
    icon: Phone,
  },
  {
    title: "WhatsApp",
    value: "Birbaşa yazın",
    href: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      "Salam, NEOX xidmətləri haqqında məlumat almaq istəyirəm."
    )}`,
    icon: MessageCircle,
  },
];

const projectTypes = [
  "Premium vebsayt",
  "Süni İntellekt cavab sistemi",
  "Biznes avtomatlaşdırması",
  "Sosial media sistemi",
  "Tam xüsusi sistem",
];

const expectations = [
  "Qısa danışıqla ehtiyac aydınlaşdırılır",
  "Uyğun sistem xəritəsi çıxarılır",
  "Scope və icra mərhələləri razılaşdırılır",
  "Sonra dizayn və qurulum başlayır",
];

export default function Contact() {
  const withLang = useLocalizedPath();
  const location = useLocation();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    projectType: projectTypes[0],
    message: "",
    website: "",
  });

  const whatsappHref = useMemo(() => {
    const text = clean(formData.message)
      ? `Salam, mən ${clean(formData.name) || "NEOX saytından yazıram"}. ${clean(formData.message)}`
      : "Salam, NEOX xidmətləri haqqında məlumat almaq istəyirəm.";

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  }, [formData.message, formData.name]);

  const nameOk = clean(formData.name).length >= 2;
  const emailOk = isValidEmail(clean(formData.email));
  const messageOk = clean(formData.message).length >= 10;

  const canSubmit = status !== "loading" && nameOk && emailOk && messageOk;

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (status === "error") {
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    if (formData.website) {
      setStatus("success");
      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        projectType: projectTypes[0],
        message: "",
        website: "",
      });
      return;
    }

    if (!canSubmit) {
      setStatus("error");
      setErrorMessage("Ad, email və mesaj hissələrini düzgün doldurun.");
      return;
    }

    setStatus("loading");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const payload = {
        name: clean(formData.name),
        email: clean(formData.email),
        company: clean(formData.company),
        phone: clean(formData.phone),
        projectType: formData.projectType,
        message: clean(formData.message),
        source: "contact",
        page: location.pathname,
      };

      const response = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("contact_request_failed");
      }

      setStatus("success");
      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        projectType: projectTypes[0],
        message: "",
        website: "",
      });
    } catch {
      setStatus("error");
      setErrorMessage("Mesaj göndərilmədi. WhatsApp və ya email ilə yazmağınız daha sürətli olar.");
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Əlaqə</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Biznesiniz üçün <span className="nx-gradient-text">uyğun sistemi</span> danışaq.
                </h1>

                <p className="nx-lead nx-max-copy">
                  Qısa yazın: nə edirsiniz, müştərilər sizə haradan yazır və hazırda hansı proses sizi
                  yavaşladır. Biz uyğun veb, Süni İntellekt və avtomatlaşdırma xəritəsini çıxaraq.
                </p>
              </div>

              <div className="nx-actions">
                <a href={whatsappHref} className="nx-button nx-button--primary" target="_blank" rel="noreferrer">
                  WhatsApp-da yaz
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </a>

                <a href={`mailto:${contactEmail}`} className="nx-button">
                  Email göndər
                </a>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Premium vebsayt</span>
                <span className="nx-chip">Süni İntellekt cavab sistemi</span>
                <span className="nx-chip">Avtomatlaşdırma</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <div className="nx-hero-panel">
                <div className="nx-hero-panel-inner">
                  <form className="nx-form" onSubmit={handleSubmit}>
                    <div className="nx-row nx-row--top">
                      <div className="nx-stack-xs">
                        <span className="nx-badge nx-badge--soft">
                          <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                          Sürətli brif
                        </span>
                        <h2 className="nx-h3">Layihəni qısa izah edin</h2>
                      </div>

                      <span className="nx-badge nx-badge--plain">24 saat</span>
                    </div>

                    <div className="nx-contact-grid">
                      <label className="nx-field">
                        <span className="nx-label">Adınız</span>
                        <input
                          className="nx-input"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Adınızı yazın"
                          autoComplete="name"
                        />
                      </label>

                      <label className="nx-field">
                        <span className="nx-label">Email</span>
                        <input
                          className="nx-input"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="email@example.com"
                          autoComplete="email"
                        />
                      </label>
                    </div>

                    <div className="nx-contact-grid">
                      <label className="nx-field">
                        <span className="nx-label">Şirkət</span>
                        <input
                          className="nx-input"
                          name="company"
                          value={formData.company}
                          onChange={handleChange}
                          placeholder="Şirkət adı"
                          autoComplete="organization"
                        />
                      </label>

                      <label className="nx-field">
                        <span className="nx-label">Telefon</span>
                        <input
                          className="nx-input"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+994"
                          autoComplete="tel"
                        />
                      </label>
                    </div>

                    <label className="nx-field">
                      <span className="nx-label">Layihə tipi</span>
                      <select
                        className="nx-select"
                        name="projectType"
                        value={formData.projectType}
                        onChange={handleChange}
                      >
                        {projectTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="nx-field">
                      <span className="nx-label">Nə qurmaq istəyirsiniz?</span>
                      <textarea
                        className="nx-textarea"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Məsələn: klinikam üçün sayt, Instagram mesajlarına cavab sistemi və appointment axını istəyirəm..."
                      />
                    </label>

                    <label className="nx-honeypot" aria-hidden="true">
                      Website
                      <input
                        tabIndex={-1}
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        autoComplete="off"
                      />
                    </label>

                    {status === "success" ? (
                      <div className="nx-status nx-status--success" role="status">
                        <CheckCircle2 size={18} strokeWidth={2} aria-hidden="true" />
                        <span>Mesaj alındı. Tezliklə sizinlə əlaqə saxlayacağıq.</span>
                      </div>
                    ) : null}

                    {status === "error" ? (
                      <div className="nx-status nx-status--error" role="alert">
                        <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />
                        <span>{errorMessage}</span>
                      </div>
                    ) : null}

                    <button className="nx-button nx-button--primary nx-button--full" type="submit" disabled={status === "loading"}>
                      {status === "loading" ? "Göndərilir..." : "Mesaj göndər"}
                      <Send size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-grid nx-grid--3">
            {contactMethods.map((method) => {
              const Icon = method.icon;

              return (
                <a key={method.title} href={method.href} className="nx-card nx-card--link nx-card--quiet">
                  <div className="nx-row nx-row--top">
                    <span className="nx-badge nx-badge--soft nx-badge--plain">
                      <Icon size={16} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <ArrowUpRight size={16} strokeWidth={1.9} className="nx-muted" aria-hidden="true" />
                  </div>

                  <div className="nx-stack-xs">
                    <h2 className="nx-h4">{method.title}</h2>
                    <p className="nx-copy-sm">{method.value}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Necə başlayırıq?</p>
                <h2 className="nx-title">Qısa məlumat, aydın xəritə, sonra icra.</h2>
                <p className="nx-lead">
                  İlk danışıqda sizdən uzun texniki sənəd istəmirik. Biznesin reallığını anlayırıq,
                  sonra hansı səthin, hansı avtomatlaşdırmanın və hansı Süni İntellekt cavab sisteminin lazım olduğunu çıxarırıq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button nx-button--ghost">
                  Xidmətlər
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-surface nx-surface--soft nx-surface-pad">
              <div className="nx-stack">
                <div className="nx-row nx-row--top">
                  <div className="nx-stack-xs">
                    <span className="nx-badge nx-badge--soft">
                      <Clock3 size={15} strokeWidth={2} aria-hidden="true" />
                      İlk mərhələ
                    </span>
                    <h3 className="nx-h3">Danışıqdan sonra nə olur?</h3>
                  </div>
                </div>

                <ul className="nx-list">
                  {expectations.map((item) => (
                    <li key={item} className="nx-list-item">
                      {item}
                    </li>
                  ))}
                </ul>

                <hr className="nx-divider" />

                <p className="nx-copy-sm">
                  Məqsəd: sizə artıq panel və artıq funksiya satmaq yox, biznesinizə uyğun ən təmiz başlanğıc sistemini seçməkdir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last nx-section-divider">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">Sürətli seçim</span>

                <h2 className="nx-title-sm">Uzun form doldurmaq istəmirsiniz?</h2>

                <p className="nx-lead">
                  WhatsApp-da sadəcə biznesinizi bir cümlə ilə yazın. Qalan sualları biz düzgün şəkildə verəcəyik.
                </p>
              </div>

              <div className="nx-actions">
                <a href={whatsappHref} className="nx-button nx-button--primary nx-button--full" target="_blank" rel="noreferrer">
                  WhatsApp-da başla
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </a>

                <a href={`mailto:${contactEmail}`} className="nx-button nx-button--full">
                  Email ilə yaz
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}