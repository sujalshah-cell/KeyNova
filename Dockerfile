# Stage 1: Build the React + Vite frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app/Frontend

COPY Frontend/package*.json ./
RUN npm ci

COPY Frontend/ ./

# Vite outputs the built frontend to /app/Backend/public
RUN mkdir -p /app/Backend && npm run build


# Stage 2: Run the production Express backend
FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app/Backend

# Install production backend dependencies
COPY Backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source code
COPY Backend/ ./

# Copy the production frontend build
COPY --from=frontend-build /app/Backend/public ./public

EXPOSE 5000

CMD ["npm", "start"]