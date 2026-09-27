# Stage 1: Build Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Run Production Server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY server.js ./
COPY --from=builder /app/dist ./dist

EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
