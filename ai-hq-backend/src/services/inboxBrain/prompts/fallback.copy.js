export function getFallbackDefaultQuestion() {
  return "Hazırda sizə ən vacib olan ehtiyacı bir cümlə ilə yazın.";
}

export function getFallbackQuestionByIntent(intent = "") {
  switch (String(intent || "").trim()) {
    case "greeting":
      return "Hazırda nə qurmaq, almaq və ya həll etmək istədiyinizi bir cümlə ilə yazın.";

    case "pricing":
      return "Təxmini yönləndirmə üçün nə istədiyinizi və əsas 1-2 tələbinizi yazın.";

    case "service_interest":
      return "Sizin üçün ən vacib nəticəni bir cümlə ilə yazın.";

    case "support":
      return "Problemi və harada baş verdiyini bir cümlə ilə yazın.";

    case "handoff_request":
      return "Komanda üzvünə düzgün yönləndirmək üçün mövzunu bir cümlə ilə yazın.";

    case "urgent_interest":
      return "Mövzunu bir cümlə ilə yazın, prioritetlə yönləndirək.";

    case "knowledge_answer":
      return "Nəyi dəqiqləşdirmək istədiyinizi bir cümlə ilə yazın.";

    case "unsupported_service":
      return "Ehtiyacınızı bir cümlə ilə yazın, uyğun olub-olmadığını dəqiqləşdirək.";

    default:
      return getFallbackDefaultQuestion();
  }
}

export function getPricingLeadSentence() {
  return "Dəqiq qiymət scope, funksiyalar və iş həcminə görə dəyişir.";
}

export function getSupportLeadSentence() {
  return "Kömək edək.";
}

export function getHandoffLeadSentence() {
  return "Əlbəttə, bunu komanda üzvünə yönləndirə bilərik.";
}

export function getUrgentLeadSentence() {
  return "Qeyd etdik.";
}

export function getUnsupportedExamplesSentence(examples = "") {
  return `Hazırda daha çox ${examples} kimi istiqamətlər üzrə işləyirik.`;
}

export function getUnsupportedCheckSentence() {
  return "Bu mövzunun bizdə uyğun olub-olmadığını dəqiqləşdirmək üçün ehtiyacınızı bir cümlə ilə yazın.";
}