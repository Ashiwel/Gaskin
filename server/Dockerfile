# Gaskin server. Build from the repository root, because the server imports
# the shared engine, privacy and data modules from ../src:
#   docker build -f server/Dockerfile -t gaskin-server .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci
COPY src src
COPY server server
RUN cd server && node scripts/build.mjs \
 && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8787 DATABASE_URL=sqlite:/data/gaskin.db
WORKDIR /app
COPY --from=build /app/server/node_modules node_modules
COPY --from=build /app/server/dist dist
COPY --from=build /app/server/package.json package.json
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.mjs"]
