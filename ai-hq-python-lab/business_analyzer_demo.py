import re
import json
import html
from pathlib import Path
from datetime import datetime


INPUT_FILE = Path("business_input.txt")
JSON_OUTPUT = Path("analysis_result.json")
HTML_OUTPUT = Path("analysis_report.html")


SAMPLE_TEXT = """
Mand Clinic Baku — estetik stomatologiya və diş müalicəsi mərkəzi.

Biz implant, ortodontiya, diş ağardılması, plomb, kanal müalicəsi və uşaq stomatologiyası xidmətləri göstəririk.

Ünvan: Bakı şəhəri, Nərimanov rayonu, Atatürk prospekti 45.
Əlaqə üçün: +994 50 321 45 67 və ya info@mandclinic.az
Website: https://mandclinic.az
Instagram: @mandclinic

İş saatları:
Bazar ertəsi - Cümə: 09:00 - 18:00
Şənbə: 10:00 - 15:00
Bazar günü bağlıdır.

Qeyd: Qiymətlər müayinə sonrası dəqiqləşir. Təcili ağrı hallarında öncədən zəng edin.
"""


SERVICE_KEYWORDS = {
    "Dental": [
        "implant",
        "ortodontiya",
        "diş ağardılması",
        "plomb",
        "kanal müalicəsi",
        "uşaq stomatologiyası",
        "estetik stomatologiya",
        "diş müalicəsi",
        "stomatologiya",
    ],
    "Clinic": [
        "müayinə",
        "həkim",
        "klinik",
        "analiz",
        "checkup",
        "konsultasiya",
    ],
    "Beauty": [
        "lazer",
        "kosmetologiya",
        "botoks",
        "dolğu",
        "manikür",
        "pedikür",
        "saç",
    ],
    "Restaurant": [
        "menyu",
        "delivery",
        "sifariş",
        "pizza",
        "burger",
        "kabab",
        "nahar",
    ],
}


def normalize_space(value):
    return re.sub(r"\s+", " ", value).strip()


def read_or_create_input_file():
    if not INPUT_FILE.exists():
        INPUT_FILE.write_text(SAMPLE_TEXT.strip(), encoding="utf-8")
        print(f"[OK] {INPUT_FILE} yaradıldı. İstəsən içindəki mətni dəyişib yenidən run edə bilərsən.\n")

    return INPUT_FILE.read_text(encoding="utf-8")


def extract_emails(text):
    pattern = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
    return sorted(set(re.findall(pattern, text)))


def get_email_spans(text):
    pattern = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
    return [match.span() for match in re.finditer(pattern, text)]


def span_inside(span, spans):
    start, end = span
    for s, e in spans:
        if start >= s and end <= e:
            return True
    return False


def extract_phones(text):
    pattern = r"(?:\+|00)?\d[\d\s\-()]{8,}\d"
    raw_matches = re.findall(pattern, text)

    phones = []
    for match in raw_matches:
        value = normalize_space(match)
        digits = re.sub(r"\D", "", value)

        # Telefon kimi görünməsi üçün minimum 9 rəqəm olsun
        if len(digits) >= 9:
            phones.append(value)

    return sorted(set(phones))


def extract_websites(text):
    emails = get_email_spans(text)
    pattern = r"(https?://[^\s]+|www\.[^\s]+|[A-Za-z0-9-]+\.(?:az|com|net|org|io|co|ai)\b)"
    websites = []

    for match in re.finditer(pattern, text):
        if span_inside(match.span(), emails):
            continue

        value = match.group(0).strip(".,)")
        websites.append(value)

    return sorted(set(websites))


def extract_socials(text):
    email_spans = get_email_spans(text)
    socials = []

    for match in re.finditer(r"@[A-Za-z0-9._]{2,30}", text):
        if span_inside(match.span(), email_spans):
            continue

        handle = match.group(0).strip(".,)")
        socials.append(handle)

    return sorted(set(socials))


