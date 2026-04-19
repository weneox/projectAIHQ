function normalizeLanguage(value = "") {
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "en";

  if (x.startsWith("az")) return "az";
  if (x.startsWith("en")) return "en";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  if (x.startsWith("es")) return "es";
  if (x.startsWith("de")) return "de";
  if (x.startsWith("fr")) return "fr";
  if (x.startsWith("it")) return "it";
  if (x.startsWith("pt")) return "pt";
  if (x.startsWith("ar")) return "ar";
  if (x.startsWith("nl")) return "nl";
  if (x.startsWith("pl")) return "pl";
  if (x.startsWith("uk")) return "uk";
  if (x.startsWith("zh")) return "zh";
  if (x.startsWith("ja")) return "ja";
  if (x.startsWith("ko")) return "ko";
  if (x.startsWith("hi")) return "hi";

  return "en";
}

const FALLBACK_DEFAULT_QUESTION = {
  en: "Tell me briefly what you need and I’ll guide you from there.",
  az: "Qısa olaraq nəyə ehtiyacınız olduğunu yazın, ordan yönləndirəcəyəm.",
  tr: "Kısaca neye ihtiyacınız olduğunu yazın, oradan yönlendireyim.",
  ru: "Кратко напишите, что вам нужно, и я помогу сориентироваться.",
  es: "Cuéntame brevemente qué necesitas y te guiaré desde ahí.",
  de: "Beschreibe kurz, was du brauchst, dann leite ich dich passend weiter.",
  fr: "Dites brièvement ce dont vous avez besoin, et je vous guiderai à partir de là.",
  it: "Scrivi brevemente di cosa hai bisogno e ti guiderò da lì.",
  pt: "Diga brevemente do que você precisa e eu o orientarei a partir daí.",
  ar: "اكتب باختصار ما الذي تحتاجه وسأرشدك من هناك.",
  nl: "Vertel kort wat je nodig hebt, dan help ik je verder.",
  pl: "Napisz krótko, czego potrzebujesz, a pokieruję Cię dalej.",
  uk: "Коротко опишіть, що вам потрібно, і я підкажу, як рухатись далі.",
  zh: "请简单说明你的需求，我会继续引导你。",
  ja: "何が必要かを簡単に教えてください。そこからご案内します。",
  ko: "무엇이 필요한지 간단히 알려주시면 이어서 안내해드리겠습니다.",
  hi: "संक्षेप में बताइए कि आपको क्या चाहिए, मैं आगे मार्गदर्शन करूँगा।",
};

