"""Ilova sozlamalari — barcha environment o'zgaruvchilar shu yerda markazlashtirilgan."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OpenAI
    openai_api_key: str
    openai_chat_model: str = "gpt-4o"
    openai_realtime_model: str = "gpt-realtime-2.1-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_vision_model: str = "gpt-4o"  # rasmdan savol OCR/tiklash uchun (Modul 6)
    openai_whisper_model: str = "whisper-1"  # ovozdan matnga (Modul 6)
    openai_tts_model: str = "tts-1"  # ma'ruzani audio(TTS)ga aylantirish (Modul 8)
    openai_image_model: str = "gpt-image-1"  # darsdagi rasmlar (illyustratsiyalar)
    # Rasm chizish pullik (~$0.04): bitta o'quvchiga va butun platformaga kunlik chegara.
    illustrations_per_user_per_day: int = 5
    illustrations_global_per_day: int = 60
    # OpenAI xarajatini nazorat qilish: kunlik chegaralar (administratorlarga taalluqli emas).
    # Suhbatdagi bitta xabar ~2 sent (gpt-4o), ovozli suhbat (10 daqiqagacha) ~10-50 sent.
    chat_messages_per_user_per_day: int = 50
    chat_messages_global_per_day: int = 1500
    voice_sessions_per_user_per_day: int = 3
    voice_sessions_global_per_day: int = 100
    # Har bir o'quvchiga oylik AI byudjeti ($). Tugasa, oy oxirigacha pullik AI amallari to'xtaydi.
    # 0 — cheklanmaydi. Server (Render) xarajati bunga kirmaydi.
    ai_budget_per_user_per_month_usd: float = 4.0
    # Narxi tokenlardan hisoblanmaydigan amallar uchun taxminiy narx ($).
    voice_session_cost_usd: float = 0.15
    illustration_cost_usd: float = 0.04
    tts_cost_per_million_chars_usd: float = 15.0

    # Google Gemini (ixtiyoriy): kalit qo'yilsa, matnli suhbat va testlar Gemini'da ishlaydi —
    # OpenAI'dan bir necha barobar arzon. Ovoz, rasm, embedding — OpenAI'da qoladi.
    # GEMINI_MODEL=auto — kalit bilan mavjud modellardan eng yangi "flash" tanlanadi.
    gemini_api_key: str = ""
    gemini_model: str = "auto"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    gemini_price_input_per_m: float = 0.50
    gemini_price_output_per_m: float = 3.00
    # Internetdagi haqiqiy rasmlar (Wikimedia Commons, bepul). Wikimedia so'rovlarda ilova
    # nomi va aloqa (sayt yoki email) yozilgan User-Agent talab qiladi — productionda o'zingiznikini qo'ying.
    commons_user_agent: str = "AIUstozBot/1.0 (educational tutor app; https://github.com/muxriddin3626-droid/Boshqaruv)"
    photos_per_user_per_day: int = 40
    photos_global_per_day: int = 2000
    # Darslik yuklash (RAG bilim bazasi). Faqat shu telefon raqamli foydalanuvchilar (vergul bilan,
    # masalan "+998901234567,+998931112233") darslik yuklay oladi. Bo'sh bo'lsa — hech kim.
    admin_phones: str = ""
    textbook_max_mb: int = 100
    # Skaner (matnsiz) sahifalarni o'qish (OCR): bitta darslikda ko'pi bilan shuncha sahifa.
    textbook_ocr_max_pages: int = 400
    # "tesseract" — bepul, serverning o'zida (o'zbek tili paketi bilan); "openai" — GPT-4o vision, pullik
    # (~1 sent/sahifa), formulalarni aniqroq o'qiydi. Tesseract o'rnatilmagan bo'lsa, openai ishlatiladi.
    textbook_ocr_engine: str = "tesseract"
    textbook_ocr_lang: str = "uzb"

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    # Rate limiting (IP bo'yicha). Limitlar ataylab yumshoq: mobil operatorlar
    # (CGNAT) va maktab Wi-Fi'larida ko'p o'quvchi bitta IP'dan chiqadi.
    login_max_failures_per_ip: int = 30  # 15 daqiqada, faqat noto'g'ri urinishlar sanaladi
    registrations_per_ip_per_hour: int = 30
    # Backend oldida nechta ishonchli reverse proxy turibdi (nginx, Render, Railway...).
    # 0 — proksi yo'q, IP to'g'ridan-to'g'ri ulanishdan olinadi va X-Forwarded-For
    # e'tiborga olinmaydi (aks holda uni soxtalashtirib cheklovni chetlab o'tish mumkin).
    trusted_proxy_count: int = 0

    # App
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"

    # Session state
    conversation_history_ttl_seconds: int = 86400
    conversation_history_max_messages: int = 30

    # Supabase Storage (Modul 8: Audio Lecture Engine)
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_audio_bucket: str = "audio_lectures"
    # Supabase sozlanmagan bo'lsa audio shu papkaga yoziladi. Productionda doimiy
    # disk (volume) bo'lishi shart — konteyner qayta ishga tushsa fayllar yo'qolmasin.
    media_dir: str = "media"

    # Web-search provider (Modul 7: Autonomous Researcher) — Tavily/Serper uslubidagi
    # JSON API: POST {query} -> {results: [{title, url, content}]}. Sozlanmasa,
    # research_service so'rovlarni jim o'tkazib yuboradi (xato tashlamaydi).
    web_search_api_url: str = ""
    web_search_api_key: str = ""

    # Autonomous scheduler (Modul 7)
    research_scan_enabled: bool = False
    research_scan_interval_hours: int = 24
    innovation_scan_interval_hours: int = 24

    @property
    def admin_phone_set(self) -> set[str]:
        return {phone.strip() for phone in self.admin_phones.split(",") if phone.strip()}

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
