# Ladybug Baileys Docker Configuration
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

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

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/lib ./lib

# Create storage and logs directories
RUN mkdir -p /app/storage /app/logs

# Copy non-node files that might be needed
COPY --from=builder /app/src/deployment ./src/deployment

# Create non-root user (optional, can be removed if causing issues)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ladybug -u 1001 && \
    chown -R ladybug:nodejs /app

# Switch to non-root user
USER ladybug

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "lib/app.js"]