const FALLBACK_BY_INTENT = {
  greeting: {
    en: "Tell me briefly what you need help with.",
    az: "Nə ilə bağlı kömək lazım olduğunu qısa yazın.",
    tr: "Hangi konuda yardıma ihtiyacınız olduğunu kısaca yazın.",
    ru: "Кратко напишите, с чем вам нужна помощь.",
    es: "Cuéntame brevemente con qué necesitas ayuda.",
    de: "Beschreibe kurz, wobei du Hilfe brauchst.",
    fr: "Dites brièvement pour quoi vous avez besoin d’aide.",
    it: "Dimmi brevemente in cosa hai bisogno di aiuto.",
    pt: "Diga brevemente com o que você precisa de ajuda.",
    ar: "اكتب باختصار في أي شيء تحتاج إلى المساعدة.",
    nl: "Vertel kort waarmee je hulp nodig hebt.",
    pl: "Napisz krótko, w czym potrzebujesz pomocy.",
    uk: "Коротко напишіть, у чому вам потрібна допомога.",
    zh: "请简单说明你需要什么帮助。",
    ja: "どのようなお手伝いが必要か、簡単に教えてください。",
    ko: "어떤 도움이 필요한지 간단히 알려주세요.",
    hi: "संक्षेप में बताइए कि आपको किस बात में मदद चाहिए।",
  },

  pricing: {
    en: "Share what you need and the key requirement or two, and I’ll guide the pricing side more clearly.",
    az: "Nəyə ehtiyac olduğunu və əsas 1-2 tələbi yazın, qiymət tərəfini daha aydın yönləndirim.",
    tr: "Neye ihtiyacınız olduğunu ve 1-2 ana gereksinimi yazın, fiyat tarafını daha net yönlendireyim.",
    ru: "Напишите, что именно вам нужно и 1-2 ключевых требования, и я точнее сориентирую по стоимости.",
    es: "Comparte lo que necesitas y 1-2 requisitos clave, y te orientaré mejor sobre el precio.",
    de: "Beschreibe, was du brauchst, und 1-2 wichtige Anforderungen, dann kann ich beim Preis besser helfen.",
    fr: "Décrivez ce dont vous avez besoin et 1 à 2 exigences clés, et je vous orienterai mieux sur le prix.",
    it: "Descrivi di cosa hai bisogno e 1-2 requisiti chiave, così posso guidarti meglio sul prezzo.",
    pt: "Descreva o que você precisa e 1-2 requisitos principais, e eu orientarei melhor sobre o preço.",
    ar: "اكتب ما تحتاجه مع أهم متطلب أو متطلبين، وسأوضح لك جانب السعر بشكل أفضل.",
    nl: "Beschrijf wat je nodig hebt en 1-2 belangrijke eisen, dan kan ik beter richting geven over de prijs.",
    pl: "Opisz, czego potrzebujesz i 1-2 kluczowe wymagania, a lepiej pokieruję Cię w sprawie ceny.",
    uk: "Опишіть, що саме вам потрібно, і 1-2 ключові вимоги, і я точніше зорієнтую щодо вартості.",
    zh: "请说明你的需求和 1-2 个关键要求，我会更准确地引导你了解价格。",
    ja: "必要な内容と重要な要件を1〜2点教えてください。料金面をより適切にご案内できます。",
    ko: "필요한 내용과 핵심 요구사항 1~2개를 알려주시면 가격 방향을 더 정확히 안내할 수 있습니다.",
    hi: "आपको क्या चाहिए और 1-2 मुख्य आवश्यकताएँ लिखें, ताकि मैं कीमत के बारे में अधिक स्पष्ट मार्गदर्शन दे सकूँ।",
  },

  support: {
    en: "Describe the issue briefly and where it appears.",
    az: "Problemi qısa yazın və harada göründüyünü qeyd edin.",
    tr: "Sorunu kısaca yazın ve nerede göründüğünü belirtin.",
    ru: "Кратко опишите проблему и где именно она проявляется.",
    es: "Describe brevemente el problema y dónde aparece.",
    de: "Beschreibe das Problem kurz und wo es auftritt.",
    fr: "Décrivez brièvement le problème et où il apparaît.",
    it: "Descrivi brevemente il problema e dove si verifica.",
    pt: "Descreva brevemente o problema e onde ele aparece.",
    ar: "صف المشكلة باختصار وأين تظهر.",
    nl: "Beschrijf het probleem kort en waar het optreedt.",
    pl: "Opisz krótko problem i gdzie się pojawia.",
    uk: "Коротко опишіть проблему та де саме вона проявляється.",
    zh: "请简要说明问题以及它出现在哪里。",
    ja: "問題の内容と発生箇所を簡単に教えてください。",
    ko: "문제가 무엇인지, 어디서 나타나는지 간단히 알려주세요.",
    hi: "समस्या और वह कहाँ दिख रही है, इसे संक्षेप में लिखें।",
  },

  handoff_request: {
    en: "Tell me the topic briefly and I’ll route it correctly.",
    az: "Mövzunu qısa yazın, düzgün yönləndirəcəyəm.",
    tr: "Konuyu kısaca yazın, doğru yönlendireyim.",
    ru: "Кратко опишите тему, и я направлю это правильно.",
    es: "Comparte brevemente el tema y lo derivaré correctamente.",
    de: "Beschreibe das Thema kurz, dann leite ich es richtig weiter.",
    fr: "Partagez brièvement le sujet et je le transmettrai correctement.",
    it: "Descrivi brevemente il tema e lo indirizzerò correttamente.",
    pt: "Descreva brevemente o tema e eu encaminharei corretamente.",
    ar: "اكتب الموضوع باختصار وسأقوم بتوجيهه بشكل صحيح.",
    nl: "Beschrijf het onderwerp kort, dan zet ik het correct door.",
    pl: "Opisz krótko temat, a skieruję to właściwie.",
    uk: "Коротко опишіть тему, і я правильно це передам.",
    zh: "请简要说明主题，我会正确转接。",
    ja: "内容を簡単に教えてください。適切に引き継ぎます。",
    ko: "주제를 간단히 알려주시면 올바르게 연결하겠습니다.",
    hi: "विषय को संक्षेप में लिखें, मैं सही तरह से आगे भेज दूँगा।",
  },

  urgent_interest: {
    en: "Tell me the topic briefly and I’ll mark it as priority.",
    az: "Mövzunu qısa yazın, prioritet kimi qeyd edəcəyəm.",
    tr: "Konuyu kısaca yazın, öncelikli olarak işaretleyeyim.",
    ru: "Кратко опишите тему, и я отмечу её как приоритетную.",
    es: "Comparte brevemente el tema y lo marcaré como prioritario.",
    de: "Beschreibe das Thema kurz, dann markiere ich es als prioritär.",
    fr: "Partagez brièvement le sujet et je le signalerai comme prioritaire.",
    it: "Descrivi brevemente il tema e lo segnalerò come prioritario.",
    pt: "Descreva brevemente o tema e eu o marcarei como prioritário.",
    ar: "اكتب الموضوع باختصار وسأضع له أولوية.",
    nl: "Beschrijf het onderwerp kort, dan markeer ik het als prioriteit.",
    pl: "Opisz krótko temat, a oznaczę go jako priorytetowy.",
    uk: "Коротко опишіть тему, і я позначу її як пріоритетну.",
    zh: "请简要说明主题，我会将其标记为优先事项。",
    ja: "内容を簡単に教えてください。優先対応として扱います。",
    ko: "주제를 간단히 알려주시면 우선순위로 표시하겠습니다.",
    hi: "विषय को संक्षेप में लिखें, मैं इसे प्राथमिकता के रूप में चिह्नित कर दूँगा।",
  },

  knowledge_answer: {
    en: "Tell me which part you want clarified and I’ll focus there.",
    az: "Hansı hissəni dəqiqləşdirmək istədiyinizi yazın, ora fokuslanım.",
    tr: "Hangi kısmı netleştirmek istediğinizi yazın, oraya odaklanayım.",
    ru: "Напишите, какую часть вы хотите уточнить, и я сфокусируюсь на этом.",
    es: "Cuéntame qué parte quieres aclarar y me enfocaré en eso.",
    de: "Sag mir, welchen Teil du klären möchtest, dann fokussiere ich mich darauf.",
    fr: "Dites-moi quelle partie vous voulez clarifier et je me concentrerai dessus.",
    it: "Dimmi quale parte vuoi chiarire e mi concentrerò su quella.",
    pt: "Diga qual parte você quer esclarecer e eu focarei nisso.",
    ar: "اكتب أي جزء تريد توضيحه وسأركز عليه.",
    nl: "Vertel welk deel je verduidelijkt wilt hebben, dan focus ik daarop.",
    pl: "Napisz, którą część chcesz doprecyzować, a skupię się na niej.",
    uk: "Напишіть, яку саме частину ви хочете уточнити, і я зосереджуся на цьому.",
    zh: "请说明你想进一步确认哪一部分，我会重点说明。",
    ja: "どの部分を確認したいか教えてください。そこに絞ってご案内します。",
    ko: "어느 부분을 더 명확히 하고 싶은지 알려주시면 그 부분에 집중하겠습니다.",
    hi: "आप किस हिस्से को स्पष्ट करना चाहते हैं, यह लिखें, मैं उसी पर ध्यान दूँगा।",
  },

  unsupported_service: {
    en: "Tell me briefly what you need and I’ll check how closely it fits.",
    az: "Qısa olaraq ehtiyacı yazın, nə qədər uyğun olduğunu yoxlayım.",
    tr: "İhtiyacı kısaca yazın, ne kadar uyduğunu kontrol edeyim.",
    ru: "Кратко опишите потребность, и я проверю, насколько это подходит.",
    es: "Cuéntame brevemente la necesidad y revisaré qué tan bien encaja.",
    de: "Beschreibe den Bedarf kurz, dann prüfe ich, wie gut er passt.",
    fr: "Décrivez brièvement le besoin et je vérifierai à quel point cela correspond.",
    it: "Descrivi brevemente l’esigenza e verificherò quanto si adatta.",
    pt: "Descreva brevemente a necessidade e eu verificarei o quanto isso se encaixa.",
    ar: "اكتب الحاجة باختصار وسأتحقق من مدى توافقها.",
    nl: "Beschrijf de behoefte kort, dan kijk ik hoe goed dit past.",
    pl: "Opisz krótko potrzebę, a sprawdzę, na ile to pasuje.",
    uk: "Коротко опишіть потребу, і я перевірю, наскільки це підходить.",
    zh: "请简单说明你的需求，我会判断它是否匹配。",
    ja: "必要な内容を簡単に教えてください。どれくらい適合するか確認します。",
    ko: "필요한 내용을 간단히 알려주시면 얼마나 맞는지 확인하겠습니다.",
    hi: "ज़रूरत को संक्षेप में लिखें, मैं देखूँगा कि यह कितना मेल खाता है।",
  },
};

