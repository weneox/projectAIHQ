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
  en: "Tell me what you need, and I’ll guide this properly.",
  az: "Nə lazım olduğunu yazın, sizi düzgün yönləndirim.",
  tr: "Neye ihtiyacınız olduğunu yazın, sizi doğru yönlendireyim.",
  ru: "Напишите, что вам нужно, и я направлю вас дальше правильно.",
  es: "Cuéntame qué necesitas y te orientaré correctamente.",

  de: "Schreib kurz, was du brauchst, dann leite ich dich passend weiter.",
  fr: "Dites ce dont vous avez besoin et je vous guiderai correctement.",
  it: "Scrivi di cosa hai bisogno e ti guiderò nel modo giusto.",
  pt: "Diga do que você precisa e eu o orientarei corretamente.",
  ar: "اكتب ما الذي تحتاجه وسأوجّهك بالشكل الصحيح.",
  nl: "Vertel wat je nodig hebt, dan help ik je gericht verder.",
  pl: "Napisz, czego potrzebujesz, a dobrze Cię pokieruję.",
  uk: "Напишіть, що вам потрібно, і я правильно зорієнтую вас далі.",
  zh: "请告诉我你的需求，我会正确地继续引导你。",
  ja: "必要な内容を教えてください。適切にご案内します。",
  ko: "무엇이 필요한지 알려주시면 정확하게 안내해드리겠습니다.",
  hi: "आपको क्या चाहिए, यह लिखें, मैं सही तरह से आगे मार्गदर्शन करूँगा।",
};

