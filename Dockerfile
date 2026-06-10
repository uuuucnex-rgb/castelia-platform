FROM node:20-alpine

WORKDIR /app

# зависимости (кэшируется отдельно от кода)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# код приложения
COPY . .

ENV PORT=3003
EXPOSE 3003

CMD ["node", "server.js"]
