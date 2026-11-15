FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
# Holat fayli shu papkada saqlanadi (docker-compose uni volume'ga ulaydi)
ENV STATE_FILE=/app/data/state.json
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
CMD ["node", "src/bot.js"]
