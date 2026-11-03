FROM mirror.gcr.io/library/node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM mirror.gcr.io/library/node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json /app/next.config.mjs /app/server.ts ./
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "server.ts"]
