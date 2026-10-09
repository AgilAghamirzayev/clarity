FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
COPY server/src/main/resources/agent ./server/src/main/resources/agent
RUN npm run build && npm run build:api -- --base=/admin/

FROM caddy:2.10.2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
COPY --from=build /app/dist-api /srv/admin
