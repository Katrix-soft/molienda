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

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy backend source code
COPY backend/ ./backend/

# Copy the built Angular application from the builder stage
COPY --from=builder /app/dist/molienda/browser ./dist/molienda/browser

# Expose port 3000 (Backend handles both API and Frontend)
EXPOSE 3000

# Start the Node.js server
WORKDIR /app/backend
CMD ["node", "server.js"]
