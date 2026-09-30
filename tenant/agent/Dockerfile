FROM node:20-alpine

RUN apk add --no-cache wireguard-tools iproute2 tini

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src

# Répertoire pour persister la file de messages hors-ligne
RUN mkdir -p /data
VOLUME ["/data"]

ENV AGENT_PORT=8080
EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/agent.js"]
