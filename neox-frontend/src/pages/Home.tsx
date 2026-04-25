// src/pages/Home.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Layers3,
  LineChart,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && ["az", "en", "tr", "ru", "es"].includes(value));
}

function withLang(path: string, lang: Lang) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

const tickerItems = [
  "Instagram və WhatsApp cavab axınları",
  "Sayt çatbotu və lead toplama",
  "Müştəri sorğularının ağıllı yönləndirilməsi",
  "Görüş və rezervasiya xatırlatmaları",
  "Satış sonrası follow-up sistemləri",
  "FAQ və dəstək cavabları",
  "CRM və inbox inteqrasiyaları",
  "Daxili tapşırıq və təsdiq axınları",
  "Premium landing page və veb interfeyslər",
  "Süni İntellekt əsaslı biznes köməkçiləri",
];

const services = [
  {
    icon: MessageSquare,
    title: "Müştəri mesajları",
    text: "Instagram, WhatsApp və sayt mesajlarını bir sistemdə toplayır, sürətli cavab və lead axını qururuq.",
  },
  {
    icon: Workflow,
    title: "Biznes avtomatlaşdırması",
    text: "Təkrarlanan işləri, yönləndirmələri, təsdiqləri və daxili prosesləri daha ağıllı axına çeviririk.",
  },
  {
    icon: Globe2,
    title: "Premium veb saytlar",
    text: "Brendə uyğun, sürətli, müasir və satışa yönəlmiş veb təcrübələr hazırlayırıq.",
  },
  {
    icon: Smartphone,
    title: "Mobil tətbiqlər",
    text: "Müştəri və komanda üçün sadə, təmiz və real iş prosesinə bağlı tətbiq interfeysləri qururuq.",
  },
  {
    icon: Megaphone,
    title: "Sosial media sistemləri",
    text: "Kontent, cavab, lead və kampaniya axınlarını daha sistemli idarə etmək üçün struktur yaradırıq.",
  },
  {
    icon: Wrench,
    title: "Texniki dəstək",
    text: "Qurulan sistemlərin işlək qalması, optimallaşdırılması və inkişafı üçün davamlı dəstək veririk.",
  },
];

const steps = [
  {
    number: "01",
    title: "Biznesi anlayırıq",
    text: "Müştəri axınlarını, satış prosesini, xidmətləri və komandanın gündəlik işini analiz edirik.",
  },
  {
    number: "02",
    title: "Sistemi dizayn edirik",
    text: "Mesaj, lead, cavab, yönləndirmə, CRM və daxili iş axınlarının necə işləyəcəyini planlayırıq.",
  },
  {
    number: "03",
    title: "Qurur və qoşuruq",
    text: "Veb sayt, çatbot, inbox, avtomatlaşdırma və inteqrasiyaları real iş sisteminə çeviririk.",
  },
  {
    number: "04",
    title: "Ölçür və inkişaf etdiririk",
    text: "Cavab sürəti, lead keyfiyyəti, satış nəticəsi və sistem performansını izləyib optimallaşdırırıq.",
  },
];

const outcomes = [
  "Müştəri mesajlarına daha sürətli cavab",
  "Daha səliqəli lead toplama və yönləndirmə",
  "Daha az manual iş və təkrar əməliyyat",
  "Satış, dəstək və əməliyyatlarda vahid sistem",
];

const tickerTrack = [...tickerItems, ...tickerItems];

