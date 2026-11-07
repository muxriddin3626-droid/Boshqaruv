# Backend'ni production'ga chiqarish qo'llanmasi

Bu hujjat `backend/` papkasidagi signaling serverni haqiqiy domenga,
HTTPS bilan, TURN serversiz emas balki TURN bilan ishga tushirish
bosqichlarini tushuntiradi. VPS sifatida har qanday provayder (DigitalOcean,
Hetzner, AWS Lightsail va h.k.) mos keladi — bu yerda umumiy Ubuntu 22.04
serveri asosida ko'rsatilgan.

## 1) Domenni tayyorlash

- Domen (masalan `remote-api.sizning-domeningiz.com`) DNS'da serveringiz
  IP manziliga A-record bilan yo'naltiring.

## 2) Serverni tayyorlash

```bash
ssh root@your-server-ip

apt update && apt upgrade -y
apt install -y nodejs npm nginx certbot python3-certbot-nginx git

node -v   # 18+ tavsiya etiladi; kerak bo'lsa nvm orqali yangilang
```

## 3) Backend kodini serverga joylash

```bash
git clone <sizning-repo-manzilingiz> /opt/remote-backend
cd /opt/remote-backend/backend
npm install --production
cp .env.example .env
nano .env   # JWT_SECRET'ni uzun tasodifiy qatorga almashtiring
```

`JWT_SECRET` generatsiya qilish uchun:
```bash
openssl rand -hex 32
```

## 4) Node jarayonini doimiy ishlab turishi uchun (PM2)

```bash
npm install -g pm2
pm2 start src/server.js --name remote-backend
pm2 save
pm2 startup    # server qayta yuklanganda avtomatik ishga tushishi uchun
```

## 5) Nginx - teskari proksi (reverse proxy) va HTTPS

`/etc/nginx/sites-available/remote-backend` faylini yarating:

```nginx
server {
    listen 80;
    server_name remote-api.sizning-domeningiz.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Yoqish va HTTPS sertifikat olish:

```bash
ln -s /etc/nginx/sites-available/remote-backend /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d remote-api.sizning-domeningiz.com
# Certbot avtomatik ravishda HTTPS'ga yo'naltiradi va sertifikatni yangilab turadi
```

Shundan so'ng backend manzilingiz:
- REST API: `https://remote-api.sizning-domeningiz.com`
- WebSocket: `wss://remote-api.sizning-domeningiz.com/ws`

Bu ikkala manzilni Android loyihalaridagi `Config.API_BASE_URL` va
`Config.WS_BASE_URL`'ga qo'ying (`android-agent` va `android-controller`
ikkalasida ham, `SignalingClient.kt` fayllarida).

## 6) TURN server (WebRTC uchun MAJBURIY)

Mobil tarmoqlarda (4G/5G) ikkala qurilma ham NAT orqasida bo'ladi va
faqat STUN yetarli bo'lmaydi — TURN server kerak. `coturn`ni o'sha
serverga o'rnatish mumkin:

```bash
apt install -y coturn
nano /etc/turnserver.conf
```

Minimal sozlama:
```
listening-port=3478
fingerprint
lt-cred-mech
user=turnuser:kuchli-parol
realm=remote-api.sizning-domeningiz.com
```

```bash
systemctl enable coturn
systemctl start coturn
```

Keyin `.env` faylidagi `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`ni
to'ldiring. Bular avtomatik ishlatiladi: server `GET /ice-servers`
endpointi orqali mijozlarga (Android/web) STUN va TURN ro'yxatini beradi,
shuning uchun TURN maxfiy ma'lumotlari ilovaning kodiga yozilmaydi — faqat
serverdagi `.env`da turadi. Mijozlar WebRTC'ni shu ro'yxat bilan sozlaydi.

Tekshirish:
```bash
curl -s https://remote-api.sizning-domeningiz.com/ice-servers \
  -H "Authorization: Bearer <token>"
# -> {"iceServers":[{"urls":"stun:..."},{"urls":"turn:...","username":"...","credential":"..."}]}
```

Muqobil variant: o'z TURN server o'rnatish o'rniga tayyor xizmatdan
foydalanish (masalan Twilio Network Traversal Service yoki Xirsys) -
bu sozlash vaqtini qisqartiradi, lekin oylik to'lov talab qiladi.

## 7) Ma'lumotlar bazasi (Postgres)

Backend endi saqlash qatlami (`src/store.js`) orqali ishlaydi:
- **`DATABASE_URL` o'rnatilgan bo'lsa** → Postgres (doimiy saqlash).
  Jadvallar (`users`, `devices`, `sessions`) server ishga tushganda
  `schema.sql`dan avtomatik yaratiladi.
- **Bo'sh bo'lsa** → xotira (in-memory), faqat dev uchun; server qayta
  ishga tushsa ma'lumot o'chadi.

Doimiy ma'lumot: foydalanuvchilar, qurilmalar va sessiyalar tarixi
(audit-log). Qisqa muddatli runtime holati — faol WebSocket ulanishlari,
pairing kodlar va faol sessiya marshruti — ataylab xotirada qoladi (ularni
saqlash shart emas va ws obyektini serializatsiya qilib bo'lmaydi).

Lokalda sinash:
```bash
export DATABASE_URL="postgres://user:parol@localhost:5432/rc"
npm start   # jadvallar avtomatik yaratiladi
```

Render'da (`render.yaml`da sozlangan): `remote-control-db` bazasi
yaratiladi va uning `connectionString`i `DATABASE_URL`ga avtomatik
bog'lanadi — qo'shimcha sozlash shart emas.

> **Redis** (ixtiyoriy, keyinroq): bir nechta server nusxasi (horizontal
> scaling) kerak bo'lganda pairing kodlar va faol sessiyalarni nusxalar
> o'rtasida bo'lishish uchun qo'shish mumkin. Bitta nusxa uchun hozirgi
> xotira yetarli.

## 8) Xavfsizlik nazorat ro'yxati (production'ga chiqarishdan oldin)

- [ ] `.env` faylini hech qachon git'ga qo'shmang (`.gitignore`ga qo'shing)
- [ ] `JWT_SECRET` uzun va tasodifiy bo'lsin
- [ ] Nginx orqali rate-limiting qo'shing (`limit_req_zone`)
- [ ] CORS sozlamalarini faqat kerakli originlar bilan cheklang
- [ ] Pairing kodlarini urinishlar sonini cheklang (brute-force himoyasi)
- [ ] Har bir seans uchun audit-log yozib boring (kim, qachon, qaysi qurilmani kuzatgani)
