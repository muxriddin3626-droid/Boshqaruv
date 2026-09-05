import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type AnsweredQuestion = {
  text: string;
  chosenText: string | null;
  correctText: string;
  isCorrect: boolean;
  explanation: string;
};

function fallbackFeedback(topicTitle: string, items: AnsweredQuestion[]): string {
  const wrong = items.filter((i) => !i.isCorrect);
  if (wrong.length === 0) {
    return `"${topicTitle}" mavzusi bo'yicha barcha savollarga to'g'ri javob berdingiz. Ajoyib natija!`;
  }
  const lines = wrong.map(
    (w, i) =>
      `${i + 1}. "${w.text}" — siz "${w.chosenText ?? "javobsiz"}" deb belgiladingiz, to'g'ri javob: "${w.correctText}".` +
      (w.explanation ? ` Izoh: ${w.explanation}` : '')
  );
  return [
    `"${topicTitle}" mavzusi bo'yicha ${wrong.length} ta savolda xato qildingiz:`,
    ...lines,
    '',
    "Tavsiya: yuqoridagi savollarga oid mavzu qismini qayta o'qib chiqib, testni yana takrorlang.",
  ].join('\n');
}

export async function generateFeedback(
  topicTitle: string,
  items: AnsweredQuestion[]
): Promise<string> {
  const anthropic = getClient();
  if (!anthropic) {
    return fallbackFeedback(topicTitle, items);
  }

  const wrong = items.filter((i) => !i.isCorrect);
  if (wrong.length === 0) {
    return `"${topicTitle}" mavzusi bo'yicha barcha savollarga to'g'ri javob berdingiz. Ajoyib natija, davom eting!`;
  }

  const prompt = [
    `Talaba "${topicTitle}" mavzusidan (universitetga kirish uchun kimyo/biologiya kursi) test topshirdi.`,
    `Quyida u xato qilgan savollar, uning javobi, to'g'ri javob va izoh keltirilgan:`,
    '',
    ...wrong.map(
      (w, i) =>
        `${i + 1}) Savol: ${w.text}\nTalaba javobi: ${w.chosenText ?? 'javob bermagan'}\nTo'g'ri javob: ${w.correctText}\nIzoh: ${w.explanation || 'yo\'q'}`
    ),
    '',
    "O'zbek tilida, talabaga qarata, har bir xato uchun nima uchun xato ekanini qisqa va tushunarli tushuntir, so'ngra qaysi mavzu qismlarini takrorlashni tavsiya qil. Do'stona, motivatsion ohangda yoz. Javobni 250 so'zdan oshirma.",
  ].join('\n');

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    if (block && block.type === 'text') {
      return block.text;
    }
    return fallbackFeedback(topicTitle, items);
  } catch (err) {
    console.error('AI tahlil xatoligi:', err);
    return fallbackFeedback(topicTitle, items);
  }
}
