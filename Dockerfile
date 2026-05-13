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
RUN cd backend && npm ci && npm install express@4.21.2 router@1.3.8

COPY backend/ ./backend/

COPY --from=builder /app/dist/molienda/browser ./dist/molienda/browser

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
