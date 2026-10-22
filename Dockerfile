# Stage 1: Build frontend and backend
FROM node:22-slim AS builder

WORKDIR /app

# Copy root and workspace package manifests
COPY package.json ./
COPY backend/package.json ./backend/
COPY web/package.json ./web/

# Install dependencies for both workspaces
RUN npm install

# Copy source trees
COPY backend/ ./backend/
COPY web/ ./web/

# Build Vite frontend and backend TypeScript
RUN npm run build

# Stage 2: Minimal production runtime
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy manifests and install production-only dependencies
COPY package.json ./
COPY backend/package.json ./backend/
COPY web/package.json ./web/
RUN npm install --omit=dev

# Copy compiled backend and frontend bundles
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/src/data ./backend/dist/data
COPY --from=builder /app/web/dist ./web/dist

EXPOSE 3000

CMD ["node", "backend/dist/main.js"]