const FALLBACK_BY_INTENT = {
  greeting: {
    en: "Hi — tell me what you need help with.",
    az: "Salam — nə ilə bağlı kömək lazım olduğunu yazın.",
    tr: "Merhaba — hangi konuda yardıma ihtiyacınız olduğunu yazın.",
    ru: "Здравствуйте — напишите, с чем вам нужна помощь.",
    es: "Hola — cuéntame con qué necesitas ayuda.",

    de: "Hallo — schreib kurz, wobei du Hilfe brauchst.",
    fr: "Bonjour — dites-moi pour quoi vous avez besoin d’aide.",
    it: "Ciao — dimmi in cosa hai bisogno di aiuto.",
    pt: "Olá — diga com o que você precisa de ajuda.",
    ar: "مرحبًا — اكتب في أي شيء تحتاج إلى المساعدة.",
    nl: "Hallo — vertel kort waarmee je hulp nodig hebt.",
    pl: "Cześć — napisz, w czym potrzebujesz pomocy.",
    uk: "Вітаю — напишіть, у чому вам потрібна допомога.",
    zh: "你好——请告诉我你需要什么帮助。",
    ja: "こんにちは。どのようなお手伝いが必要か教えてください。",
    ko: "안녕하세요. 어떤 도움이 필요한지 알려주세요.",
    hi: "नमस्ते — बताइए, आपको किस बात में मदद चाहिए।",
  },

  pricing: {
    en: "Pricing usually depends on the service and scope. Tell me which service you need, and I’ll guide you more clearly.",
    az: "Qiymət adətən xidmətə və scope-a görə dəyişir. Hansı xidmət lazım olduğunu yazın, daha düzgün yönləndirim.",
    tr: "Fiyat genelde hizmete ve kapsama göre değişir. Hangi hizmete ihtiyacınız olduğunu yazın, daha net yönlendireyim.",
    ru: "Стоимость обычно зависит от услуги и объёма. Напишите, какая именно услуга вам нужна, и я сориентирую точнее.",
    es: "El precio normalmente depende del servicio y del alcance. Dime qué servicio necesitas y te orientaré mejor.",

    de: "Der Preis hängt meist von Leistung und Umfang ab. Schreib, welche Leistung du brauchst, dann leite ich dich genauer weiter.",
    fr: "Le prix dépend souvent du service et du périmètre. Dites-moi de quel service vous avez besoin et je vous guiderai plus précisément.",
    it: "Il prezzo dipende di solito dal servizio e dall’ambito. Scrivi quale servizio ti serve e ti guiderò meglio.",
    pt: "O preço normalmente depende do serviço e do escopo. Diga qual serviço você precisa e eu o orientarei melhor.",
    ar: "يعتمد السعر عادةً على الخدمة والنطاق. اكتب الخدمة التي تحتاجها وسأوجّهك بشكل أوضح.",
    nl: "De prijs hangt meestal af van de dienst en de omvang. Vertel welke dienst je nodig hebt, dan help ik je gerichter verder.",
    pl: "Cena zwykle zależy od usługi i zakresu. Napisz, jakiej usługi potrzebujesz, a pokieruję Cię dokładniej.",
    uk: "Вартість зазвичай залежить від послуги та обсягу. Напишіть, яка саме послуга вам потрібна, і я зорієнтую точніше.",
    zh: "价格通常取决于服务内容和范围。请告诉我你需要哪项服务，我会更准确地引导你。",
    ja: "料金は通常、サービス内容と範囲によって変わります。必要なサービスを教えていただければ、より適切にご案内できます。",
    ko: "가격은 보통 서비스와 범위에 따라 달라집니다. 어떤 서비스가 필요한지 알려주시면 더 정확히 안내드릴게요.",
    hi: "कीमत आमतौर पर सेवा और दायरे पर निर्भर करती है। आपको कौन-सी सेवा चाहिए, यह लिखें, मैं अधिक स्पष्ट रूप से मार्गदर्शन करूँगा।",
  },

  support: {
    en: "I can help with that. Tell me where the issue appears, and I’ll guide the next step.",
    az: "Bununla kömək edə bilərəm. Problemin harada göründüyünü yazın, növbəti addımı düzgün yönləndirim.",
    tr: "Bununla yardımcı olabilirim. Sorunun nerede göründüğünü yazın, sonraki adımı doğru yönlendireyim.",
    ru: "Я могу помочь с этим. Напишите, где именно проявляется проблема, и я подскажу следующий шаг.",
    es: "Puedo ayudarte con eso. Cuéntame dónde aparece el problema y te indicaré el siguiente paso.",

    de: "Ich kann dabei helfen. Schreib kurz, wo das Problem auftritt, dann leite ich den nächsten Schritt richtig ein.",
    fr: "Je peux vous aider avec cela. Dites où le problème apparaît et je vous orienterai sur la suite.",
    it: "Posso aiutarti con questo. Scrivi dove compare il problema e ti guiderò sul passo successivo.",
    pt: "Posso ajudar com isso. Diga onde o problema aparece e eu orientarei o próximo passo.",
    ar: "يمكنني المساعدة في ذلك. اكتب أين تظهر المشكلة وسأوجّهك للخطوة التالية.",
    nl: "Ik kan daarbij helpen. Vertel waar het probleem verschijnt, dan geef ik de juiste volgende stap.",
    pl: "Mogę w tym pomóc. Napisz, gdzie pojawia się problem, a pokieruję Cię dalej.",
    uk: "Я можу з цим допомогти. Напишіть, де саме проявляється проблема, і я підкажу наступний крок.",
    zh: "我可以帮你处理这个问题。请告诉我问题出现在哪里，我会继续引导下一步。",
    ja: "その件はお手伝いできます。問題がどこで起きているか教えてください。次の対応を案内します。",
    ko: "그 부분은 도와드릴 수 있습니다. 문제가 어디에서 나타나는지 알려주시면 다음 단계를 안내하겠습니다.",
    hi: "मैं इसमें मदद कर सकता हूँ। समस्या कहाँ दिख रही है, यह लिखें, मैं अगला सही कदम बताऊँगा।",
  },

  handoff_request: {
    en: "Understood. Tell me the topic in one line, and I’ll route it correctly.",
    az: "Başa düşdüm. Mövzunu bir cümlə ilə yazın, düzgün yönləndirim.",
    tr: "Anladım. Konuyu bir cümleyle yazın, doğru yönlendireyim.",
    ru: "Понял. Напишите тему одной строкой, и я направлю это правильно.",
    es: "Entendido. Escríbeme el tema en una línea y lo derivaré correctamente.",

    de: "Verstanden. Schreib das Thema in einer Zeile, dann leite ich es richtig weiter.",
    fr: "Compris. Décrivez le sujet en une ligne et je le transmettrai correctement.",
    it: "Capito. Scrivi l’argomento in una riga e lo indirizzerò correttamente.",
    pt: "Entendido. Escreva o assunto em uma linha e eu encaminharei corretamente.",
    ar: "مفهوم. اكتب الموضوع في سطر واحد وسأقوم بتوجيهه بشكل صحيح.",
    nl: "Begrepen. Beschrijf het onderwerp in één regel, dan zet ik het goed door.",
    pl: "Rozumiem. Opisz temat w jednym zdaniu, a skieruję to właściwie.",
    uk: "Зрозуміло. Опишіть тему одним рядком, і я правильно це передам.",
    zh: "明白了。请用一句话说明主题，我会正确转接。",
    ja: "承知しました。内容を一文で教えていただければ、適切に引き継ぎます。",
    ko: "알겠습니다. 주제를 한 줄로 알려주시면 올바르게 연결하겠습니다.",
    hi: "समझ गया। विषय को एक पंक्ति में लिखें, मैं इसे सही तरह से आगे भेज दूँगा।",
  },

  urgent_interest: {
    en: "Understood — I’ll treat this as priority. Tell me the topic in one line so I can route it properly.",
    az: "Başa düşdüm — bunu prioritet kimi götürürəm. Düzgün yönləndirmək üçün mövzunu bir cümlə ilə yazın.",
    tr: "Anladım — bunu öncelikli ele alıyorum. Doğru yönlendirmek için konuyu bir cümleyle yazın.",
    ru: "Понял — отмечаю это как приоритет. Напишите тему одной строкой, чтобы я направил это правильно.",
    es: "Entendido: lo tomaré como prioritario. Escríbeme el tema en una línea para derivarlo bien.",

    de: "Verstanden — ich behandle das priorisiert. Schreib das Thema in einer Zeile, damit ich es richtig weiterleiten kann.",
    fr: "Compris — je vais le traiter en priorité. Décrivez le sujet en une ligne pour que je le transmette correctement.",
    it: "Capito: lo tratterò come prioritario. Scrivi l’argomento in una riga così posso indirizzarlo correttamente.",
    pt: "Entendido — vou tratar isso como prioridade. Escreva o assunto em uma linha para que eu encaminhe corretamente.",
    ar: "مفهوم — سأتعامل مع هذا كأولوية. اكتب الموضوع في سطر واحد لأقوم بتوجيهه بالشكل الصحيح.",
    nl: "Begrepen — ik behandel dit met prioriteit. Beschrijf het onderwerp in één regel zodat ik het goed kan doorzetten.",
    pl: "Rozumiem — potraktuję to priorytetowo. Opisz temat w jednym zdaniu, żebym mógł skierować to właściwie.",
    uk: "Зрозуміло — це буде пріоритетно. Опишіть тему одним рядком, щоб я правильно це передав.",
    zh: "明白了——我会按优先事项处理。请用一句话说明主题，我会正确转接。",
    ja: "承知しました。優先対応として扱います。内容を一文で教えていただければ、適切に引き継ぎます。",
    ko: "알겠습니다. 우선순위로 처리하겠습니다. 주제를 한 줄로 알려주시면 올바르게 연결하겠습니다.",
    hi: "समझ गया — मैं इसे प्राथमिकता के रूप में लूँगा। विषय को एक पंक्ति में लिखें ताकि मैं इसे सही तरह से आगे भेज सकूँ।",
  },

  knowledge_answer: {
    en: "Tell me which part you want clarified, and I’ll focus on that directly.",
    az: "Hansı hissəni dəqiqləşdirmək istədiyinizi yazın, birbaşa ora fokuslanım.",
    tr: "Hangi kısmı netleştirmek istediğinizi yazın, doğrudan oraya odaklanayım.",
    ru: "Напишите, какую часть вы хотите уточнить, и я сфокусируюсь именно на ней.",
    es: "Dime qué parte quieres aclarar y me enfocaré directamente en eso.",

    de: "Sag mir, welchen Teil du klären möchtest, dann fokussiere ich mich direkt darauf.",
    fr: "Dites-moi quelle partie vous voulez clarifier et je me concentrerai directement dessus.",
    it: "Dimmi quale parte vuoi chiarire e mi concentrerò direttamente su quella.",
    pt: "Diga qual parte você quer esclarecer e eu focarei diretamente nisso.",
    ar: "اكتب أي جزء تريد توضيحه وسأركز عليه مباشرة.",
    nl: "Vertel welk deel je wilt verduidelijken, dan focus ik me daar direct op.",
    pl: "Napisz, którą część chcesz doprecyzować, a skupię się bezpośrednio na niej.",
    uk: "Напишіть, яку саме частину ви хочете уточнити, і я зосереджуся саме на ній.",
    zh: "请告诉我你想进一步确认哪一部分，我会直接重点说明。",
    ja: "どの部分を明確にしたいか教えてください。そこに直接絞ってご案内します。",
    ko: "어느 부분을 더 명확히 하고 싶은지 알려주시면 그 부분에 바로 집중하겠습니다.",
    hi: "आप किस हिस्से को स्पष्ट करना चाहते हैं, यह लिखें, मैं सीधे उसी पर ध्यान दूँगा।",
  },

  unsupported_service: {
    en: "Tell me what you need, and I’ll check how closely it fits what’s available here.",
    az: "Nə lazım olduğunu yazın, buradakı imkanlara nə qədər uyğun olduğunu yoxlayım.",
    tr: "Neye ihtiyacınız olduğunu yazın, burada sunulanlara ne kadar uyduğunu kontrol edeyim.",
    ru: "Напишите, что вам нужно, и я проверю, насколько это соответствует тому, что здесь доступно.",
    es: "Cuéntame qué necesitas y revisaré qué tan bien encaja con lo que está disponible aquí.",

    de: "Beschreib, was du brauchst, dann prüfe ich, wie gut es zu dem passt, was hier angeboten wird.",
    fr: "Décrivez ce dont vous avez besoin et je vérifierai dans quelle mesure cela correspond à ce qui est proposé ici.",
    it: "Scrivi di cosa hai bisogno e verificherò quanto si adatta a ciò che è disponibile qui.",
    pt: "Descreva o que você precisa e eu verificarei o quanto isso se encaixa no que está disponível aqui.",
    ar: "اكتب ما الذي تحتاجه وسأتحقق من مدى توافقه مع ما هو متاح هنا.",
    nl: "Beschrijf wat je nodig hebt, dan kijk ik hoe goed dit past binnen wat hier beschikbaar is.",
    pl: "Opisz, czego potrzebujesz, a sprawdzę, na ile pasuje to do tego, co jest tutaj dostępne.",
    uk: "Опишіть, що вам потрібно, і я перевірю, наскільки це відповідає тому, що тут доступно.",
    zh: "请说明你的需求，我会判断它与这里可提供的内容有多匹配。",
    ja: "必要な内容を教えてください。ここで対応できる範囲にどれだけ合うか確認します。",
    ko: "필요한 내용을 알려주시면 여기서 제공 가능한 범위에 얼마나 맞는지 확인하겠습니다.",
    hi: "आपको क्या चाहिए, यह लिखें, मैं देखूँगा कि यह यहाँ उपलब्ध चीज़ों से कितना मेल खाता है।",
  },
};

