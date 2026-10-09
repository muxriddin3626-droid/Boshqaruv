"""
DATABASE_URL ni asyncpg (SQLAlchemy) tushunadigan ko'rinishga keltirish.

Neon/Supabase kabi xizmatlar ulanish satrini libpq uslubida beradi:
`postgresql://user:pass@host/db?sslmode=require&channel_binding=require`.
asyncpg esa `sslmode`/`channel_binding` parametrlarini bilmaydi — ular olib tashlanib,
SSL `connect_args` orqali yoqiladi. PgBouncer (pooler) orqali ulanishda asyncpg ning
tayyorlangan so'rovlar keshi o'chiriladi, aks holda "prepared statement does not exist" xatosi chiqadi.
"""
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_SSL_MODES = {"require", "verify-ca", "verify-full", "prefer", "allow"}
_LIBPQ_ONLY = {"sslmode", "channel_binding", "options", "target_session_attrs", "gssencmode"}


def normalize_database_url(raw: str) -> tuple[str, dict]:
    """(SQLAlchemy URL `postgresql+asyncpg://...`, create_async_engine uchun connect_args)."""
    parts = urlsplit(raw.strip())
    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    connect_args: dict = {}
    sslmode = query.get("sslmode", "").lower()
    if sslmode in _SSL_MODES and sslmode not in ("prefer", "allow"):
        connect_args["ssl"] = "require"
    if "-pooler" in (parts.hostname or "") or query.get("pgbouncer") == "true":
        connect_args["statement_cache_size"] = 0
        query["prepared_statement_cache_size"] = "0"
    for key in _LIBPQ_ONLY | {"pgbouncer"}:
        query.pop(key, None)
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)), connect_args


def asyncpg_dsn(raw: str) -> tuple[str, dict]:
    """To'g'ridan-to'g'ri asyncpg.connect() uchun: (`postgresql://...` DSN, kwargs)."""
    url, connect_args = normalize_database_url(raw)
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.pop("prepared_statement_cache_size", None)
    return urlunsplit(("postgresql", parts.netloc, parts.path, urlencode(query), "")), connect_args