const PRICING_LEAD = {
  en: "Pricing usually depends on scope, features, and delivery expectations.",
  az: "Qiymət adətən scope, funksiyalar və çatdırılma gözləntilərindən asılı olur.",
  tr: "Fiyat genelde kapsam, özellikler ve teslim beklentilerine bağlı olur.",
  ru: "Стоимость обычно зависит от объёма, функционала и ожиданий по срокам.",
  es: "El precio normalmente depende del alcance, las funciones y las expectativas de entrega.",
  de: "Der Preis hängt in der Regel von Umfang, Funktionen und Liefererwartungen ab.",
  fr: "Le prix dépend généralement du périmètre, des fonctionnalités et des attentes de livraison.",
  it: "Il prezzo dipende di solito da ambito, funzionalità e aspettative di consegna.",
  pt: "O preço normalmente depende do escopo, dos recursos e das expectativas de entrega.",
  ar: "يعتمد السعر عادةً على النطاق والميزات وتوقعات التسليم.",
  nl: "De prijs hangt meestal af van de omvang, functies en leveringsverwachtingen.",
  pl: "Cena zwykle zależy od zakresu, funkcji i oczekiwań dotyczących realizacji.",
  uk: "Вартість зазвичай залежить від обсягу, функціоналу та очікувань щодо термінів.",
  zh: "价格通常取决于范围、功能和交付预期。",
  ja: "料金は通常、範囲・機能・納期の期待によって変わります。",
  ko: "가격은 보통 범위, 기능, 그리고 전달 기대치에 따라 달라집니다.",
  hi: "कीमत आमतौर पर दायरे, फीचर्स और डिलीवरी अपेक्षाओं पर निर्भर करती है।",
};

