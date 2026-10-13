# ==========================================
# Stage 1: Build Backend Server Bundle
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy project files
COPY . .

# Build ONLY backend server (Pure API container, zero frontend assets)
RUN npm run build:backend

# ==========================================
# Stage 2: Minimal Production Image
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Install dumb-init for proper signal forwarding and process cleanup
RUN apk add --no-cache dumb-init

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend server from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory and set permissions for non-root user
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 10000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.cjs"]
