# Image pour tout hébergeur qui accepte Docker (Fly.io, Railway, un VPS…)
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN node build.mjs
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/server.mjs"]