const SUPPORT_LEAD = {
  en: "I can help with that.",
  az: "Bununla bağlı kömək edə bilərəm.",
  tr: "Bununla ilgili yardımcı olabilirim.",
  ru: "Я могу помочь с этим.",
  es: "Puedo ayudarte con eso.",
  de: "Ich kann dabei helfen.",
  fr: "Je peux vous aider avec cela.",
  it: "Posso aiutarti con questo.",
  pt: "Posso ajudar com isso.",
  ar: "يمكنني المساعدة في ذلك.",
  nl: "Ik kan daarbij helpen.",
  pl: "Mogę w tym pomóc.",
  uk: "Я можу з цим допомогти.",
  zh: "我可以帮你处理这个问题。",
  ja: "それについてお手伝いできます。",
  ko: "그 부분은 도와드릴 수 있습니다.",
  hi: "मैं इसमें मदद कर सकता हूँ।",
};

const HANDOFF_LEAD = {
  en: "Sure, I can route this to the right team member.",
  az: "Əlbəttə, bunu uyğun komanda üzvünə yönləndirə bilərəm.",
  tr: "Elbette, bunu doğru ekip üyesine yönlendirebilirim.",
  ru: "Конечно, я могу передать это подходящему сотруднику команды.",
  es: "Claro, puedo derivarlo al miembro adecuado del equipo.",
  de: "Gerne, ich kann das an das passende Teammitglied weiterleiten.",
  fr: "Bien sûr, je peux transmettre cela au bon membre de l’équipe.",
  it: "Certo, posso inoltrarlo al membro giusto del team.",
  pt: "Claro, posso encaminhar isso para a pessoa certa da equipe.",
  ar: "بالتأكيد، يمكنني تحويل هذا إلى الشخص المناسب في الفريق.",
  nl: "Zeker, ik kan dit doorzetten naar het juiste teamlid.",
  pl: "Jasne, mogę przekazać to właściwej osobie z zespołu.",
  uk: "Звісно, я можу передати це відповідному члену команди.",
  zh: "当然，我可以将此转给合适的团队成员。",
  ja: "もちろん、適切なチームメンバーにおつなぎできます。",
  ko: "물론입니다. 적절한 팀원에게 전달해드릴 수 있습니다.",
  hi: "ज़रूर, मैं इसे टीम के सही सदस्य तक पहुँचा सकता हूँ।",
};

