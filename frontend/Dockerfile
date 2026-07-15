FROM node:20-alpine

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4173"]
