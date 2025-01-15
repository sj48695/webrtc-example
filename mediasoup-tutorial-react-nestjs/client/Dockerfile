# Client 빌드 단계
FROM mediasoup-base:node-20-ubuntu-22 AS client
WORKDIR /app/client
COPY . .
RUN npm install
CMD [ "npm", "run", "start" ]