export default function Home() {
  const { lang: routeLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(routeLang) ? routeLang : DEFAULT_LANG;

  return (
    <>
      <style>{`
        .home-page{
          background:var(--nx-canvas);
          color:var(--nx-ink);
          overflow-x:hidden;
        }

        .home-heroShell{
          min-height:100vh;
          padding-top:var(--nx-header-h);
          background:var(--nx-night);
        }

        .home-hero{
          position:relative;
          min-height:calc(100svh - var(--nx-header-h));
          display:grid;
          grid-template-rows:1fr auto;
          overflow:hidden;
          background:var(--nx-night);
        }

        .home-heroBg{
          position:absolute;
          inset:0;
          z-index:0;
          background:
            radial-gradient(circle at 18% 20%, rgba(49,72,199,.16), transparent 34%),
            radial-gradient(circle at 78% 16%, rgba(49,72,199,.08), transparent 30%),
            linear-gradient(180deg, #091427 0%, #07111f 100%);
        }

        .home-heroBg::after{
          content:"";
          position:absolute;
          inset:0;
          background:
            linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,0) 36%),
            linear-gradient(90deg, rgba(255,255,255,.016), rgba(255,255,255,0) 42%);
          opacity:.9;
        }

        .home-heroMain{
          position:relative;
          z-index:2;
          display:flex;
          align-items:center;
        }

        .home-heroContent{
          width:min(760px,100%);
          padding:40px 0 32px;
        }

        .home-heroKicker{
          display:inline-flex;
          align-items:center;
          min-height:38px;
          padding:0 14px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(255,255,255,.025);
          color:rgba(255,255,255,.86);
          font-size:12px;
          font-weight:720;
          letter-spacing:.16em;
          text-transform:uppercase;
          backdrop-filter:blur(10px);
          -webkit-backdrop-filter:blur(10px);
        }

        .home-heroTitle{
          margin:26px 0 0;
          max-width:860px;
          color:#fff;
          font-size:clamp(48px,7vw,94px);
          line-height:.96;
          letter-spacing:-.065em;
          font-weight:760;
          text-wrap:balance;
        }

        .home-heroSub{
          margin:24px 0 0;
          max-width:650px;
          color:rgba(255,255,255,.76);
          font-size:18px;
          line-height:1.68;
          font-weight:440;
          letter-spacing:-.02em;
        }

        .home-actions{
          display:flex;
          align-items:center;
          gap:14px;
          flex-wrap:wrap;
          margin-top:30px;
        }

        .home-tickerWrap{
          position:relative;
          z-index:3;
          background:
            linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.012)),
            rgba(3,10,22,.32);
          backdrop-filter:blur(14px);
          -webkit-backdrop-filter:blur(14px);
        }

        .home-tickerBar{
          position:relative;
          overflow:hidden;
          padding:18px 0;
        }

        .home-tickerTrack{
          display:inline-flex;
          align-items:center;
          gap:34px;
          width:max-content;
          white-space:nowrap;
          animation:nx-marquee 36s linear infinite;
          will-change:transform;
        }

        .home-tickerItem{
          color:rgba(255,255,255,.72);
          font-size:14px;
          line-height:1;
          font-weight:520;
          letter-spacing:-.01em;
        }

        .home-tickerFade{
          position:absolute;
          top:0;
          bottom:0;
          width:92px;
          z-index:2;
          pointer-events:none;
        }

        .home-tickerFade.left{
          left:0;
          background:linear-gradient(90deg,#07111f 0%,rgba(7,17,31,0) 100%);
        }

        .home-tickerFade.right{
          right:0;
          background:linear-gradient(270deg,#07111f 0%,rgba(7,17,31,0) 100%);
        }

        .home-intro{
          background:
            radial-gradient(circle at 18% 0%, rgba(49,72,199,.055), transparent 30%),
            linear-gradient(180deg,#fbfcfe 0%,#fff 100%);
        }

        .home-introGrid{
          display:grid;
          grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);
          gap:clamp(36px,7vw,112px);
          align-items:start;
        }

        .home-eyebrow{
          margin:0;
          color:var(--nx-soft);
          font-size:11px;
          line-height:1;
          font-weight:760;
          letter-spacing:.2em;
          text-transform:uppercase;
        }

        .home-sectionTitle{
          margin:16px 0 0;
          color:var(--nx-ink);
          font-size:clamp(34px,4.8vw,66px);
          line-height:1;
          font-weight:720;
          letter-spacing:-.058em;
          text-wrap:balance;
        }

        .home-sectionText{
          margin:0;
          color:var(--nx-muted);
          font-size:18px;
          line-height:1.62;
          font-weight:440;
          letter-spacing:-.025em;
        }

        .home-proofGrid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:14px;
        }

        .home-proof{
          min-height:132px;
          padding:22px;
          border-radius:22px;
          border:1px solid var(--nx-line-soft);
          background:rgba(255,255,255,.72);
          box-shadow:0 14px 34px rgba(13,20,32,.045);
          display:grid;
          align-content:space-between;
          gap:20px;
        }

        .home-proofIcon{
          width:38px;
          height:38px;
          border-radius:14px;
          display:flex;
          align-items:center;
          justify-content:center;
          color:var(--nx-blue);
          background:var(--nx-blue-soft);
        }

        .home-proofText{
          margin:0;
          color:var(--nx-text);
          font-size:15px;
          line-height:1.45;
          font-weight:560;
          letter-spacing:-.02em;
        }

        .home-services{
          background:#fff;
        }

        .home-sectionHead{
          display:flex;
          justify-content:space-between;
          align-items:end;
          gap:32px;
          margin-bottom:34px;
        }

        .home-sectionHeadText{
          max-width:720px;
        }

        .home-sectionHeadCopy{
          max-width:420px;
          margin:0;
          color:var(--nx-muted);
          font-size:16px;
          line-height:1.62;
          font-weight:440;
          letter-spacing:-.018em;
        }

        .home-serviceGrid{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          border-top:1px solid var(--nx-line);
          border-left:1px solid var(--nx-line);
        }

        .home-serviceCard{
          min-height:270px;
          padding:28px;
          border-right:1px solid var(--nx-line);
          border-bottom:1px solid var(--nx-line);
          background:#fff;
          display:grid;
          align-content:space-between;
          gap:28px;
          transition:
            background var(--nx-fast) ease,
            transform var(--nx-fast) var(--nx-ease);
        }

        .home-serviceCard:hover{
          background:#fbfcff;
          transform:translateY(-2px);
        }

        .home-serviceTop{
          display:grid;
          gap:18px;
        }

        .home-serviceIcon{
          width:42px;
          height:42px;
          border-radius:16px;
          display:flex;
          align-items:center;
          justify-content:center;
          color:var(--nx-blue);
          background:var(--nx-blue-soft);
        }

        .home-serviceTitle{
          margin:0;
          color:var(--nx-ink);
          font-size:22px;
          line-height:1.08;
          font-weight:690;
          letter-spacing:-.045em;
        }

        .home-serviceText{
          margin:0;
          color:var(--nx-muted);
          font-size:15px;
          line-height:1.58;
          font-weight:430;
          letter-spacing:-.018em;
        }

        .home-serviceLink{
          width:max-content;
          display:inline-flex;
          align-items:center;
          gap:8px;
          color:var(--nx-blue);
          font-size:14px;
          font-weight:650;
          letter-spacing:-.02em;
        }

        .home-system{
          background:
            radial-gradient(circle at 80% 8%, rgba(49,72,199,.06), transparent 30%),
            #fbfcfe;
        }

        .home-systemGrid{
          display:grid;
          grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);
          gap:clamp(34px,7vw,104px);
          align-items:center;
        }

        .home-steps{
          display:grid;
          gap:12px;
        }

        .home-step{
          display:grid;
          grid-template-columns:58px minmax(0,1fr);
          gap:18px;
          padding:20px;
          border-radius:22px;
          border:1px solid var(--nx-line-soft);
          background:rgba(255,255,255,.78);
          box-shadow:0 12px 30px rgba(13,20,32,.035);
        }

        .home-stepNumber{
          color:var(--nx-blue);
          font-size:13px;
          font-weight:760;
          letter-spacing:.12em;
        }

        .home-stepTitle{
          margin:0;
          color:var(--nx-ink);
          font-size:18px;
          line-height:1.15;
          font-weight:690;
          letter-spacing:-.035em;
        }

        .home-stepText{
          margin:7px 0 0;
          color:var(--nx-muted);
          font-size:14px;
          line-height:1.55;
          font-weight:430;
          letter-spacing:-.015em;
        }

        .home-panel{
          min-height:520px;
          padding:30px;
          border-radius:28px;
          background:
            radial-gradient(circle at 18% 14%, rgba(255,255,255,.09), transparent 28%),
            linear-gradient(180deg,#101b30 0%,#081426 100%);
          color:#fff;
          box-shadow:0 24px 70px rgba(13,20,32,.18);
          display:grid;
          align-content:space-between;
          overflow:hidden;
          position:relative;
        }

        .home-panel::before{
          content:"";
          position:absolute;
          inset:auto -18% -30% 20%;
          height:260px;
          background:radial-gradient(circle, rgba(49,72,199,.34), transparent 62%);
          pointer-events:none;
        }

        .home-panelTop{
          position:relative;
          z-index:1;
          display:grid;
          gap:18px;
        }

        .home-panelBadge{
          width:max-content;
          display:inline-flex;
          align-items:center;
          gap:8px;
          min-height:34px;
          padding:0 12px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,.12);
          color:rgba(255,255,255,.78);
          font-size:12px;
          font-weight:620;
          letter-spacing:-.01em;
        }

        .home-panelTitle{
          margin:0;
          max-width:440px;
          color:#fff;
          font-size:clamp(30px,3.5vw,48px);
          line-height:1.02;
          font-weight:700;
          letter-spacing:-.055em;
          text-wrap:balance;
        }

        .home-panelList{
          position:relative;
          z-index:1;
          display:grid;
          gap:12px;
        }

        .home-panelItem{
          display:flex;
          align-items:center;
          gap:12px;
          color:rgba(255,255,255,.78);
          font-size:15px;
          line-height:1.35;
          font-weight:450;
        }

        .home-panelItem svg{
          color:#9fb0ff;
          flex:0 0 auto;
        }

        .home-usecases{
          background:#fff;
        }

        .home-usecaseGrid{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:14px;
        }

        .home-usecase{
          min-height:178px;
          padding:22px;
          border-radius:22px;
          border:1px solid var(--nx-line-soft);
          background:#fff;
          box-shadow:0 12px 30px rgba(13,20,32,.035);
          display:grid;
          align-content:space-between;
          gap:24px;
        }

        .home-usecase span{
          color:var(--nx-soft);
          font-size:11px;
          font-weight:760;
          letter-spacing:.16em;
          text-transform:uppercase;
        }

        .home-usecase h3{
          margin:0;
          color:var(--nx-ink);
          font-size:21px;
          line-height:1.1;
          font-weight:690;
          letter-spacing:-.045em;
        }

        .home-usecase p{
          margin:8px 0 0;
          color:var(--nx-muted);
          font-size:14px;
          line-height:1.52;
          font-weight:430;
          letter-spacing:-.015em;
        }

        .home-final{
          background:var(--nx-night);
          color:#fff;
        }

        .home-finalBox{
          position:relative;
          overflow:hidden;
          min-height:420px;
          border-radius:32px;
          padding:clamp(28px,5vw,58px);
          background:
            radial-gradient(circle at 82% 18%, rgba(72,98,255,.28), transparent 34%),
            linear-gradient(135deg,#101b30 0%,#07111f 72%);
          box-shadow:0 24px 80px rgba(0,0,0,.22);
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:32px;
          align-items:end;
        }

        .home-finalCopy{
          max-width:760px;
          position:relative;
          z-index:1;
        }

        .home-finalTitle{
          margin:16px 0 0;
          color:#fff;
          font-size:clamp(38px,5.6vw,78px);
          line-height:.98;
          font-weight:730;
          letter-spacing:-.065em;
          text-wrap:balance;
        }

        .home-finalText{
          margin:22px 0 0;
          max-width:620px;
          color:rgba(255,255,255,.72);
          font-size:18px;
          line-height:1.62;
          font-weight:430;
          letter-spacing:-.02em;
        }

        .home-finalActions{
          position:relative;
          z-index:1;
          display:flex;
          align-items:center;
          gap:12px;
          flex-wrap:wrap;
        }

        @media (prefers-reduced-motion:reduce){
          .home-tickerTrack{
            animation:none;
          }
        }

        @media (max-width:1100px){
          .home-serviceGrid{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          .home-usecaseGrid{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          .home-finalBox{
            grid-template-columns:1fr;
            align-items:start;
          }
        }

        @media (max-width:900px){
          .home-introGrid,
          .home-systemGrid{
            grid-template-columns:1fr;
          }

          .home-sectionHead{
            align-items:start;
            flex-direction:column;
          }
        }

        @media (max-width:760px){
          .home-hero{
            min-height:calc(100svh - var(--nx-header-h));
          }

          .home-heroContent{
            padding:28px 0 20px;
          }

          .home-heroTitle{
            font-size:clamp(40px,12vw,62px);
            line-height:.98;
          }

          .home-heroSub{
            font-size:15px;
            line-height:1.7;
          }

          .home-actions,
          .home-finalActions{
            display:grid;
            gap:10px;
          }

          .home-tickerBar{
            padding:15px 0;
          }

          .home-tickerTrack{
            gap:24px;
          }

          .home-tickerItem{
            font-size:12px;
          }

          .home-tickerFade{
            width:36px;
          }

          .home-proofGrid,
          .home-serviceGrid,
          .home-usecaseGrid{
            grid-template-columns:1fr;
          }

          .home-serviceCard{
            min-height:220px;
          }

          .home-step{
            grid-template-columns:1fr;
          }
        }
      `}</style>

      <main className="home-page">
        <section className="home-heroShell">
          <div className="home-hero">
            <div className="home-heroBg" />

            <div className="home-heroMain">
              <div className="nx-container">
                <div className="home-heroContent">
                  <div className="home-heroKicker">Süni İntellekt sistemləri</div>

                  <h1 className="home-heroTitle">
                    Müştəri mesajlarından satışa qədər işləyən sistemlər qururuq.
                  </h1>

                  <p className="home-heroSub">
                    NEOX biznesiniz üçün çatbot, veb sayt, lead toplama və daxili iş axınlarını bir
                    sistemdə birləşdirir — daha sürətli cavab, daha az manual iş, daha aydın nəticə.
                  </p>

                  <div className="home-actions">
                    <Link to={withLang("/contact", lang)} className="nx-btn nx-btn-light nx-btn-lg">
                      Əlaqə saxla
                      <ArrowUpRight size={18} />
                    </Link>

                    <Link to={withLang("/services", lang)} className="nx-btn nx-btn-ghost-dark nx-btn-lg">
                      Xidmətlərə bax
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="home-tickerWrap">
              <div className="home-tickerBar">
                <div className="home-tickerFade left" />
                <div className="home-tickerFade right" />

                <div className="home-tickerTrack">
                  {tickerTrack.map((item, index) => (
                    <span key={`${item}-${index}`} className="home-tickerItem">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-intro nx-section">
          <div className="nx-container">
            <div className="home-introGrid">
              <div>
                <p className="home-eyebrow">Nə edirik?</p>
                <h2 className="home-sectionTitle">
                  Biz sadəcə sayt yox, biznesin işləyən rəqəmsal sistemini qururuq.
                </h2>
              </div>

              <div className="nx-stack-lg">
                <p className="home-sectionText">
                  Müştəri yazır, sistem anlayır, cavab verir, lead yaradır, lazım olduqda komandaya
                  ötürür və prosesin izini saxlayır. Məqsəd sadədir: biznesiniz daha sürətli,
                  daha səliqəli və daha ölçülə bilən işləsin.
                </p>

                <div className="home-proofGrid">
                  <div className="home-proof">
                    <div className="home-proofIcon">
                      <Sparkles size={20} strokeWidth={1.9} />
                    </div>
                    <p className="home-proofText">Süni İntellekt köməkçiləri biznes məlumatınıza uyğun cavab verir.</p>
                  </div>

                  <div className="home-proof">
                    <div className="home-proofIcon">
                      <Layers3 size={20} strokeWidth={1.9} />
                    </div>
                    <p className="home-proofText">Veb sayt, inbox, CRM və iş axınları vahid sistem kimi işləyir.</p>
                  </div>

                  <div className="home-proof">
                    <div className="home-proofIcon">
                      <ShieldCheck size={20} strokeWidth={1.9} />
                    </div>
                    <p className="home-proofText">Avtomatlaşdırma nəzarətli olur: qayda, yönləndirmə və handoff ilə.</p>
                  </div>

                  <div className="home-proof">
                    <div className="home-proofIcon">
                      <LineChart size={20} strokeWidth={1.9} />
                    </div>
                    <p className="home-proofText">Cavab sürəti, lead keyfiyyəti və proses nəticələri ölçülə bilir.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-services nx-section">
          <div className="nx-container">
            <div className="home-sectionHead">
              <div className="home-sectionHeadText">
                <p className="home-eyebrow">Xidmətlər</p>
                <h2 className="home-sectionTitle">Bir-birindən ayrı alətlər yox, bir sistem.</h2>
              </div>

              <p className="home-sectionHeadCopy">
                Hər xidmət tək başına yox, biznesinizin real axınına bağlananda dəyər yaradır.
              </p>
            </div>

            <div className="home-serviceGrid">
              {services.map((service) => {
                const Icon = service.icon;

                return (
                  <article className="home-serviceCard" key={service.title}>
                    <div className="home-serviceTop">
                      <div className="home-serviceIcon">
                        <Icon size={21} strokeWidth={1.9} />
                      </div>

                      <div>
                        <h3 className="home-serviceTitle">{service.title}</h3>
                        <p className="home-serviceText">{service.text}</p>
                      </div>
                    </div>

                    <Link to={withLang("/services", lang)} className="home-serviceLink">
                      Ətraflı bax
                      <ArrowUpRight size={15} strokeWidth={2} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-system nx-section">
          <div className="nx-container">
            <div className="home-systemGrid">
              <div>
                <p className="home-eyebrow">Proses</p>
                <h2 className="home-sectionTitle">Səliqəli analiz, düzgün qurulum, davamlı inkişaf.</h2>
                <p className="home-sectionText" style={{ marginTop: 22 }}>
                  Biz sistemi hazır şablon kimi qurmuruq. Əvvəl biznesin necə işlədiyini anlayırıq,
                  sonra ona uyğun rəqəmsal axın dizayn edirik.
                </p>
              </div>

              <div className="home-steps">
                {steps.map((step) => (
                  <article className="home-step" key={step.number}>
                    <div className="home-stepNumber">{step.number}</div>
                    <div>
                      <h3 className="home-stepTitle">{step.title}</h3>
                      <p className="home-stepText">{step.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="home-system nx-section-tight">
          <div className="nx-container">
            <div className="home-panel">
              <div className="home-panelTop">
                <div className="home-panelBadge">
                  <CheckCircle2 size={15} strokeWidth={2} />
                  Nəticə yönümlü qurulum
                </div>

                <h2 className="home-panelTitle">
                  Sistemin məqsədi gözəl görünmək yox, gündəlik işi yüngülləşdirməkdir.
                </h2>
              </div>

              <div className="home-panelList">
                {outcomes.map((item) => (
                  <div className="home-panelItem" key={item}>
                    <CheckCircle2 size={18} strokeWidth={2} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="home-usecases nx-section">
          <div className="nx-container">
            <div className="home-sectionHead">
              <div className="home-sectionHeadText">
                <p className="home-eyebrow">Kimlər üçün?</p>
                <h2 className="home-sectionTitle">Müştəri axını olan hər biznes üçün.</h2>
              </div>

              <p className="home-sectionHeadCopy">
                Xidmət, satış, rezervasiya, dəstək və sorğu qəbul edən bizneslər üçün sistemlər qururuq.
              </p>
            </div>

            <div className="home-usecaseGrid">
              <article className="home-usecase">
                <span>Klinikalar</span>
                <div>
                  <h3>Rezervasiya və pasiyent mesajları</h3>
                  <p>Görüş sorğuları, qiymət sualları və xatırlatmalar daha səliqəli idarə olunur.</p>
                </div>
              </article>

              <article className="home-usecase">
                <span>Mağazalar</span>
                <div>
                  <h3>Sifariş və məhsul sorğuları</h3>
                  <p>Instagram və WhatsApp mesajları lead və satış axınına çevrilir.</p>
                </div>
              </article>

              <article className="home-usecase">
                <span>Xidmət biznesləri</span>
                <div>
                  <h3>Qiymət, müraciət və follow-up</h3>
                  <p>Müştəri sorğuları itmir, hər müraciət düzgün mərhələyə yönləndirilir.</p>
                </div>
              </article>

              <article className="home-usecase">
                <span>Komandalar</span>
                <div>
                  <h3>Daxili iş axınları</h3>
                  <p>Təkrarlanan əməliyyatlar, təsdiqlər və tapşırıqlar avtomatlaşdırılır.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="home-final nx-section">
          <div className="nx-container">
            <div className="home-finalBox">
              <div className="home-finalCopy">
                <p className="home-eyebrow nx-kicker-dark">Başlayaq</p>
                <h2 className="home-finalTitle">
                  Biznesiniz üçün hansı sistemi qurmaq lazım olduğunu birlikdə müəyyən edək.
                </h2>
                <p className="home-finalText">
                  Qısa məlumat göndərin, biznesiniz üçün uyğun veb sayt, çatbot və avtomatlaşdırma
                  xəritəsini hazırlayaq.
                </p>
              </div>

              <div className="home-finalActions">
                <Link to={withLang("/contact", lang)} className="nx-btn nx-btn-light nx-btn-lg">
                  Əlaqə saxla
                  <ArrowUpRight size={18} />
                </Link>

                <Link to={withLang("/services", lang)} className="nx-btn nx-btn-ghost-dark nx-btn-lg">
                  Xidmətlərə bax
                  <ChevronRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}