// Sun'iy intellekt (Claude) tahlili: yangiliklar, bozor holati va
// manipulyatsiya belgilarini birga ko'rib, har bir tanga uchun qaror beradi.
//
// MUHIM xavfsizlik qoidasi: AI faqat XAVFNI KAMAYTIRA oladi — xaridni
// bloklash, summani kamaytirish yoki pozitsiyadan chiqish. U hech qachon
// o'zi yangi xarid ochmaydi va summani oshirmaydi. Savdo qarorlari
// tarixda sinalgan strategiyadan keladi.
const Anthropic = require('@anthropic-ai/sdk');

const REPORT_TOOL = {
  name: 'report_market_view',
  description: "Yakuniy tahlilni shu vosita orqali bering. Har bir so'ralgan juftlik uchun bitta yozuv.",
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      market_risk: { type: 'string', enum: ['low', 'medium', 'high', 'extreme'] },
      summary_uz: { type: 'string', description: "Umumiy bozor holati, o'zbek tilida, 2-4 gap" },
      symbols: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            sentiment: { type: 'number', description: '-1 (juda salbiy) dan 1 (juda ijobiy) gacha' },
            action: { type: 'string', enum: ['allow', 'reduce', 'block', 'exit'] },
            reason_uz: { type: 'string', description: "Qisqa sabab, o'zbek tilida" },
          },
          required: ['symbol', 'sentiment', 'action', 'reason_uz'],
          additionalProperties: false,
        },
      },
    },
    required: ['market_risk', 'summary_uz', 'symbols'],
    additionalProperties: false,
  },
};

const SYSTEM = `Siz kripto bozor xavf tahlilchisisiz. Avtomatik savdo boti uchun yangiliklar va bozor ma'lumotlarini baholaysiz.
Bot savdo signallarini tarixda sinalgan strategiyalardan oladi; sizning vazifangiz — signalni xavfli yangilik yoki manipulyatsiya sababli to'xtatish kerakmi, shuni aytish.

Harakatlar:
- allow: odatdagidek savdo qilish mumkin.
- reduce: savdo mumkin, lekin summa yarmiga kamaytiriladi (noaniqlik, aralash yangiliklar, yuqori volatillik).
- block: yangi xarid ochilmaydi (aniq salbiy yangilik: buzib kirish, sud, delisting, yirik regulyator qarori, kuchli pamp/damp belgisi).
- exit: ochiq pozitsiyani darhol yopish — faqat jiddiy, tasdiqlangan xavfda (birja/loyiha buzilgani, depeg, bankrotlik).

Qoidalar: faqat ishonchli manbalarga tayaning; mish-mish va bitta noma'lum manba "block" uchun yetarli emas. Narxni bashorat qilmang — xavfni baholang.
Agar yangi ma'lumot kerak bo'lsa web_search bilan oxirgi 24 soat yangiliklarini qidiring. Yakunda albatta report_market_view vositasini chaqiring.`;

class AiAnalyst {
  constructor(cfg) {
    this.cfg = cfg;
    this.enabled = Boolean(cfg.aiEnabled);
    this.client = this.enabled ? new Anthropic() : null;
  }

  async analyze({ symbols, headlines, fearGreed, market }) {
    if (!this.enabled) return null;
    const payload = {
      vaqt: new Date().toISOString(),
      juftliklar: symbols,
      qorquv_ochkozlik_indeksi: fearGreed,
      bozor: market, // narx, 24s o'zgarish, tanlangan strategiya, manipulyatsiya belgilari
      sarlavhalar: headlines.slice(0, 30).map((h) => `[${new Date(h.date).toISOString().slice(0, 16)} ${h.source}] ${h.title}`),
    };
    const tools = [REPORT_TOOL];
    if (this.cfg.aiWebSearch) tools.unshift({ type: 'web_search_20260209', name: 'web_search', max_uses: 4 });

    const messages = [{ role: 'user', content: `Quyidagi ma'lumotni tahlil qiling va har bir juftlik uchun qaror bering:\n${JSON.stringify(payload, null, 1)}` }];
    for (let turn = 0; turn < 4; turn++) {
      let res;
      try {
        res = await this.client.beta.messages.create({
          model: this.cfg.aiModel,
          max_tokens: 16000,
          system: SYSTEM,
          output_config: { effort: this.cfg.aiEffort },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          tools,
          messages,
        });
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) console.error('AI: ANTHROPIC_API_KEY noto\'g\'ri');
        else if (e instanceof Anthropic.RateLimitError) console.error('AI: so\'rovlar limiti, keyinroq urinadi');
        else if (e instanceof Anthropic.APIError) console.error(`AI xatosi ${e.status}:`, e.message);
        else console.error('AI ulanish xatosi:', e.message);
        return null;
      }
      if (res.stop_reason === 'refusal') return null;

      const call = res.content.find((b) => b.type === 'tool_use' && b.name === REPORT_TOOL.name);
      if (call) return normalize(call.input, symbols);

      messages.push({ role: 'assistant', content: res.content });
      if (res.stop_reason === 'pause_turn') continue; // server qidiruvni davom ettiradi
      messages.push({ role: 'user', content: 'Endi report_market_view vositasi orqali yakuniy tahlilni bering.' });
    }
    return null;
  }
}

function normalize(input, symbols) {
  const views = {};
  for (const s of input.symbols || []) {
    if (!symbols.includes(s.symbol)) continue;
    views[s.symbol] = {
      sentiment: Math.max(-1, Math.min(1, Number(s.sentiment) || 0)),
      action: ['allow', 'reduce', 'block', 'exit'].includes(s.action) ? s.action : 'allow',
      reason: s.reason_uz,
    };
  }
  return { marketRisk: input.market_risk, summary: input.summary_uz, views };
}

module.exports = { AiAnalyst, REPORT_TOOL, normalize };