const PRICING_LEAD = {
  en: "Pricing usually depends on the service, scope, and delivery expectations.",
  az: "Qiymət adətən xidmətə, scope-a və çatdırılma gözləntisinə görə dəyişir.",
  tr: "Fiyat genelde hizmete, kapsama ve teslim beklentisine göre değişir.",
  ru: "Стоимость обычно зависит от услуги, объёма и ожиданий по срокам.",
  es: "El precio normalmente depende del servicio, del alcance y de las expectativas de entrega.",

  de: "Der Preis hängt meist von Leistung, Umfang und Liefererwartung ab.",
  fr: "Le prix dépend généralement du service, du périmètre et des attentes de livraison.",
  it: "Il prezzo dipende di solito dal servizio, dall’ambito e dalle aspettative di consegna.",
  pt: "O preço normalmente depende do serviço, do escopo e das expectativas de entrega.",
  ar: "يعتمد السعر عادةً على الخدمة والنطاق وتوقعات التسليم.",
  nl: "De prijs hangt meestal af van de dienst, de omvang en de leveringsverwachting.",
  pl: "Cena zwykle zależy od usługi, zakresu i oczekiwań dotyczących realizacji.",
  uk: "Вартість зазвичай залежить від послуги, обсягу та очікувань щодо термінів.",
  zh: "价格通常取决于服务内容、范围和交付预期。",
  ja: "料金は通常、サービス内容・範囲・納期の期待によって変わります。",
  ko: "가격은 보통 서비스, 범위, 그리고 전달 기대치에 따라 달라집니다.",
  hi: "कीमत आमतौर पर सेवा, दायरे और डिलीवरी अपेक्षाओं पर निर्भर करती है।",
};

