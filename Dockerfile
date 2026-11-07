FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy project source
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose Cloud Run default port
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
