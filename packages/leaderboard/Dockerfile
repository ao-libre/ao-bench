FROM node:24-slim

WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies (including better-sqlite3 which needs build tools)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npx tsc

# Data directory for SQLite
RUN mkdir -p /data

EXPOSE 3000

ENV DB_PATH=/data/leaderboard.db

CMD ["node", "dist/server.js"]