const SUPPORT_LEAD = {
  en: "I can help with that.",
  az: "Bununla kömək edə bilərəm.",
  tr: "Bununla yardımcı olabilirim.",
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
  ja: "その件はお手伝いできます。",
  ko: "그 부분은 도와드릴 수 있습니다.",
  hi: "मैं इसमें मदद कर सकता हूँ।",
};

const HANDOFF_LEAD = {
  en: "Understood — I can route this to the right person.",
  az: "Başa düşdüm — bunu uyğun şəxsə yönləndirə bilərəm.",
  tr: "Anladım — bunu doğru kişiye yönlendirebilirim.",
  ru: "Понял — я могу передать это нужному человеку.",
  es: "Entendido: puedo derivarlo a la persona correcta.",

  de: "Verstanden — ich kann das an die richtige Person weiterleiten.",
  fr: "Compris — je peux transmettre cela à la bonne personne.",
  it: "Capito: posso inoltrarlo alla persona giusta.",
  pt: "Entendido — posso encaminhar isso para a pessoa certa.",
  ar: "مفهوم — يمكنني تحويل هذا إلى الشخص المناسب.",
  nl: "Begrepen — ik kan dit doorzetten naar de juiste persoon.",
  pl: "Rozumiem — mogę przekazać to właściwej osobie.",
  uk: "Зрозуміло — я можу передати це потрібній людині.",
  zh: "明白了——我可以将此转给合适的人。",
  ja: "承知しました。適切な担当者におつなぎできます。",
  ko: "알겠습니다. 적절한 담당자에게 전달할 수 있습니다.",
  hi: "समझ गया — मैं इसे सही व्यक्ति तक पहुँचा सकता हूँ।",
};

