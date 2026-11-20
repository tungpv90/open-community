FROM node:20-alpine AS verify
WORKDIR /app
COPY package.json server.mjs ./
COPY .openai ./.openai
COPY src ./src
COPY worker ./worker
COPY scripts ./scripts
RUN npm run check && npm run build && npm run validate

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=verify --chown=node:node /app/package.json /app/server.mjs ./
COPY --from=verify --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
