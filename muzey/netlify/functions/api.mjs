// Rasmlarni Netlify Blobs'da saqlaydi, shunda havolani olgan har kim ularni ko'radi.
//   POST /api/photo          (tana: rasm fayli)      -> { key }
//   GET  /api/photo/:key                             -> rasm
//   POST /api/gallery        { photos: [key, ...] }  -> { id }
//   GET  /api/gallery/:id                            -> { photos: [key, ...] }
import { getStore } from "@netlify/blobs";

const MAX_PHOTO = 5 * 1024 * 1024;
const MAX_PHOTOS = 40;
const ID = /^[a-f0-9]{16}$/;
const TYPES = /^image\/(jpeg|png|webp)$/;

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export default async (req) => {
  const parts = new URL(req.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const store = getStore("muzey");
  const [kind, id] = parts;

  if (kind === "photo") {
    if (req.method === "POST" && !id) {
      const type = (req.headers.get("content-type") || "").split(";")[0].trim();
      if (!TYPES.test(type)) return json({ error: "Faqat rasm (jpeg/png/webp)" }, 415);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > MAX_PHOTO) return json({ error: "Rasm hajmi juda katta" }, 413);
      const key = newId();
      await store.set(`p/${key}`, buf, { metadata: { type } });
      return json({ key });
    }
    if (req.method === "GET" && id && ID.test(id)) {
      const r = await store.getWithMetadata(`p/${id}`, { type: "arrayBuffer" });
      if (!r) return new Response("Topilmadi", { status: 404 });
      return new Response(r.data, {
        headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
      });
    }
  }

  if (kind === "gallery") {
    if (req.method === "POST" && !id) {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
      const photos = Array.isArray(body?.photos) ? body.photos : null;
      if (!photos || !photos.length || photos.length > MAX_PHOTOS || !photos.every((k) => typeof k === "string" && ID.test(k)))
        return json({ error: "Rasmlar ro'yxati noto'g'ri" }, 400);
      const gid = newId();
      await store.setJSON(`g/${gid}`, { photos, created: Date.now() });
      return json({ id: gid });
    }
    if (req.method === "GET" && id && ID.test(id)) {
      const g = await store.get(`g/${id}`, { type: "json" });
      if (!g) return json({ error: "Topilmadi" }, 404);
      return new Response(JSON.stringify({ photos: g.photos }), {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=31536000, immutable" },
      });
    }
  }

  return json({ error: "Topilmadi" }, 404);
};

export const config = { path: "/api/*" };
