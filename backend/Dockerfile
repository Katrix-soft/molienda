# Stage 1: Build Angular Frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Setup Node Backend
FROM node:20-alpine
WORKDIR /app

# Instalar dependencias para compilación de sqlite3 (si es necesario)
RUN apk add --no-cache python3 make g++

# Configurar carpeta backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

# Copiar el resto del backend
COPY backend/ .

# Copiar el build del frontend desde la etapa anterior
# Mantenemos la estructura que espera server.js (../dist/molienda/browser)
WORKDIR /app
COPY --from=build /app/dist/molienda /app/dist/molienda

# Crear carpeta para assets si no existe
RUN mkdir -p /app/backend/public

EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