const URGENT_LEAD = {
  en: "Understood — I’ll treat this as priority.",
  az: "Başa düşdüm — bunu prioritet kimi götürürəm.",
  tr: "Anladım — bunu öncelikli olarak ele alıyorum.",
  ru: "Понял — отмечаю это как приоритет.",
  es: "Entendido: lo tomaré como prioritario.",

  de: "Verstanden — ich behandle das priorisiert.",
  fr: "Compris — je vais le traiter en priorité.",
  it: "Capito: lo tratterò con priorità.",
  pt: "Entendido — vou tratar isso como prioridade.",
  ar: "مفهوم — سأتعامل مع هذا كأولوية.",
  nl: "Begrepen — ik behandel dit met prioriteit.",
  pl: "Rozumiem — potraktuję to priorytetowo.",
  uk: "Зрозуміло — це буде пріоритетно.",
  zh: "明白了——我会按优先事项处理。",
  ja: "承知しました。優先事項として扱います。",
  ko: "알겠습니다. 우선순위로 처리하겠습니다.",
  hi: "समझ गया — मैं इसे प्राथमिकता के रूप में लूँगा।",
};

const UNSUPPORTED_EXAMPLES = {
  en: (examples) => `The clearest matching areas here right now include ${examples}.`,
  az: (examples) => `Hazırda burada ən uyğun görünən istiqamətlərə ${examples} daxildir.`,
  tr: (examples) => `Şu anda burada en uygun görünen alanlar arasında ${examples} var.`,
  ru: (examples) => `Сейчас наиболее подходящие направления здесь включают ${examples}.`,
  es: (examples) => `Ahora mismo, las áreas que mejor encajan aquí incluyen ${examples}.`,

  de: (examples) => `Die aktuell passendsten Bereiche hier umfassen ${examples}.`,
  fr: (examples) => `Les domaines qui correspondent le mieux ici pour le moment incluent ${examples}.`,
  it: (examples) => `Le aree che qui sembrano adattarsi meglio al momento includono ${examples}.`,
  pt: (examples) => `As áreas que melhor se encaixam aqui no momento incluem ${examples}.`,
  ar: (examples) => `تشمل المجالات الأقرب ملاءمة هنا حاليًا ${examples}.`,
  nl: (examples) => `De duidelijkst passende gebieden hier op dit moment omvatten ${examples}.`,
  pl: (examples) => `Obszary, które obecnie najbardziej tu pasują, obejmują ${examples}.`,
  uk: (examples) => `Найближчі за змістом напрямки тут зараз включають ${examples}.`,
  zh: (examples) => `目前这里最匹配的方向包括 ${examples}。`,
  ja: (examples) => `現時点でここで特に近い範囲には ${examples} が含まれます。`,
  ko: (examples) => `현재 여기에서 가장 가깝게 맞는 범위에는 ${examples}가 포함됩니다.`,
  hi: (examples) => `इस समय यहाँ सबसे अधिक मेल खाने वाले क्षेत्रों में ${examples} शामिल हैं।`,
};

