import { arr, compactDraftObject, obj, s } from "../draftShared.js";

export const SUPPORTED_SETUP_LOCALES = [
  "az-AZ",
  "en",
  "tr",
  "ru",
  "ar",
  "es",
  "fr",
  "de",
  "pt",
  "hi",
];

const LOCALE_ALIASES = {
  az: "az-AZ",
  "az-az": "az-AZ",
  azerbaijani: "az-AZ",
  azeri: "az-AZ",

  en: "en",
  "en-us": "en",
  "en-gb": "en",
  english: "en",

  tr: "tr",
  "tr-tr": "tr",
  turkish: "tr",

  ru: "ru",
  "ru-ru": "ru",
  russian: "ru",

  ar: "ar",
  "ar-sa": "ar",
  arabic: "ar",

  es: "es",
  "es-es": "es",
  spanish: "es",

  fr: "fr",
  "fr-fr": "fr",
  french: "fr",

  de: "de",
  "de-de": "de",
  german: "de",

  pt: "pt",
  "pt-br": "pt",
  "pt-pt": "pt",
  portuguese: "pt",

  hi: "hi",
  "hi-in": "hi",
  hindi: "hi",
};

const BASE_GROUP = "business_truth";
const BASE_GROUP_LABEL = "Business truth";

const COPY = {
  "az-AZ": {
    and: "və",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "Biznes adı",
        title: "Biznes adı",
        prompt:
          "Başlayaq. Şirkətinizin adını yazın. Sayt varsa onu da yaza bilərsiniz.",
      },
      description: {
        label: "Biznes təsviri",
        title: "Biznes təsviri",
        prompt: "Qısa deyin: bu biznes nə iş görür?",
      },
      services: {
        label: "Əsas xidmətlər",
        title: "Əsas xidmətlər",
        prompt: "Əsas xidmətləri vergüllə yazın.",
      },
      contacts: {
        label: "Əlaqə yolu",
        title: "Əlaqə yolu",
        prompt:
          "Əlaqə üçün əsas nömrəni, WhatsApp-ı, emaili və ya linki yazın.",
      },
      hours: {
        label: "İş saatları",
        title: "İş saatları",
        prompt:
          "İş saatlarını bir cümlə ilə yazın. Məsələn: həftə içi 09:00–18:00.",
      },
      pricing: {
        label: "Qiymət yanaşması",
        title: "Qiymət yanaşması",
        prompt:
          "Qiymət cavablarını AI necə versin: dəqiq qiymət, başlanğıc qiymət, yoxsa əvvəlcə sorğu alsın?",
      },
      handoff: {
        label: "İnsana yönləndirmə",
        title: "İnsana yönləndirmə",
        prompt: "Hansı hallarda AI mütləq insana yönləndirsin?",
      },
    },
    phrases: {
      readyForApproval:
        "Əla. Setup draft kifayət qədər doludur. İstəsəniz yoxlayıb təsdiqləyə bilərik.",
      companyCaptured: "Qeyd etdim: şirkətin adı {value}.",
      descriptionCaptured: "Qeyd etdim: {value}.",
      servicesCaptured: "Qeyd etdim: əsas xidmətlərə {value} daxildir.",
      contactsCaptured: "Əlaqə yolunu qeyd etdim.",
      hoursCaptured: "İş saatlarını qeyd etdim.",
      pricingCaptured: "Qiymət yanaşmasını qeyd etdim.",
      handoffCaptured: "İnsana yönləndirmə qaydalarını qeyd etdim.",
      genericCaptured: "Qeyd etdim.",
      redirectPrefix: "İndi bunu bağlayaq:",
    },
  },

  en: {
    and: "and",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "Business name",
        title: "Business name",
        prompt:
          "Let’s start. Write your business name. If you have a website, you can include that too.",
      },
      description: {
        label: "Business description",
        title: "Business description",
        prompt: "Briefly: what does this business do?",
      },
      services: {
        label: "Core services",
        title: "Core services",
        prompt: "Write the core services, separated by commas.",
      },
      contacts: {
        label: "Contact route",
        title: "Contact route",
        prompt:
          "Write the main phone number, WhatsApp, email, or contact link.",
      },
      hours: {
        label: "Working hours",
        title: "Working hours",
        prompt:
          "Write the working hours in one sentence. Example: weekdays 09:00–18:00.",
      },
      pricing: {
        label: "Pricing posture",
        title: "Pricing posture",
        prompt:
          "How should AI answer pricing questions: exact price, starting price, or request details first?",
      },
      handoff: {
        label: "Human handoff",
        title: "Human handoff",
        prompt: "In which cases must AI hand the conversation to a human?",
      },
    },
    phrases: {
      readyForApproval:
        "Great. The setup draft looks complete enough. We can review and confirm it next.",
      companyCaptured: "Got it: the business name is {value}.",
      descriptionCaptured: "Got it: {value}.",
      servicesCaptured: "Got it: the core services include {value}.",
      contactsCaptured: "Got it. I noted the main contact route.",
      hoursCaptured: "Got it. I noted the working hours.",
      pricingCaptured: "Got it. I noted the pricing approach.",
      handoffCaptured: "Got it. I noted the human handoff rules.",
      genericCaptured: "Got it.",
      redirectPrefix: "Let’s lock in this part now:",
    },
  },

  tr: {
    and: "ve",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "İşletme adı",
        title: "İşletme adı",
        prompt:
          "Başlayalım. İşletme adınızı yazın. Web siteniz varsa onu da ekleyebilirsiniz.",
      },
      description: {
        label: "İşletme açıklaması",
        title: "İşletme açıklaması",
        prompt: "Kısaca: bu işletme ne yapıyor?",
      },
      services: {
        label: "Ana hizmetler",
        title: "Ana hizmetler",
        prompt: "Ana hizmetleri virgülle yazın.",
      },
      contacts: {
        label: "İletişim kanalı",
        title: "İletişim kanalı",
        prompt:
          "Ana telefon numarasını, WhatsApp’ı, email’i veya iletişim linkini yazın.",
      },
      hours: {
        label: "Çalışma saatleri",
        title: "Çalışma saatleri",
        prompt:
          "Çalışma saatlerini tek cümlede yazın. Örnek: hafta içi 09:00–18:00.",
      },
      pricing: {
        label: "Fiyat yaklaşımı",
        title: "Fiyat yaklaşımı",
        prompt:
          "AI fiyat sorularını nasıl cevaplasın: net fiyat, başlangıç fiyatı veya önce detay istesin?",
      },
      handoff: {
        label: "İnsana yönlendirme",
        title: "İnsana yönlendirme",
        prompt: "AI hangi durumlarda mutlaka bir insana yönlendirmeli?",
      },
    },
    phrases: {
      readyForApproval:
        "Harika. Kurulum taslağı yeterince dolu görünüyor. İsterseniz gözden geçirip onaylayabiliriz.",
      companyCaptured: "Not ettim: işletme adı {value}.",
      descriptionCaptured: "Not ettim: {value}.",
      servicesCaptured: "Not ettim: ana hizmetler arasında {value} var.",
      contactsCaptured: "İletişim kanalını not ettim.",
      hoursCaptured: "Çalışma saatlerini not ettim.",
      pricingCaptured: "Fiyat yaklaşımını not ettim.",
      handoffCaptured: "İnsana yönlendirme kurallarını not ettim.",
      genericCaptured: "Not ettim.",
      redirectPrefix: "Şimdi şu kısmı netleştirelim:",
    },
  },

  ru: {
    and: "и",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "Название бизнеса",
        title: "Название бизнеса",
        prompt:
          "Давайте начнём. Напишите название бизнеса. Если есть сайт, можете указать и его.",
      },
      description: {
        label: "Описание бизнеса",
        title: "Описание бизнеса",
        prompt: "Коротко: чем занимается этот бизнес?",
      },
      services: {
        label: "Основные услуги",
        title: "Основные услуги",
        prompt: "Напишите основные услуги через запятую.",
      },
      contacts: {
        label: "Контактный канал",
        title: "Контактный канал",
        prompt:
          "Напишите основной номер, WhatsApp, email или ссылку для связи.",
      },
      hours: {
        label: "Часы работы",
        title: "Часы работы",
        prompt:
          "Напишите часы работы одним предложением. Например: будни 09:00–18:00.",
      },
      pricing: {
        label: "Подход к ценам",
        title: "Подход к ценам",
        prompt:
          "Как AI должен отвечать на вопросы о цене: точная цена, стартовая цена или сначала запросить детали?",
      },
      handoff: {
        label: "Передача человеку",
        title: "Передача человеку",
        prompt:
          "В каких случаях AI обязательно должен передавать диалог человеку?",
      },
    },
    phrases: {
      readyForApproval:
        "Отлично. Черновик настройки выглядит достаточно полным. Можем проверить и подтвердить его.",
      companyCaptured: "Зафиксировал: название бизнеса — {value}.",
      descriptionCaptured: "Зафиксировал: {value}.",
      servicesCaptured: "Зафиксировал: среди основных услуг есть {value}.",
      contactsCaptured: "Контактный канал зафиксирован.",
      hoursCaptured: "Часы работы зафиксированы.",
      pricingCaptured: "Подход к ценам зафиксирован.",
      handoffCaptured: "Правила передачи человеку зафиксированы.",
      genericCaptured: "Зафиксировал.",
      redirectPrefix: "Теперь давайте закроем эту часть:",
    },
  },

  ar: {
    and: "و",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "اسم النشاط",
        title: "اسم النشاط",
        prompt:
          "لنبدأ. اكتب اسم النشاط. وإذا كان لديك موقع إلكتروني يمكنك إضافته أيضاً.",
      },
      description: {
        label: "وصف النشاط",
        title: "وصف النشاط",
        prompt: "باختصار: ماذا يفعل هذا النشاط؟",
      },
      services: {
        label: "الخدمات الأساسية",
        title: "الخدمات الأساسية",
        prompt: "اكتب الخدمات الأساسية مفصولة بفواصل.",
      },
      contacts: {
        label: "وسيلة التواصل",
        title: "وسيلة التواصل",
        prompt:
          "اكتب رقم الهاتف الأساسي أو واتساب أو البريد الإلكتروني أو رابط التواصل.",
      },
      hours: {
        label: "ساعات العمل",
        title: "ساعات العمل",
        prompt:
          "اكتب ساعات العمل في جملة واحدة. مثال: أيام العمل 09:00–18:00.",
      },
      pricing: {
        label: "أسلوب الرد على الأسعار",
        title: "أسلوب الرد على الأسعار",
        prompt:
          "كيف يجب أن يجيب الذكاء الاصطناعي عن الأسعار: سعر دقيق أم سعر يبدأ من أم يطلب التفاصيل أولاً؟",
      },
      handoff: {
        label: "التحويل إلى إنسان",
        title: "التحويل إلى إنسان",
        prompt:
          "في أي حالات يجب أن يحوّل الذكاء الاصطناعي المحادثة إلى شخص حقيقي؟",
      },
    },
    phrases: {
      readyForApproval:
        "ممتاز. مسودة الإعداد أصبحت مكتملة بشكل جيد. يمكننا مراجعتها وتأكيدها.",
      companyCaptured: "تم تسجيل اسم النشاط: {value}.",
      descriptionCaptured: "تم التسجيل: {value}.",
      servicesCaptured: "تم تسجيل أن الخدمات الأساسية تشمل {value}.",
      contactsCaptured: "تم تسجيل وسيلة التواصل.",
      hoursCaptured: "تم تسجيل ساعات العمل.",
      pricingCaptured: "تم تسجيل أسلوب التسعير.",
      handoffCaptured: "تم تسجيل قواعد التحويل إلى إنسان.",
      genericCaptured: "تم التسجيل.",
      redirectPrefix: "الآن لنغلق هذه النقطة:",
    },
  },

  es: {
    and: "y",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "Nombre del negocio",
        title: "Nombre del negocio",
        prompt:
          "Empecemos. Escribe el nombre del negocio. Si tienes sitio web, también puedes ponerlo.",
      },
      description: {
        label: "Descripción del negocio",
        title: "Descripción del negocio",
        prompt: "Brevemente: ¿a qué se dedica este negocio?",
      },
      services: {
        label: "Servicios principales",
        title: "Servicios principales",
        prompt: "Escribe los servicios principales separados por comas.",
      },
      contacts: {
        label: "Canal de contacto",
        title: "Canal de contacto",
        prompt:
          "Escribe el número principal, WhatsApp, email o enlace de contacto.",
      },
      hours: {
        label: "Horario",
        title: "Horario",
        prompt:
          "Escribe el horario en una sola frase. Ejemplo: lunes a viernes 09:00–18:00.",
      },
      pricing: {
        label: "Enfoque de precios",
        title: "Enfoque de precios",
        prompt:
          "¿Cómo debe responder la IA sobre precios: precio exacto, desde X, o pedir detalles primero?",
      },
      handoff: {
        label: "Derivación a humano",
        title: "Derivación a humano",
        prompt:
          "¿En qué casos la IA debe pasar la conversación a una persona?",
      },
    },
    phrases: {
      readyForApproval:
        "Perfecto. El borrador de configuración ya está bastante completo. Podemos revisarlo y confirmarlo.",
      companyCaptured: "Anotado: el nombre del negocio es {value}.",
      descriptionCaptured: "Anotado: {value}.",
      servicesCaptured: "Anotado: los servicios principales incluyen {value}.",
      contactsCaptured: "Anoté la vía principal de contacto.",
      hoursCaptured: "Anoté el horario.",
      pricingCaptured: "Anoté el enfoque de precios.",
      handoffCaptured: "Anoté las reglas de derivación a humano.",
      genericCaptured: "Anotado.",
      redirectPrefix: "Ahora cerremos esta parte:",
    },
  },

  fr: {
    and: "et",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "Nom de l’entreprise",
        title: "Nom de l’entreprise",
        prompt:
          "Commençons. Écrivez le nom de l’entreprise. Si vous avez un site web, vous pouvez aussi l’ajouter.",
      },
      description: {
        label: "Description de l’entreprise",
        title: "Description de l’entreprise",
        prompt: "En bref : que fait cette entreprise ?",
      },
      services: {
        label: "Services principaux",
        title: "Services principaux",
        prompt: "Écrivez les services principaux, séparés par des virgules.",
      },
      contacts: {
        label: "Canal de contact",
        title: "Canal de contact",
        prompt:
          "Écrivez le numéro principal, le WhatsApp, l’email ou le lien de contact.",
      },
      hours: {
        label: "Horaires",
        title: "Horaires",
        prompt:
          "Écrivez les horaires en une phrase. Exemple : du lundi au vendredi 09:00–18:00.",
      },
      pricing: {
        label: "Positionnement tarifaire",
        title: "Positionnement tarifaire",
        prompt:
          "Comment l’IA doit-elle répondre sur les prix : prix exact, prix de départ, ou demande de détails d’abord ?",
      },
      handoff: {
        label: "Passage à un humain",
        title: "Passage à un humain",
        prompt:
          "Dans quels cas l’IA doit-elle obligatoirement transférer vers un humain ?",
      },
    },
    phrases: {
      readyForApproval:
        "Parfait. Le brouillon de configuration semble suffisamment rempli. Nous pouvons le relire et le confirmer.",
      companyCaptured: "Noté : le nom de l’entreprise est {value}.",
      descriptionCaptured: "Noté : {value}.",
      servicesCaptured: "Noté : les services principaux incluent {value}.",
      contactsCaptured: "J’ai noté le canal de contact principal.",
      hoursCaptured: "J’ai noté les horaires.",
      pricingCaptured: "J’ai noté l’approche tarifaire.",
      handoffCaptured: "J’ai noté les règles de transfert vers un humain.",
      genericCaptured: "Noté.",
      redirectPrefix: "Maintenant, verrouillons cette partie :",
    },
  },

  de: {
    and: "und",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "Firmenname",
        title: "Firmenname",
        prompt:
          "Legen wir los. Schreiben Sie den Firmennamen. Falls es eine Website gibt, können Sie sie auch angeben.",
      },
      description: {
        label: "Geschäftsbeschreibung",
        title: "Geschäftsbeschreibung",
        prompt: "Kurz gesagt: Was macht dieses Unternehmen?",
      },
      services: {
        label: "Kernleistungen",
        title: "Kernleistungen",
        prompt: "Schreiben Sie die wichtigsten Leistungen, getrennt durch Kommas.",
      },
      contacts: {
        label: "Kontaktweg",
        title: "Kontaktweg",
        prompt:
          "Schreiben Sie die Hauptnummer, WhatsApp, E-Mail oder einen Kontaktlink.",
      },
      hours: {
        label: "Öffnungszeiten",
        title: "Öffnungszeiten",
        prompt:
          "Schreiben Sie die Öffnungszeiten in einem Satz. Beispiel: werktags 09:00–18:00.",
      },
      pricing: {
        label: "Preislogik",
        title: "Preislogik",
        prompt:
          "Wie soll die KI auf Preisfragen antworten: exakter Preis, Einstiegspreis oder zuerst Details anfragen?",
      },
      handoff: {
        label: "Übergabe an Menschen",
        title: "Übergabe an Menschen",
        prompt:
          "In welchen Fällen muss die KI das Gespräch an einen Menschen übergeben?",
      },
    },
    phrases: {
      readyForApproval:
        "Super. Der Setup-Entwurf wirkt ausreichend vollständig. Wir können ihn jetzt prüfen und bestätigen.",
      companyCaptured: "Notiert: Der Firmenname ist {value}.",
      descriptionCaptured: "Notiert: {value}.",
      servicesCaptured: "Notiert: Zu den Kernleistungen gehören {value}.",
      contactsCaptured: "Den Hauptkontaktweg habe ich notiert.",
      hoursCaptured: "Die Öffnungszeiten habe ich notiert.",
      pricingCaptured: "Die Preislogik habe ich notiert.",
      handoffCaptured: "Die Regeln für die Übergabe an Menschen habe ich notiert.",
      genericCaptured: "Notiert.",
      redirectPrefix: "Jetzt schließen wir diesen Teil ab:",
    },
  },

  pt: {
    and: "e",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "Nome do negócio",
        title: "Nome do negócio",
        prompt:
          "Vamos começar. Escreva o nome do negócio. Se tiver site, pode incluir também.",
      },
      description: {
        label: "Descrição do negócio",
        title: "Descrição do negócio",
        prompt: "Resumindo: o que este negócio faz?",
      },
      services: {
        label: "Serviços principais",
        title: "Serviços principais",
        prompt: "Escreva os serviços principais separados por vírgulas.",
      },
      contacts: {
        label: "Canal de contato",
        title: "Canal de contato",
        prompt:
          "Escreva o número principal, WhatsApp, email ou link de contato.",
      },
      hours: {
        label: "Horário de funcionamento",
        title: "Horário de funcionamento",
        prompt:
          "Escreva o horário em uma frase. Exemplo: dias úteis 09:00–18:00.",
      },
      pricing: {
        label: "Postura de preços",
        title: "Postura de preços",
        prompt:
          "Como a IA deve responder sobre preços: valor exato, preço a partir de, ou pedir detalhes primeiro?",
      },
      handoff: {
        label: "Encaminhamento humano",
        title: "Encaminhamento humano",
        prompt:
          "Em quais casos a IA deve encaminhar a conversa para uma pessoa?",
      },
    },
    phrases: {
      readyForApproval:
        "Ótimo. O rascunho de setup já parece suficientemente completo. Podemos revisar e confirmar.",
      companyCaptured: "Anotado: o nome do negócio é {value}.",
      descriptionCaptured: "Anotado: {value}.",
      servicesCaptured: "Anotado: os serviços principais incluem {value}.",
      contactsCaptured: "Anotei o principal canal de contato.",
      hoursCaptured: "Anotei o horário de funcionamento.",
      pricingCaptured: "Anotei a postura de preços.",
      handoffCaptured: "Anotei as regras de encaminhamento humano.",
      genericCaptured: "Anotado.",
      redirectPrefix: "Agora vamos fechar esta parte:",
    },
  },

  hi: {
    and: "और",
    groupLabel: BASE_GROUP_LABEL,
    steps: {
      company: {
        label: "बिज़नेस का नाम",
        title: "बिज़नेस का नाम",
        prompt:
          "शुरू करते हैं। अपने बिज़नेस का नाम लिखिए। वेबसाइट हो तो वह भी लिख सकते हैं।",
      },
      description: {
        label: "बिज़नेस विवरण",
        title: "बिज़नेस विवरण",
        prompt: "संक्षेप में: यह बिज़नेस क्या करता है?",
      },
      services: {
        label: "मुख्य सेवाएँ",
        title: "मुख्य सेवाएँ",
        prompt: "मुख्य सेवाएँ कॉमा लगाकर लिखिए।",
      },
      contacts: {
        label: "संपर्क तरीका",
        title: "संपर्क तरीका",
        prompt:
          "मुख्य फ़ोन नंबर, WhatsApp, email या संपर्क लिंक लिखिए।",
      },
      hours: {
        label: "कार्य समय",
        title: "कार्य समय",
        prompt:
          "कार्य समय एक वाक्य में लिखिए। उदाहरण: सप्ताह के दिनों में 09:00–18:00.",
      },
      pricing: {
        label: "प्राइसिंग तरीका",
        title: "प्राइसिंग तरीका",
        prompt:
          "AI को कीमत के सवालों का जवाब कैसे देना चाहिए: सटीक कीमत, शुरुआती कीमत, या पहले विवरण माँगे?",
      },
      handoff: {
        label: "मानव को सौंपना",
        title: "मानव को सौंपना",
        prompt:
          "किन स्थितियों में AI को बातचीत ज़रूर किसी इंसान को सौंपनी चाहिए?",
      },
    },
    phrases: {
      readyForApproval:
        "बहुत अच्छा। सेटअप ड्राफ्ट अब काफ़ी पूरा लग रहा है। हम इसे रिव्यू करके कन्फर्म कर सकते हैं।",
      companyCaptured: "नोट कर लिया: बिज़नेस का नाम {value} है।",
      descriptionCaptured: "नोट कर लिया: {value}.",
      servicesCaptured: "नोट कर लिया: मुख्य सेवाओं में {value} शामिल हैं।",
      contactsCaptured: "मुख्य संपर्क तरीका नोट कर लिया।",
      hoursCaptured: "कार्य समय नोट कर लिया।",
      pricingCaptured: "प्राइसिंग तरीका नोट कर लिया।",
      handoffCaptured: "मानव को सौंपने के नियम नोट कर लिए।",
      genericCaptured: "नोट कर लिया।",
      redirectPrefix: "अब इस हिस्से को पूरा करते हैं:",
    },
  },
};

