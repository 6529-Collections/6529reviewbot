# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
  PORT=8080 \
  REVIEWBOT_WORKER_GH_BIN=gh
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git gh \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node bin ./bin
COPY --chown=node:node config ./config
COPY --chown=node:node src ./src
COPY --chown=node:node templates ./templates

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const http=require('http');const port=process.env.PORT||process.env.REVIEWBOT_PORT||8080;const req=http.get({host:'127.0.0.1',port,path:'/healthz',timeout:2000},res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"

CMD ["node", "bin/server.cjs"]
