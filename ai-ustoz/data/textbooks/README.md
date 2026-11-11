# Darslik fayllari (RAG ingestion uchun manba)

Bu papkada `scripts/ingest_textbook.py` orqali `knowledge_chunks` jadvaliga
yuklanadigan darslik PDF fayllari saqlanadi.

## Struktura

```
data/textbooks/<fan>/<sinf>-sinf.pdf
```

## Hozircha mavjud fayllar

- `biologiya/5-sinf.pdf` — O'zbekiston Respublikasi Xalq ta'limi vazirligi
  tavsiya etgan 5-sinf Biologiya darsligi (O'. Pratov, A. To'xtayev,
  F. Azimova, Z. Tillayeva; «O'zbekiston» NMIU, 2020, 5-nashri). Hali
  bazaga yuklanmagan — quyidagi buyruqni real `OPENAI_API_KEY` bilan
  ishga tushiring:

  ```bash
  docker compose exec backend python scripts/ingest_textbook.py \
      --pdf /app/data/textbooks/biologiya/5-sinf.pdf --subject biologiya --grade 5
  ```

## Eslatma

Bu fayllar rasmiy davlat darsliklari bo'lib, umumta'lim maktablarida
bepul foydalanish uchun mo'ljallangan. Shunga qaramay, ularni faqat shu
loyihaning RAG bilim bazasini to'ldirish maqsadida ishlating.
