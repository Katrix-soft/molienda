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

# Install backend dependencies con router fijado
COPY backend/package*.json ./backend/
RUN cd backend && npm ci && npm install router@1.3.8

# Copy backend source code
COPY backend/ ./backend/

# Copy the built Angular application from the builder stage
COPY --from=builder /app/dist/molienda/browser ./dist/molienda/browser

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