const URGENT_LEAD = {
  en: "Understood — I’ll treat this as priority.",
  az: "Aydındır — bunu prioritet kimi götürəcəyəm.",
  tr: "Anladım — bunu öncelikli olarak ele alacağım.",
  ru: "Понял — отмечу это как приоритетное.",
  es: "Entendido: lo tomaré como prioritario.",
  de: "Verstanden — ich behandle das mit Priorität.",
  fr: "Compris — je vais le traiter en priorité.",
  it: "Capito: lo tratterò come prioritario.",
  pt: "Entendido — vou tratar isso como prioridade.",
  ar: "مفهوم — سأتعامل مع هذا كأولوية.",
  nl: "Begrepen — ik behandel dit als prioriteit.",
  pl: "Rozumiem — potraktuję to priorytetowo.",
  uk: "Зрозуміло — це буде в пріоритеті.",
  zh: "明白了——我会按优先事项处理。",
  ja: "承知しました。優先事項として扱います。",
  ko: "알겠습니다. 우선순위로 처리하겠습니다.",
  hi: "समझ गया — मैं इसे प्राथमिकता के रूप में लूँगा।",
};

const UNSUPPORTED_EXAMPLES = {
  en: (examples) => `The clearest supported areas right now include ${examples}.`,
  az: (examples) => `Hazırda ən aydın dəstəklənən istiqamətlərə ${examples} daxildir.`,
  tr: (examples) => `Şu anda en net desteklenen alanlara ${examples} dahildir.`,
  ru: (examples) => `Сейчас наиболее понятно поддерживаются такие направления, как ${examples}.`,
  es: (examples) => `Las áreas que ahora mismo están más claramente cubiertas incluyen ${examples}.`,
  de: (examples) => `Die aktuell am klarsten unterstützten Bereiche umfassen ${examples}.`,
  fr: (examples) => `Les domaines les plus clairement couverts actuellement incluent ${examples}.`,
  it: (examples) => `Le aree attualmente coperte con maggiore chiarezza includono ${examples}.`,
  pt: (examples) => `As áreas mais claramente cobertas neste momento incluem ${examples}.`,
  ar: (examples) => `تشمل المجالات الأكثر وضوحًا في الدعم حاليًا ${examples}.`,
  nl: (examples) => `De duidelijkst ondersteunde gebieden op dit moment omvatten ${examples}.`,
  pl: (examples) => `Obszary, które obecnie wspieramy najjaśniej, obejmują ${examples}.`,
  uk: (examples) => `Найчіткіше зараз підтримуються такі напрямки, як ${examples}.`,
  zh: (examples) => `目前最明确支持的方向包括 ${examples}。`,
  ja: (examples) => `現在、特に明確に対応している範囲には ${examples} が含まれます。`,
  ko: (examples) => `현재 가장 명확하게 지원하는 범위에는 ${examples}가 포함됩니다.`,
  hi: (examples) => `इस समय सबसे स्पष्ट रूप से सपोर्ट किए जाने वाले क्षेत्रों में ${examples} शामिल हैं।`,
};

