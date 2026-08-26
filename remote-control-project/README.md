# Remote Phone Control — loyiha tuzilishi

Ikkita Android qurilma orasida masofaviy ekranni ko'rish va boshqarish tizimi (TeamViewer/AnyDesk uslubida), consent-first (avval ruxsat, keyin ulanish) yondashuvi bilan.

## Papkalar

```
backend/              -> Node.js signaling server (WebSocket + REST API)
android-agent/        -> Kuzatiluvchi telefonga o'rnatiladigan ilova
android-controller/   -> Kuzatuvchi telefonga o'rnatiladigan ilova
```

## Ishga tushirish tartibi

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env   # JWT_SECRET va TURN server ma'lumotlarini to'ldiring
npm start               # http://localhost:8080 da ishga tushadi
```
STUN/TURN server shart — mobil tarmoqlarda (4G/5G, NAT orqasida) WebRTC ko'pincha
TURN serversiz ulanmaydi. O'zingiz `coturn` o'rnatishingiz yoki tayyor TURN
xizmatidan (masalan Twilio, Xirsys) foydalanishingiz mumkin.

### 2) Android loyihalarini ochish
- Android Studio'da `android-agent/` va `android-controller/` papkalarini
  ikkita alohida loyiha sifatida oching.
- Har ikkalasida `SignalingClient.kt` ichidagi `Config.API_BASE_URL` va
  `Config.WS_BASE_URL` manzillarini o'zingizning backend manzilingizga
  o'zgartiring (masalan `https://your-domain.com`).
- `AuthStore.token` va `AuthStore.deviceId`ni to'ldirish uchun avval
  `/auth/register` va `/devices/register` endpoint'larini chaqiradigan
  login ekranini qo'shishingiz kerak (hozircha soddalashtirish uchun
  qoldirilgan — keyingi qadam sifatida qo'shib beraman desangiz aytib qo'ying).

### 3) Foydalanish oqimi
1. Agent telefonda: Erishimlilik xizmatini yoqing → "Pairing kod yaratish"ni bosing
2. Controller telefonda: kodni kiriting → "Ulanish"
3. Agent telefonda tasdiqlash oynasi chiqadi → "Ruxsat berish"
4. Tizim MediaProjection ruxsatini so'raydi → tasdiqlang
5. Controller ekranida Agent'ning ekrani ko'rinadi, teginishlar uzatiladi

## Qolgan ishlar (production darajasiga yetkazish uchun)

- **Login/registratsiya UI** — ✅ qo'shildi (`LoginActivity.kt`, ikkala ilovada ham)
- Deploy qo'llanmasi uchun `DEPLOYMENT.md`ga qarang
- **TURN server** — production'da albatta kerak (DEPLOYMENT.md'da yo'riqnoma bor)
- **Ma'lumotlar bazasi** — hozir backend xotirada (server qayta ishga tushsa hammasi o'chadi); Postgres/Redis kerak
- **HTTPS/WSS** — hozirgi kod oddiy http; deploy qilishda TLS sertifikat (masalan Let's Encrypt) shart
- **Video sifat/bitrate boshqaruvi**, ekran aylanishi (orientation) hisobga olish
- **Matn kiritish** (klaviatura) — AccessibilityNodeInfo orqali qo'shish kerak
- **Session tarixi/audit log** — kim qachon kimga ulanganini yozib borish

## Muhim eslatma

Ushbu tizim boshqa odamning qurilmasini kuzatish uchun ishlatilsa, qurilma
egasining bilishi va roziligi bo'lishi zarur — aks holda ko'plab davlatlarda
bu noqonuniy ("stalkerware") hisoblanadi. Kodda maxsus consent-oqim
(pairing so'rovi + tasdiqlash dialogi + doimiy bildirishnoma + istalgan
vaqtda to'xtatish tugmasi) shu sababli qo'yilgan — bularni olib tashlash
tavsiya etilmaydi.

## Web ilova (`web/`)

Brauzerda ishlaydigan boshqaruv paneli — ikki vazifani bajaradi:
- **Ulanish** — pairing kodni kiritib, kuzatiluvchi qurilma ekranini ko'rish (video oqim, WebRTC recvonly) va bosishlarni yuborish
- **Qurilmalar** va **Sessiyalar tarixi** — hisobga bog'langan qurilmalar va o'tgan ulanishlar ro'yxati

Ishga tushirish: `web/js/config.js` faylida `API_BASE_URL`/`WS_BASE_URL`ni backend manzilingizga o'zgartiring, so'ng `web/index.html`ni istalgan statik server orqali oching (masalan `npx serve web`).

Bu **faqat Controller (kuzatuvchi)** tomonini almashtiradi — Agent (kuzatiluvchi qurilma) baribir native Android ilova bo'lishi shart, chunki brauzer ekranni tizim darajasida olib, tegishlarni in'ektsiya qila olmaydi.
