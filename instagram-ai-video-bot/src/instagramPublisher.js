// Instagram Graph API orqali Reels joylash. Bu API'dan foydalanish uchun
// Instagram Business/Creator akkaunt, unga bog'langan Facebook Sahifa,
// Meta Developer App va uzoq muddatli access token kerak - batafsili
// README.md dagi "Instagram sozlash" bo'limida.
const axios = require('axios');

const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createContainer({ igUserId, accessToken, videoUrl, caption }) {
  const url = `${GRAPH_BASE}/${igUserId}/media`;
  const { data } = await axios.post(url, null, {
    params: {
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      access_token: accessToken,
    },
  });
  return data.id;
}

async function waitUntilReady({ creationId, accessToken }) {
  const url = `${GRAPH_BASE}/${creationId}`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { data } = await axios.get(url, {
      params: { fields: 'status_code,status', access_token: accessToken },
    });
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') {
      throw new Error(`Instagram video qayta ishlashda xato: ${data.status || 'noma\'lum sabab'}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Instagram video qayta ishlash kutilganidan uzoq davom etdi (timeout).');
}

async function publishContainer({ igUserId, accessToken, creationId }) {
  const url = `${GRAPH_BASE}/${igUserId}/media_publish`;
  const { data } = await axios.post(url, null, {
    params: { creation_id: creationId, access_token: accessToken },
  });
  return data.id;
}

async function fetchPermalink({ mediaId, accessToken }) {
  try {
    const { data } = await axios.get(`${GRAPH_BASE}/${mediaId}`, {
      params: { fields: 'permalink', access_token: accessToken },
    });
    return data.permalink;
  } catch {
    return null;
  }
}

async function publishReel({ videoUrl, caption }) {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !accessToken) {
    throw new Error('IG_BUSINESS_ACCOUNT_ID yoki IG_ACCESS_TOKEN .env da sozlanmagan.');
  }

  const creationId = await createContainer({ igUserId, accessToken, videoUrl, caption });
  await waitUntilReady({ creationId, accessToken });
  const mediaId = await publishContainer({ igUserId, accessToken, creationId });
  const permalink = await fetchPermalink({ mediaId, accessToken });
  return { mediaId, permalink };
}

module.exports = { publishReel };
