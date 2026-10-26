FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY assets ./assets
COPY index.html app.js styles.css ./
ENV NODE_ENV=production PORT=3000 DATA_DIR=/var/data
EXPOSE 3000
CMD ["node", "server/server.mjs"]
