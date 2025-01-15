# Server 빌드 단계
FROM mediasoup-base:node-20-ubuntu-22 AS server
WORKDIR /app/server
COPY . .
RUN npm install
CMD [ "npm", "run", "start:dev" ]