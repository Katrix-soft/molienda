# Backend para Petit Patisserie
FROM node:20-alpine

WORKDIR /app

# Dependencias para sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

# Copiar código del backend
COPY backend/ .

# Carpeta para archivos subidos
RUN mkdir -p /app/backend/public

EXPOSE 3000

CMD ["node", "server.js"]
