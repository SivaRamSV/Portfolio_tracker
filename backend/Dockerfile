FROM node:16-alpine

WORKDIR /app

# Install build tools and dependencies required for sqlite3
RUN apk add --no-cache python3 make g++ sqlite

# Copy only package.json and package-lock.json first to leverage Docker caching
COPY package*.json ./

# Install dependencies, excluding sqlite3 initially
RUN npm install --omit=optional

# Rebuild sqlite3 specifically for the container's architecture
RUN npm rebuild sqlite3 --build-from-source

# Copy the rest of the application code
COPY . .

# Exclude the database file from being copied into the container
RUN rm -f portfolio.db

EXPOSE 5001

CMD ["node", "server.js"]