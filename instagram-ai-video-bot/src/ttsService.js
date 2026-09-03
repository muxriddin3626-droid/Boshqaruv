// Matnni ovozga aylantirish - Microsoft Edge'ning bepul "Read Aloud"
// xizmatidan foydalanadi (API kalit talab qilinmaydi).
const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// uz-UZ-MadinaNeural - o'zbek tilidagi ayol ovozi. Muammo bo'lsa
// TTS_VOICE muhit o'zgaruvchisi orqali boshqasiga almashtiring
// (masalan ru-RU-SvetlanaNeural yoki en-US-AriaNeural).
const VOICE = process.env.TTS_VOICE || 'uz-UZ-MadinaNeural';

async function synthesize(text, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(outDir, text);
  return audioFilePath;
}

module.exports = { synthesize, VOICE };
