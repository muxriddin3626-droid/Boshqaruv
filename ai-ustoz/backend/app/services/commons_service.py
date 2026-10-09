"""
Wikimedia Commons'dan bepul (erkin litsenziyali) rasm qidirish.

Faqat qayta ishlatish uchun ochiq litsenziyalar olinadi: Public domain, CC0,
CC BY, CC BY-SA. Muallif va litsenziya rasm bilan birga saqlanadi va
ko'rsatiladi (CC BY / BY-SA shuni talab qiladi).

O'quvchilar 10-17 yosh: sarlavha/tavsifida nomaqbul so'z bo'lgan rasmlar
tashlanadi, yuklangan rasm esa qo'shimcha OpenAI moderatsiyasidan o'tadi
(photo_service). Diagrammalar (SVG chizmalar) suratlardan oldin tanlanadi —
ular darslik uslubida va deyarli har doim "toza".

SVG faylning o'zi hech qachon yuklanmaydi (ichida skript bo'lishi mumkin):
Commons uni PNG ko'rinishida (thumbnail) beradi, o'sha olinadi.
"""
import html
import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import get_settings

settings = get_settings()

API_URL = "https://commons.wikimedia.org/w/api.php"
THUMB_WIDTH = 1024
MIN_WIDTH = 300
MAX_DOWNLOAD_BYTES = 6 * 1024 * 1024
# Commons thumbnail'lari shu formatlarda keladi; media route ham faqat shularni beradi.
STORED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
SOURCE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/tiff"}

_FREE_LICENSE = re.compile(r"^(pd|public domain|cc0|cc-zero|cc[- ]by([- ]sa)?([- ]\d(\.\d)?)?)(\b|[-_ ])", re.IGNORECASE)
_NONFREE_HINT = re.compile(r"\b(nc|nd|non-?commercial|no-?derivs?|fair use)\b", re.IGNORECASE)
_UNSAFE_WORDS = re.compile(
    r"\b(nud(e|ity|ist)|naked|porn\w*|erotic\w*|sex(ual|y)?|genital\w*|penis|vagina|vulva|breasts?|nipples?|"
    r"buttocks|topless|corpse|cadaver|autopsy|gore|dead body|execution|lynching)\b",
    re.IGNORECASE,
)


@dataclass
class Candidate:
    title: str
    thumb_url: str
    source_mime: str
    description_url: str
    author: str
    license: str
    license_url: str
    is_drawing: bool


def clean_text(value: str | None, limit: int = 200) -> str:
    """Commons metama'lumoti HTML bo'ladi (havolalar, span'lar) — oddiy matnga."""
    text = html.unescape(re.sub(r"<[^>]+>", " ", value or ""))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def _meta(info: dict[str, Any], key: str) -> str:
    return str((info.get("extmetadata", {}).get(key) or {}).get("value") or "")


def is_free_license(license_code: str, short_name: str) -> bool:
    for value in (license_code, short_name):
        value = value.strip()
        if value and _FREE_LICENSE.match(value) and not _NONFREE_HINT.search(value):
            return True
    return False


def candidate_from_page(page: dict[str, Any]) -> Candidate | None:
    """API natijasidagi bitta fayl sahifasi — mos kelsa Candidate, aks holda None."""
    infos = page.get("imageinfo") or []
    if not infos:
        return None
    info = infos[0]
    title = str(page.get("title", ""))
    mime = str(info.get("mime", ""))
    thumb_url = str(info.get("thumburl") or "")
    if mime not in SOURCE_TYPES or not thumb_url.startswith("https://upload.wikimedia.org/"):
        return None
    if int(info.get("width") or 0) < MIN_WIDTH:
        return None
    if _meta(info, "Restrictions").strip():  # savdo belgisi, shaxs huquqi va h.k.
        return None
    license_code, short_name = _meta(info, "License"), _meta(info, "LicenseShortName")
    if not is_free_license(license_code, short_name):
        return None
    text = " ".join([title, clean_text(_meta(info, "ImageDescription"), 1000), clean_text(_meta(info, "ObjectName"), 300)])
    if _UNSAFE_WORDS.search(text.replace("_", " ")):
        return None
    author = clean_text(_meta(info, "Artist")) or clean_text(_meta(info, "Credit")) or "Wikimedia Commons"
    return Candidate(
        title=re.sub(r"^File:", "", title).rsplit(".", 1)[0].replace("_", " ")[:200],
        thumb_url=thumb_url,
        source_mime=mime,
        description_url=str(info.get("descriptionurl") or ""),
        author=author,
        license=clean_text(short_name, 60) or license_code.upper()[:60],
        license_url=str(_meta(info, "LicenseUrl"))[:500],
        is_drawing=mime == "image/svg+xml",
    )


def rank_candidates(api_json: dict[str, Any]) -> list[Candidate]:
    """Qidiruv tartibini saqlab, mos fayllar: avval chizmalar (SVG), keyin suratlar."""
    pages = sorted((api_json.get("query") or {}).get("pages", {}).values(), key=lambda page: page.get("index", 0))
    candidates = [c for c in (candidate_from_page(page) for page in pages) if c is not None]
    return [c for c in candidates if c.is_drawing] + [c for c in candidates if not c.is_drawing]


def _headers() -> dict[str, str]:
    # Wikimedia qoidasi: so'rovda ilova nomi va aloqa ma'lumoti bo'lgan User-Agent bo'lishi shart.
    return {"User-Agent": settings.commons_user_agent}


async def search(query: str, limit: int = 15) -> list[Candidate]:
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": "6",
        "gsrlimit": str(limit),
        "prop": "imageinfo",
        "iiprop": "url|mime|size|extmetadata",
        "iiurlwidth": str(THUMB_WIDTH),
        "iiextmetadatafilter": "License|LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription|ObjectName|Restrictions",
        "iiextmetadatalanguage": "en",
    }
    async with httpx.AsyncClient(timeout=20.0, headers=_headers()) as http_client:
        response = await http_client.get(API_URL, params=params)
        response.raise_for_status()
        return rank_candidates(response.json())


async def download(candidate: Candidate) -> tuple[bytes, str]:
    """Thumbnail'ni yuklaydi: (baytlar, mime). Faqat jpeg/png/webp va hajm chegarasi bilan."""
    async with httpx.AsyncClient(timeout=30.0, headers=_headers(), follow_redirects=True) as http_client:
        async with http_client.stream("GET", candidate.thumb_url) as response:
            response.raise_for_status()
            mime = response.headers.get("content-type", "").split(";")[0].strip().lower()
            if mime not in STORED_TYPES:
                raise ValueError(f"Kutilmagan rasm turi: {mime}")
            chunks: list[bytes] = []
            size = 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Rasm juda katta")
                chunks.append(chunk)
    return b"".join(chunks), mime
