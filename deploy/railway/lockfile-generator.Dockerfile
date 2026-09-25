FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY . .
RUN cp pnpm-lock.yaml /tmp/pnpm-lock.before \
 && pnpm install --no-frozen-lockfile --lockfile-only \
 && (diff -u /tmp/pnpm-lock.before pnpm-lock.yaml || true)
CMD ["node","-e","console.log('lockfile-generator')"]
