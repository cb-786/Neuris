# Stage 1: Build the React app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx config is mounted via docker-compose volume
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