export const SECTION_ORDER = [
  "company",
  "description",
  "services",
  "contacts",
  "hours",
  "pricing",
  "handoff",
];

export const SECTION_META = {
  source_capture: {
    key: "source_capture",
    label: "Public source",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  profile: {
    key: "profile",
    label: "Identity",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  company: {
    key: "company",
    label: "Business name",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  description: {
    key: "description",
    label: "Business description",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  website: {
    key: "website",
    label: "Website",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  services: {
    key: "services",
    label: "Services",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  contacts: {
    key: "contacts",
    label: "Contact route",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  hours: {
    key: "hours",
    label: "Hours",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  pricing: {
    key: "pricing",
    label: "Pricing posture",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
  handoff: {
    key: "handoff",
    label: "Human handoff",
    group: BASE_GROUP,
    groupLabel: BASE_GROUP_LABEL,
  },
};

export const INTENT_ONLY_RESPONSES = {
  ok: "__continue__",
  okay: "__continue__",
  davam: "__continue__",
  continue: "__continue__",
  next: "__continue__",
  beli: "__continue__",
  bəli: "__continue__",
  hə: "__continue__",
  he: "__continue__",
  oldu: "__continue__",
  tamam: "__continue__",

  skip: "__skip__",
  keç: "__skip__",
  kec: "__skip__",

  "24/7": "__always_open__",
  "24 7": "__always_open__",
  "always open": "__always_open__",

  "appointment only": "__appointment_only__",

  "exact pricing requires a quote": "__quote_required__",
  "quote required": "__quote_required__",
};

function normalizeText(value = "") {
  return s(value).replace(/\s+/g, " ").trim();
}

export function normalizeSetupLocale(value = "") {
  const raw = normalizeText(value).toLowerCase();
  return LOCALE_ALIASES[raw] || "az-AZ";
}

export function getSetupCopy(locale = "") {
  return COPY[normalizeSetupLocale(locale)] || COPY["az-AZ"];
}

export function normalizeQuestionKey(value = "") {
  const key = s(value).toLowerCase();

  if (!key) return "";
  if (key === "contact") return "contacts";
  if (key === "price") return "pricing";
  if (key === "pricing_posture") return "pricing";
  if (key === "business_name") return "company";
  if (key === "business_description") return "description";
  if (key === "setup_assistant") return "";
  if (key === "source_capture") return "";
  if (key === "profile") return "";
  if (key === "website") return "company";

  return key;
}

function hasMeaningfulServices(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.title || item?.name || item?.label))
  );
}

function hasMeaningfulContacts(value = []) {
  return arr(value).some((item) =>
    Boolean(s(item?.value || item?.label || item?.channel || item?.type))
  );
}

function hasMeaningfulHours(value = []) {
  return arr(value).some((item) => {
    const row = obj(item);
    return Boolean(
      row.allDay === true ||
        row.appointmentOnly === true ||
        row.closed === true ||
        s(row.openTime) ||
        s(row.closeTime) ||
        s(row.notes)
    );
  });
}

function hasMeaningfulPricing(value = {}) {
  const pricing = obj(value);
  return Boolean(
    s(pricing.publicSummary) ||
      s(pricing.pricingMode) ||
      s(pricing.pricingNotes) ||
      Number.isFinite(Number(pricing.startingAt)) ||
      Number.isFinite(Number(pricing.minPrice))
  );
}

function hasMeaningfulHandoff(value = {}) {
  const handoff = obj(value);
  return Boolean(s(handoff.summary) || arr(handoff.triggers).length > 0);
}

export function hasSetupSignalForInterview(draft = {}) {
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);
  const sourceMetadata = obj(safeDraft.sourceMetadata);

  return Boolean(
    s(businessProfile.companyName) ||
      s(businessProfile.description) ||
      s(businessProfile.websiteUrl) ||
      hasMeaningfulServices(safeDraft.services) ||
      hasMeaningfulContacts(safeDraft.contacts) ||
      hasMeaningfulHours(safeDraft.hours) ||
      hasMeaningfulPricing(safeDraft.pricingPosture) ||
      hasMeaningfulHandoff(safeDraft.handoffRules) ||
      s(sourceMetadata.primarySourceType) ||
      s(sourceMetadata.primarySourceUrl) ||
      arr(sourceMetadata.sourceLabels).length ||
      arr(sourceMetadata.evidenceSummary).length
  );
}

export function isQuestionSatisfied(questionKey = "", draft = {}) {
  const key = normalizeQuestionKey(questionKey);
  const safeDraft = obj(draft);
  const businessProfile = obj(safeDraft.businessProfile);

  if (!key) return false;

  if (key === "company") {
    return Boolean(s(businessProfile.companyName));
  }

  if (key === "description") {
    return Boolean(s(businessProfile.description));
  }

  if (key === "services") {
    return hasMeaningfulServices(safeDraft.services);
  }

  if (key === "contacts") {
    return hasMeaningfulContacts(safeDraft.contacts);
  }

  if (key === "hours") {
    return hasMeaningfulHours(safeDraft.hours);
  }

  if (key === "pricing") {
    return hasMeaningfulPricing(safeDraft.pricingPosture);
  }

  if (key === "handoff") {
    return hasMeaningfulHandoff(safeDraft.handoffRules);
  }

  return false;
}

export function buildAssistantQuestion(key = "", overrides = {}, options = {}) {
  const questionKey = normalizeQuestionKey(key) || "company";
  const meta = obj(SECTION_META[questionKey] || SECTION_META.company);
  const source = obj(overrides);
  const locale =
    typeof options === "string"
      ? normalizeSetupLocale(options)
      : normalizeSetupLocale(options?.locale);
  const copy = getSetupCopy(locale);
  const localized = obj(copy.steps?.[questionKey]);

  return compactDraftObject({
    key: questionKey,
    step: s(source.step || questionKey).toLowerCase(),
    label: s(source.label || localized.label || meta.label),
    title: s(source.title || localized.title || localized.label || meta.label),
    prompt: normalizeText(source.prompt || localized.prompt),
    placeholder: s(source.placeholder),
    group: s(source.group || meta.group || BASE_GROUP),
    groupLabel: s(
      source.groupLabel || localized.groupLabel || copy.groupLabel || BASE_GROUP_LABEL
    ),
    priority: Number(source.priority || 1) || 1,
  });
}

export function getNextQuestion(summary = {}, draft = {}, progress = {}, options = {}) {
  void summary;

  const locale = normalizeSetupLocale(
    typeof options === "string" ? options : options?.locale
  );
  const preferQuestionKey = normalizeQuestionKey(
    s(
      obj(options).preferQuestionKey ||
        obj(progress).currentQuestionKey ||
        obj(progress).lastAnsweredStep
    )
  );

  if (
    preferQuestionKey &&
    SECTION_ORDER.includes(preferQuestionKey) &&
    !isQuestionSatisfied(preferQuestionKey, draft)
  ) {
    return buildAssistantQuestion(preferQuestionKey, {}, { locale });
  }

  for (const step of SECTION_ORDER) {
    if (!isQuestionSatisfied(step, draft)) {
      return buildAssistantQuestion(step, {}, { locale });
    }
  }

  return null;
}

export const __test__ = {
  hasMeaningfulServices,
  hasMeaningfulContacts,
  hasMeaningfulHours,
  hasMeaningfulPricing,
  hasMeaningfulHandoff,
};