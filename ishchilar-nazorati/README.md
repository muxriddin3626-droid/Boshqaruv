# Ishchilar nazorati

Ishchilarning keldi/ketdi (davomat) vaqtini va haydovchilarning joriy
joylashuvini xaritada kuzatish uchun veb-tizim.

## Papkalar

```
backend/   -> Node.js + Express API (SQLite ma'lumotlar bazasi)
web/       -> Statik veb-panel (admin, ishchi, haydovchi sahifalari)
```

## Ishga tushirish

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env   # kerak bo'lsa admin login/parolni o'zgartiring
npm start               # http://localhost:8081 da ishga tushadi
```

### 2) Veb-panel
`web/js/config.js` faylida `API_BASE_URL`ni backend manzilingizga moslang,
so'ng `web/index.html`ni istalgan statik server orqali oching:
```bash
npx serve web
```

## Foydalanish oqimi

- **Admin** (`index.html` → `admin.html`): tizimga kiradi, xodim/haydovchi
  qo'shadi (har biriga avtomatik 4 xonali PIN kod beriladi), xodimlar
  ro'yxatini, joriy holatini (ishda/ishda emas), keldi-ketdi tarixini va
  haydovchilarning joriy joylashuvini xaritada ko'radi.
- **Ishchi** (`checkin.html`): umumiy qurilmada (masalan ish joyidagi
  planshet/telefon) PIN kodini kiritadi va "Keldim" / "Ketyapman"
  tugmasini bosadi.
- **Haydovchi** (`driver.html`): o'z telefonida PIN kodini kiritib
  kuzatishni boshlaydi — brauzer geolokatsiyasi orqali joylashuvi har
  15 soniyada avtomatik yuboriladi, admin panelidagi xaritada jonli
  ko'rinadi. "To'xtatish" tugmasi bilan istalgan vaqtda kuzatishni
  yakunlaydi.

## Texnik eslatmalar

- Ma'lumotlar `backend/data.sqlite` faylida saqlanadi (server qayta
  ishga tushsa ham saqlanib qoladi).
- Admin autentifikatsiyasi JWT bilan, `.env`dagi bitta login/parol
  orqali. Ishchi/haydovchi sahifalari esa PIN kod orqali ishlaydi —
  alohida hisob yaratish shart emas.
- Xarita OpenStreetMap + Leaflet orqali chiziladi, API kaliti kerak emas.

## Qolgan ishlar (production darajasiga yetkazish uchun)

- HTTPS/WSS — deploy qilishda TLS sertifikat shart
- Ko'p adminli tizim (hozir bitta admin hisobi `.env`da)
- PIN kod xavfsizligi — hozircha 4 xonali kod istalgan qurilmadan
  kiritilishi mumkin; production'da qurilmani cheklash yoki qo'shimcha
  tasdiqlash qo'shish tavsiya etiladi
- Haydovchi joylashuv tarixi (hozir faqat oxirgi joylashuv saqlanadi,
  yo'l tarixi emas)
