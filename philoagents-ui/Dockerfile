FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Optional API base URL baked into the bundle at build time.
# Pass with: docker build --build-arg API_BASE_URL=https://api.example.com
ARG API_BASE_URL=""
ENV API_BASE_URL=$API_BASE_URL

# Build the application
RUN npm run build

# Expose port 8080 (matches webpack dev server port)
EXPOSE 8080

# Start the development server
CMD ["npm", "run", "dev"]