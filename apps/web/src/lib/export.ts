import { LearningCardData } from "./api";

/**
 * Öğrenme kartını GitHub Flavored Markdown formatında indirir.
 * AI taslağı ile kullanıcının kendi notu açıkça ayrı başlıklar altında yer alır.
 */
export function exportCardToMarkdown(card: LearningCardData) {
  const dateStr = new Date(card.created_at).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const content = `# Öğrenme Kartı: ${card.ai_draft.goal}
*Oluşturulma Tarihi: ${dateStr}*

---

## 1. Bugünkü Hedef
${card.ai_draft.goal}

---

## 2. Kaydedilen Denemeler
${
  card.ai_draft.saved_attempts_summary.length > 0
    ? card.ai_draft.saved_attempts_summary.map((s) => `- ${s}`).join("\n")
    : "- Bu oturumda kaydedilmiş bağımsız bir deneme bulunmuyor."
}

---

## 3. Alınan AI Desteği
${
  card.ai_draft.help_summary.length > 0
    ? card.ai_draft.help_summary.map((s) => `- ${s}`).join("\n")
    : "- Bu oturumda harici AI desteği talep edilmedi."
}

---

## 4. Gözlenen Somut Noktalar (AI Taslağı)
${
  card.ai_draft.check_observations.length > 0
    ? card.ai_draft.check_observations
        .map((obs) => `- ${obs.observation} *(Kaynak: ${obs.source_type})*`)
        .join("\n")
    : "- Gözlem bulunmuyor."
}

---

## 5. Tekrar Bakılabilecek Konu
${card.ai_draft.review_topic}

---

## 6. Senin Notun (Kişisel Öğrenme Notun)
${card.user_note ? card.user_note : "*(Bu oturum için henüz kişisel bir not eklenmedi.)*"}

---

> [!NOTE]
> ${card.ai_draft.disclaimer}
`;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = card.ai_draft.goal
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç]+/gi, "-")
    .slice(0, 30);
  a.download = `ogrenme-karti-${safeTitle || card.session_id.slice(0, 8)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
