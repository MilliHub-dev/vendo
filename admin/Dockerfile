FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL=https://api.vendoltd.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM caddy:2-alpine
ENV PORT=8080
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/out /srv
EXPOSE 8080
