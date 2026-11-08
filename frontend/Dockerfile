# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Test stage (used by `docker compose --profile test run --rm frontend-tests`)
FROM build AS test
WORKDIR /app
ENTRYPOINT ["npm", "test"]

# Runtime stage
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

ENV API_BASE_URL=http://localhost:8080
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]