def extract_business_name(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return "Unknown business"

    first_line = lines[0]
    first_line = re.split(r"\s[—-]\s", first_line)[0]
    return first_line.strip()


def extract_address(text):
    patterns = [
        r"Ünvan:\s*(.+)",
        r"Address:\s*(.+)",
        r"Location:\s*(.+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()

    return None


def extract_hours(text):
    hour_lines = []
    weekdays = [
        "bazar ertəsi",
        "çərşənbə axşamı",
        "çərşənbə",
        "cümə axşamı",
        "cümə",
        "şənbə",
        "bazar",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]

    for line in text.splitlines():
        clean = line.strip()
        lower = clean.lower()

        has_weekday = any(day in lower for day in weekdays)
        has_time = bool(re.search(r"\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}", lower))
        is_closed = "bağlı" in lower or "closed" in lower

        if clean and (has_weekday or has_time or is_closed):
            hour_lines.append(clean)

    return hour_lines


def detect_services(text):
    lower = text.lower()
    detected = []

    for category, keywords in SERVICE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in lower:
                detected.append({
                    "name": keyword.title(),
                    "category": category,
                    "confidence": 0.88,
                    "evidence": f"Mətndə '{keyword}' ifadəsi tapıldı."
                })

    # Eyni xidmət təkrar düşməsin
    unique = {}
    for service in detected:
        key = service["name"].lower()
        unique[key] = service

    return list(unique.values())


def guess_category(services):
    if not services:
        return {
            "name": "Unknown",
            "confidence": 0.0
        }

    scores = {}
    for service in services:
        category = service["category"]
        scores[category] = scores.get(category, 0) + 1

    best_category = max(scores, key=scores.get)
    confidence = min(0.95, 0.55 + scores[best_category] * 0.1)

    readable = {
        "Dental": "Dental clinic / Stomatologiya",
        "Clinic": "Clinic / Medical service",
        "Beauty": "Beauty / Salon",
        "Restaurant": "Restaurant / Food service",
    }

    return {
        "name": readable.get(best_category, best_category),
        "confidence": round(confidence, 2)
    }


def detect_risks(text, services, phones, emails, websites, address, hours):
    lower = text.lower()
    risks = []

    if not services:
        risks.append({
            "level": "high",
            "field": "services",
            "message": "Xidmətlər aydın tapılmadı. AI cavablarında xidmət uydurmaq olmaz."
        })

    if not phones:
        risks.append({
            "level": "medium",
            "field": "phone",
            "message": "Telefon nömrəsi tapılmadı."
        })

    if not emails:
        risks.append({
            "level": "low",
            "field": "email",
            "message": "Email tapılmadı."
        })

    if not websites:
        risks.append({
            "level": "low",
            "field": "website",
            "message": "Website tapılmadı."
        })

    if not address:
        risks.append({
            "level": "medium",
            "field": "address",
            "message": "Ünvan tapılmadı."
        })

    if not hours:
        risks.append({
            "level": "medium",
            "field": "business_hours",
            "message": "İş saatları tapılmadı."
        })

    if "qiymətlər müayinə sonrası" in lower or "qiymət" in lower:
        risks.append({
            "level": "info",
            "field": "pricing",
            "message": "Qiymətlər dəqiq deyil. AI müştəriyə konkret qiymət uydurmamalıdır."
        })

    if "bazar günü bağlıdır" in lower or "sunday closed" in lower:
        risks.append({
            "level": "info",
            "field": "availability",
            "message": "Bazar günü bağlıdır. AI bazar günü görüş və ya qəbul vəd etməməlidir."
        })

    return risks


def calculate_confidence(name, services, phones, emails, websites, address, hours):
    score = 0

    if name != "Unknown business":
        score += 20
    if services:
        score += 25
    if phones:
        score += 15
    if emails:
        score += 10
    if websites:
        score += 10
    if address:
        score += 10
    if hours:
        score += 10

    return round(score / 100, 2)


def analyze_business(text):
    business_name = extract_business_name(text)
    services = detect_services(text)
    phones = extract_phones(text)
    emails = extract_emails(text)
    websites = extract_websites(text)
    socials = extract_socials(text)
    address = extract_address(text)
    hours = extract_hours(text)
    category = guess_category(services)

    confidence = calculate_confidence(
        business_name,
        services,
        phones,
        emails,
        websites,
        address,
        hours
    )

    risks = detect_risks(
        text,
        services,
        phones,
        emails,
        websites,
        address,
        hours
    )

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "businessProfile": {
            "name": business_name,
            "categoryGuess": category["name"],
            "categoryConfidence": category["confidence"],
            "overallConfidence": confidence,
        },
        "contacts": {
            "phones": phones,
            "emails": emails,
            "websites": websites,
            "socials": socials,
        },
        "address": address,
        "businessHours": hours,
        "services": services,
        "risks": risks,
        "aiRulesSuggested": [
            "Dəqiq qiymət approved source-da yoxdursa, AI qiymət uydurmasın.",
            "İş saatı tapılmayıbsa, AI açıq/bağlı olduğunu qəti deməsin.",
            "Telefon və ünvan varsa, AI müştərini doğru kanala yönləndirə bilər.",
            "Riskli və ya çatışmayan məlumatlarda insan təsdiqi istənsin."
        ],
        "nextAction": "Bu məlumatları review ekranında userə göstər və yalnız təsdiqlənənləri canlı cavablarda istifadə et."
    }


def render_html_report(result):
    def esc(value):
        return html.escape(str(value))

    services_html = "".join(
        f"""
        <div class="item">
          <strong>{esc(service["name"])}</strong>
          <span>{esc(service["category"])}</span>
          <p>{esc(service["evidence"])}</p>
        </div>
        """
        for service in result["services"]
    ) or "<p class='muted'>Xidmət tapılmadı.</p>"

    risks_html = "".join(
        f"""
        <div class="risk {esc(risk["level"])}">
          <strong>{esc(risk["level"]).upper()} · {esc(risk["field"])}</strong>
          <p>{esc(risk["message"])}</p>
        </div>
        """
        for risk in result["risks"]
    ) or "<p class='muted'>Risk tapılmadı.</p>"

    contacts = result["contacts"]

    html_content = f"""
<!doctype html>
<html lang="az">
<head>
  <meta charset="utf-8" />
  <title>Python Business Analyzer Report</title>
  <style>
    body {{
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f5f7fb;
      color: #151923;
    }}
    .page {{
      max-width: 980px;
      margin: 40px auto;
      padding: 0 20px;
    }}
    .hero {{
      background: white;
      border: 1px solid #e6eaf2;
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 30px;
    }}
    h2 {{
      margin-top: 28px;
      font-size: 20px;
    }}
    .muted {{
      color: #64748b;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 18px;
    }}
    .card, .item, .risk {{
      background: white;
      border: 1px solid #e6eaf2;
      border-radius: 14px;
      padding: 16px;
    }}
    .card strong {{
      display: block;
      margin-bottom: 6px;
      color: #334155;
    }}
    .item {{
      margin-bottom: 10px;
    }}
    .item span {{
      display: inline-block;
      margin-top: 6px;
      color: #2563eb;
      font-size: 13px;
    }}
    .item p, .risk p {{
      margin-bottom: 0;
      color: #64748b;
    }}
    .risk {{
      margin-bottom: 10px;
    }}
    .risk.high {{
      border-color: #fecaca;
      background: #fff7f7;
    }}
    .risk.medium {{
      border-color: #fed7aa;
      background: #fff8ed;
    }}
    .risk.low {{
      border-color: #dbeafe;
      background: #f8fbff;
    }}
    .risk.info {{
      border-color: #bfdbfe;
      background: #eff6ff;
    }}
    code {{
      background: #eef2ff;
      padding: 2px 6px;
      border-radius: 6px;
    }}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <p class="muted">Generated at {esc(result["generatedAt"])}</p>
      <h1>{esc(result["businessProfile"]["name"])}</h1>
      <p>
        Category: <strong>{esc(result["businessProfile"]["categoryGuess"])}</strong><br />
        Overall confidence: <strong>{esc(result["businessProfile"]["overallConfidence"])}</strong>
      </p>
    </section>

    <section class="grid">
      <div class="card">
        <strong>Phones</strong>
        <div>{esc(", ".join(contacts["phones"]) or "Yoxdur")}</div>
      </div>
      <div class="card">
        <strong>Emails</strong>
        <div>{esc(", ".join(contacts["emails"]) or "Yoxdur")}</div>
      </div>
      <div class="card">
        <strong>Websites</strong>
        <div>{esc(", ".join(contacts["websites"]) or "Yoxdur")}</div>
      </div>
      <div class="card">
        <strong>Socials</strong>
        <div>{esc(", ".join(contacts["socials"]) or "Yoxdur")}</div>
      </div>
      <div class="card">
        <strong>Address</strong>
        <div>{esc(result["address"] or "Yoxdur")}</div>
      </div>
      <div class="card">
        <strong>Business Hours</strong>
        <div>{esc(" | ".join(result["businessHours"]) or "Yoxdur")}</div>
      </div>
    </section>

    <h2>Detected Services</h2>
    {services_html}

    <h2>Risks / Warnings</h2>
    {risks_html}

    <h2>Suggested AI Rules</h2>
    <ul>
      {"".join(f"<li>{esc(rule)}</li>" for rule in result["aiRulesSuggested"])}
    </ul>

    <h2>Next Action</h2>
    <p>{esc(result["nextAction"])}</p>
  </main>
</body>
</html>
"""
    return html_content


def print_terminal_summary(result):
    profile = result["businessProfile"]
    contacts = result["contacts"]

    print("\n" + "=" * 70)
    print("PYTHON BUSINESS ANALYZER RESULT")
    print("=" * 70)

    print(f"\nBusiness name: {profile['name']}")
    print(f"Category guess: {profile['categoryGuess']}")
    print(f"Overall confidence: {profile['overallConfidence']}")

    print("\nContacts:")
    print(f"  Phones: {', '.join(contacts['phones']) or 'Yoxdur'}")
    print(f"  Emails: {', '.join(contacts['emails']) or 'Yoxdur'}")
    print(f"  Websites: {', '.join(contacts['websites']) or 'Yoxdur'}")
    print(f"  Socials: {', '.join(contacts['socials']) or 'Yoxdur'}")

    print(f"\nAddress: {result['address'] or 'Yoxdur'}")

    print("\nBusiness hours:")
    if result["businessHours"]:
        for line in result["businessHours"]:
            print(f"  - {line}")
    else:
        print("  Yoxdur")

    print("\nDetected services:")
    if result["services"]:
        for service in result["services"]:
            print(f"  - {service['name']} | {service['category']} | confidence {service['confidence']}")
    else:
        print("  Xidmət tapılmadı.")

    print("\nRisks:")
    if result["risks"]:
        for risk in result["risks"]:
            print(f"  - {risk['level'].upper()} | {risk['field']} | {risk['message']}")
    else:
        print("  Risk tapılmadı.")

    print("\nSuggested AI rules:")
    for rule in result["aiRulesSuggested"]:
        print(f"  - {rule}")

    print("\n" + "=" * 70)


def main():
    text = read_or_create_input_file()
    result = analyze_business(text)

    JSON_OUTPUT.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    HTML_OUTPUT.write_text(
        render_html_report(result),
        encoding="utf-8"
    )

    print_terminal_summary(result)

    print(f"\n[OK] JSON yaradıldı: {JSON_OUTPUT.resolve()}")
    print(f"[OK] HTML report yaradıldı: {HTML_OUTPUT.resolve()}")
    print("\nHTML faylı browserdə aç, vizual reportu görəcəksən.")


if __name__ == "__main__":
    main()