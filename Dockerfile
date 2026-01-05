# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# We accept the build arguments for API keys
ARG VITE_API_BASE_URL
ARG GEMINI_API_KEY
ARG OPENAI_API_KEY
# Pass them to the build process
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV OPENAI_API_KEY=$OPENAI_API_KEY
RUN npm run build

# Production Stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