const UNSUPPORTED_CHECK = {
  en: "Tell me what you need, and I’ll check how closely it fits here.",
  az: "Nə lazım olduğunu yazın, burada nə qədər uyğun olduğunu yoxlayım.",
  tr: "Neye ihtiyacınız olduğunu yazın, burada ne kadar uyduğunu kontrol edeyim.",
  ru: "Напишите, что вам нужно, и я проверю, насколько это подходит здесь.",
  es: "Cuéntame qué necesitas y revisaré qué tan bien encaja aquí.",

  de: "Schreib, was du brauchst, dann prüfe ich, wie gut es hier passt.",
  fr: "Dites ce dont vous avez besoin et je vérifierai dans quelle mesure cela correspond ici.",
  it: "Scrivi di cosa hai bisogno e controllerò quanto si adatta qui.",
  pt: "Diga do que você precisa e eu verificarei o quanto isso se encaixa aqui.",
  ar: "اكتب ما الذي تحتاجه وسأتحقق من مدى توافقه هنا.",
  nl: "Vertel wat je nodig hebt, dan kijk ik hoe goed het hier past.",
  pl: "Napisz, czego potrzebujesz, a sprawdzę, na ile to tutaj pasuje.",
  uk: "Напишіть, що вам потрібно, і я перевірю, наскільки це тут підходить.",
  zh: "请告诉我你的需求，我会看看它在这里是否匹配。",
  ja: "必要な内容を教えてください。ここでどれくらい適合するか確認します。",
  ko: "필요한 내용을 알려주시면 여기에서 얼마나 맞는지 확인하겠습니다.",
  hi: "आपको क्या चाहिए, यह लिखें, मैं देखूँगा कि यह यहाँ कितना मेल खाता है।",
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