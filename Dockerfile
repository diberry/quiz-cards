# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Production stage
FROM node:20-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy deps and source
COPY --from=build /app/node_modules ./node_modules
COPY server/ ./server/
COPY public/ ./public/
COPY package.json ./

# Data directory for SQLite
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
