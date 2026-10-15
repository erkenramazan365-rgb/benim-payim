from typing import List, Dict, Any, Optional
from app.ai.adapter_interface import AIAdapterBase
from app.ai.schemas import (
    HelpResponseSchema,
    CheckQuestionSchema,
    CheckFeedbackSchema,
    LearningCardSchema,
    ObservationItem,
)

DEMO_LABEL = "Demo yanıtı — gerçek AI değerlendirmesi değildir."


class DemoAIAdapter(AIAdapterBase):
    """
    Deterministik ve güvenli çevrimdışı Demo AI Sağlayıcısı.
    Tüm yanıtlar açıkça etiketlenir ve kurallara harfiyen uyar.
    """

    async def generate_help(
        self,
        mode: str,
        goal: str,
        current_code: str,
        current_notes: str,
        language: str,
        source_entry_ids: List[str],
    ) -> HelpResponseSchema:
        if mode == "hint":
            content = (
                f"**[{DEMO_LABEL}]**\n\n"
                f"Hedefinize ({goal}) yönelik ipucu:\n"
                f"- Kod incelemesine göre, üzerinde çalıştığınız yapıyı adım adım parçalara ayırmayı deneyin.\n"
                f"- Giriş parametrelerinin boş veya beklenmeyen değerler alması durumunu kontrol ettiniz mi?"
            )
        elif mode == "explain":
            content = (
                f"**[{DEMO_LABEL}]**\n\n"
                f"Kod incelemesine göre mantık açıklaması:\n"
                f"Belirttiğiniz hedefte ({goal}), temel mantık veri akışını doğru sırayla işletmektir. "
                f"Yazdığınız notlar ve kod taslağında ele aldığınız durumlar, girdi verisinin dönüşümünü hedefler. "
                f"Buradaki temel kavram, her adımın çıktısının bir sonraki adımın girdisi olmasıdır."
            )
        else:  # example_solution
            content = (
                f"**[{DEMO_LABEL}]**\n\n"
                f"Kod incelemesine göre örnek çözüm yaklaşımı ({language}):\n\n"
                f"```python\n"
                f"# Örnek yaklaşım (yalnızca kavramsal gösterim)\n"
                f"def ornek_cozum(veriler):\n"
                f"    # 1. Boş kontrolü\n"
                f"    if not veriler:\n"
                f"        return []\n"
                f"    # 2. İşleme mantığı\n"
                f"    return [item for item in veriler if item is not None]\n"
                f"```\n\n"
                f"Bu yaklaşım, okunabilirliği ve sınır durumların (edge case) güvenliğini ön planda tuttuğu için seçilmiştir."
            )

        return HelpResponseSchema(
            mode=mode,
            content=content,
            disclaimer=f"Kod incelemesine göre hazırlanmıştır. Kod çalıştırılmamıştır. {DEMO_LABEL}",
            is_demo=True,
            source_entry_ids=source_entry_ids,
        )

    async def generate_check(
        self,
        goal: str,
        topic: Optional[str],
        current_code: str,
        current_notes: str,
        language: str,
        attempts: List[Dict[str, Any]],
    ) -> CheckQuestionSchema:
        return CheckQuestionSchema(
            question_type="find_bug",
            question=(
                f"**[{DEMO_LABEL}]**\n"
                f"'{goal}' konusuyla ilgili şu kısa senaryoyu inceleyin:\n"
                f"Aşağıdaki fonksiyona boş bir liste `[]` gönderildiğinde beklenmeyen bir durum oluşabilir mi?\n"
                f"```python\n"
                f"def kontrol_et(liste):\n"
                f"    return liste[0]\n"
                f"```\n"
                f"Sizce bu kodda hangi sınır durum eksik bırakılmıştır?"
            ),
            evaluation_criteria="Boş liste (IndexError) durumunun tespit edilmesi ve güvenli erişim önerilmesi.",
            hint="Listenin boyutu sıfır olduğunda ilk elemana erişmeye çalışırsanız ne olur?",
            is_demo=True,
        )

    async def evaluate_check(
        self,
        question: str,
        evaluation_criteria: str,
        user_response: str,
        used_help: bool,
    ) -> CheckFeedbackSchema:
        response_lower = user_response.lower()
        consistent = []
        missing = []

        if any(w in response_lower for w in ["boş", "empty", "index", "hata", "uzunluk", "len"]):
            consistent.append("Boş girdi / sınır durum riskine değindiniz.")
        else:
            missing.append("Boş liste durumundaki IndexError riskine açıkça değinilmemiş.")

        reasoning = (
            f"Kod incelemesine göre değerlendirme: "
            f"Yanıtınızda belirttiğiniz noktalar statik olarak incelendi. "
            f"Verdiğiniz yanıt, kontrol kriteri ({evaluation_criteria}) çerçevesinde ele alınmıştır."
        )

        return CheckFeedbackSchema(
            consistent_points=consistent or ["Yanıtınız kaydedildi."],
            missing_points=missing or ["Eksik belirgin bir nokta gözlenmedi."],
            reasoning=reasoning,
            next_step_tip="Bir sonraki denemenizde benzer bir fonksiyonu varsayılan değer ile yazmayı deneyebilirsiniz.",
            evaluation_limit=f"Değerlendirme statik metin incelemesine dayanmaktadır; kod çalıştırılmamıştır. {DEMO_LABEL}",
            is_demo=True,
        )

    async def generate_card(
        self,
        goal: str,
        topic: Optional[str],
        attempts: List[Dict[str, Any]],
        help_requests: List[Dict[str, Any]],
        check: Optional[Dict[str, Any]],
        check_attempt: Optional[Dict[str, Any]],
    ) -> LearningCardSchema:
        attempts_summary = []
        for i, att in enumerate(attempts, 1):
            att_id = att.get("id", str(i))
            lang = att.get("language", "kod")
            code_len = len(att.get("code", ""))
            attempts_summary.append(f"Deneme #{i} ({lang}): {code_len} karakter kod kaydedildi.")

        if not attempts_summary:
            attempts_summary.append("Bu oturumda kaydedilmiş bağımsız bir deneme bulunmuyor.")

        help_summary = []
        for req in help_requests:
            mode_tr = {
                "hint": "İpucu",
                "explain": "Mantık Açıklaması",
                "example_solution": "Örnek Çözüm",
            }.get(req.get("mode"), req.get("mode"))
            help_summary.append(f"{mode_tr} desteği alındı.")

        if not help_summary:
            help_summary.append("Bu oturumda harici AI desteği talep edilmedi.")

        observations: List[ObservationItem] = []

        if check and check.get("status") == "skipped":
            observations.append(
                ObservationItem(
                    observation="Bu oturumda uygulama kontrolü yapılmadı.",
                    source_entry_ids=[],
                    source_type="kullanıcı beyanı",
                )
            )
        elif check_attempt:
            resp_text = check_attempt.get("response", "")
            feedback = check_attempt.get("feedback", {})
            consistent = feedback.get("consistent_points", [])
            obs_text = "Kontrol yanıtında tutarlı gözlem: " + (", ".join(consistent) if consistent else "Yanıt verildi.")
            observations.append(
                ObservationItem(
                    observation=obs_text,
                    source_entry_ids=[str(check_attempt.get("id"))],
                    source_type="kontrol yanıtı",
                )
            )
        else:
            observations.append(
                ObservationItem(
                    observation="Bu oturumda yeterli kayıt yok.",
                    source_entry_ids=[],
                    source_type="kullanıcı beyanı",
                )
            )

        review_topic = topic or (goal[:60] + "..." if len(goal) > 60 else goal)

        return LearningCardSchema(
            goal=goal,
            saved_attempts_summary=attempts_summary,
            help_summary=help_summary,
            check_observations=observations,
            review_topic=f"{review_topic} üzerinde sınır durumlar ve hata yönetimi",
            disclaimer=f"Bu kart yetkinlik sertifikası veya başarı puanı değildir. Bu oturumda kaydedilen somut gözlemleri listeler. {DEMO_LABEL}",
            is_demo=True,
        )
