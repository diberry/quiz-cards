# Build stage
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY server/ ./server/
RUN npm ci
RUN npm run build

# Production stage
FROM node:24-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy compiled output and production deps
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist/
COPY public/ ./public/

# Data directory for SQLite
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
