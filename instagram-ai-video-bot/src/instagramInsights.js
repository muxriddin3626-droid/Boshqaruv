// Instagram Graph API orqali hisob va postlar statistikasini o'qiydi.
// instagramPublisher.js post joylash uchun, bu fayl esa natijalarni
// (like, reach, plays va h.k.) o'qish uchun.
const axios = require('axios');

const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const MEDIA_INSIGHT_METRICS = 'reach,likes,comments,shares,saved,plays';

function requireCreds() {
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !accessToken) {
    throw new Error('IG_BUSINESS_ACCOUNT_ID yoki IG_ACCESS_TOKEN .env da sozlanmagan.');
  }
  return { igUserId, accessToken };
}

async function getAccountSummary() {
  const { igUserId, accessToken } = requireCreds();
  const { data } = await axios.get(`${GRAPH_BASE}/${igUserId}`, {
    params: { fields: 'username,followers_count,media_count', access_token: accessToken },
  });
  return data;
}

async function getMediaInsights(mediaId) {
  const { accessToken } = requireCreds();
  const { data } = await axios.get(`${GRAPH_BASE}/${mediaId}/insights`, {
    params: { metric: MEDIA_INSIGHT_METRICS, access_token: accessToken },
  });
  const stats = {};
  for (const item of data.data || []) {
    const value = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
    stats[item.name] = value;
  }
  return stats;
}

module.exports = { getAccountSummary, getMediaInsights };