const UNSUPPORTED_CHECK = {
  en: "Tell me briefly what you need and I’ll see how closely it fits.",
  az: "Qısa olaraq nə lazım olduğunu yazın, nə qədər uyğun olduğunu baxım.",
  tr: "Kısaca neye ihtiyaç olduğunu yazın, ne kadar uyduğuna bakayım.",
  ru: "Кратко опишите, что вам нужно, и я посмотрю, насколько это подходит.",
  es: "Cuéntame brevemente qué necesitas y veré qué tan bien encaja.",
  de: "Beschreibe kurz, was du brauchst, dann sehe ich, wie gut es passt.",
  fr: "Dites brièvement ce dont vous avez besoin et je verrai dans quelle mesure cela correspond.",
  it: "Dimmi brevemente di cosa hai bisogno e vedrò quanto si adatta.",
  pt: "Diga brevemente do que você precisa e eu verei o quanto isso se encaixa.",
  ar: "اكتب باختصار ما الذي تحتاجه وسأرى مدى توافقه.",
  nl: "Vertel kort wat je nodig hebt, dan kijk ik hoe goed het past.",
  pl: "Napisz krótko, czego potrzebujesz, a sprawdzę, na ile to pasuje.",
  uk: "Коротко опишіть, що вам потрібно, і я подивлюся, наскільки це підходить.",
  zh: "请简单说明你的需求，我会看看它是否匹配。",
  ja: "必要な内容を簡単に教えてください。どれくらい適合するか確認します。",
  ko: "필요한 내용을 간단히 알려주시면 얼마나 맞는지 확인하겠습니다.",
  hi: "संक्षेप में बताइए कि आपको क्या चाहिए, मैं देखूँगा कि यह कितना मेल खाता है।",
};

export function getFallbackDefaultQuestion(language = "en") {
  const lang = normalizeLanguage(language);
  return FALLBACK_DEFAULT_QUESTION[lang] || FALLBACK_DEFAULT_QUESTION.en;
}

export function getFallbackQuestionByIntent(intent = "", language = "en") {
  const lang = normalizeLanguage(language);
  const safeIntent = String(intent || "").trim();

  if (FALLBACK_BY_INTENT[safeIntent]) {
    return FALLBACK_BY_INTENT[safeIntent][lang] || FALLBACK_BY_INTENT[safeIntent].en;
  }

  return getFallbackDefaultQuestion(lang);
}

export function getPricingLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return PRICING_LEAD[lang] || PRICING_LEAD.en;
}

export function getSupportLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return SUPPORT_LEAD[lang] || SUPPORT_LEAD.en;
}

export function getHandoffLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return HANDOFF_LEAD[lang] || HANDOFF_LEAD.en;
}

export function getUrgentLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return URGENT_LEAD[lang] || URGENT_LEAD.en;
}

export function getUnsupportedExamplesSentence(examples = "", language = "en") {
  const lang = normalizeLanguage(language);
  const formatter = UNSUPPORTED_EXAMPLES[lang] || UNSUPPORTED_EXAMPLES.en;
  return formatter(String(examples || "").trim());
}

export function getUnsupportedCheckSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return UNSUPPORTED_CHECK[lang] || UNSUPPORTED_CHECK.en;
}