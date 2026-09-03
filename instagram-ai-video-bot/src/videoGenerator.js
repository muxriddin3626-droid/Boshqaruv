// Fon video + TTS ovoz + matn subtitr (ASS orqali "yondirilgan" matn) dan
// 1080x1920 (Instagram Reels formatidagi) tayyor mp4 video yig'adi.
//
// Eslatma: bu loyihada ffmpeg-static orqali o'rnatiladigan statik ffmpeg
// build'ida "drawtext" filtri yo'q, shu sabab matn libass ("ass" filtri)
// orqali subtitr fayl sifatida chizib qo'yiladi - bu usul ko'p qatorli
// matnni avtomatik markazlashtirish va chiroyli hoshiya/soya berish uchun
// ham qulayroq.
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const FONT_DIR = path.dirname(require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'));
const WIDTH = 1080;
const HEIGHT = 1920;
const LEAD_IN_SEC = 0.8; // ovoz boshlanishidan oldingi jimlik
const TAIL_SEC = 1.8; // ovoz tugagach matn ekranda qancha turadi

function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration);
    });
  });
}

// Matnni taxminan har qatorda `maxChars` belgidan oshmasligi uchun
// so'zlar bo'yicha qatorlarga bo'ladi (libass WrapStyle=0 bilan birga
// ishlatilganda oldindan bo'lingan qatorlar aniqroq chiqadi).
function wrapText(text, maxChars = 22) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeAss(text) {
  return text.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
}

function secondsToAssTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function buildAssFile(text, totalDuration, outPath) {
  const lines = wrapText(text).map(escapeAss).join('\\N');
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Quote,DejaVu Sans,68,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${secondsToAssTime(totalDuration)},Quote,,0,0,0,,${lines}
`;
  fs.writeFileSync(outPath, ass, 'utf8');
}

// Matn joylashadigan hudud ostiga qorong'i, yarim shaffof "panel" chizadi -
// fon video qanday rangda bo'lishidan qat'i nazar matn o'qilishi uchun.
const DARK_BAND = `drawbox=x=0:y=${Math.round(HEIGHT * 0.36)}:w=${WIDTH}:h=${Math.round(HEIGHT * 0.28)}:color=black@0.42:t=fill`;

async function generateVideo({ quoteText, backgroundPath, audioPath, outPath }) {
  const audioDuration = await getAudioDuration(audioPath);
  const totalDuration = LEAD_IN_SEC + audioDuration + TAIL_SEC;

  const assPath = outPath.replace(/\.mp4$/, '.ass');
  buildAssFile(quoteText, totalDuration, assPath);

  const leadMs = Math.round(LEAD_IN_SEC * 1000);
  const videoFilter =
    `[0:v]trim=duration=${totalDuration},setpts=PTS-STARTPTS,` +
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},` +
    `${DARK_BAND},ass=${assPath}:fontsdir=${FONT_DIR}[vout]`;
  const audioFilter = `[1:a]adelay=${leadMs}|${leadMs},apad=whole_dur=${totalDuration}[aout]`;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(backgroundPath)
      .inputOptions(['-stream_loop', '-1'])
      .input(audioPath)
      .complexFilter([videoFilter, audioFilter])
      .outputOptions([
        '-map', '[vout]',
        '-map', '[aout]',
        '-t', String(totalDuration),
        '-r', '30',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
      ])
      .on('error', (err) => reject(err))
      .on('end', () => {
        fs.unlink(assPath, () => {});
        resolve(outPath);
      })
      .save(outPath);
  });
}

module.exports = { generateVideo, wrapText, getAudioDuration };
