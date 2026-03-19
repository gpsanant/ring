FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ server/
COPY client/ client/

EXPOSE 8080

CMD ["node", "server/index.js"]
