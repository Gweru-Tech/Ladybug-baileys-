# Ladybug Baileys Docker Configuration
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    curl \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ladybug -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=ladybug:nodejs /app/lib ./lib
COPY --from=builder --chown=ladybug:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=ladybug:nodejs /app/package.json ./package.json

# Create storage directory
RUN mkdir -p /app/storage && chown ladybug:nodejs /app/storage

# Switch to non-root user
USER ladybug

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "lib/index.js"]