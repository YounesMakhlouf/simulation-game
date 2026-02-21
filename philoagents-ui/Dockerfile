FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build the production bundle
RUN npm run build

# Install a lightweight static file server
RUN npm install -g serve

# Expose port 8080
EXPOSE 8080

# Serve the built static files
CMD ["serve", "-s", "dist", "-l", "8080", "--no-clipboard"]
