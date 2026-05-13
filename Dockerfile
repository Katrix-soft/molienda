# Stage 1: Build the Angular app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve Backend & Frontend together
FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --legacy-peer-deps \
    express@4.18.2 \
    path-to-regexp@6.3.0

COPY backend/ ./backend/

COPY --from=builder /app/dist/molienda/browser ./dist/molienda/browser

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
