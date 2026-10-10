# Utilise le dist pré-compilé localement (npm run build exécuté sur l'hôte).
# Pour rebuilder depuis les sources : npm run build dans frontend/web/ puis docker compose build.
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
