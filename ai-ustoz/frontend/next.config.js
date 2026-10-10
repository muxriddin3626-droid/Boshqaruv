/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Render (va boshqa) bepul "static site" hostingi uchun: NEXT_OUTPUT=export bilan
  // `next build` tayyor HTML/JS fayllarni `out/` papkasiga chiqaradi — Node server kerak emas.
  ...(process.env.NEXT_OUTPUT === "export" ? { output: "export", images: { unoptimized: true } } : {}),
};

module.exports = nextConfig;
