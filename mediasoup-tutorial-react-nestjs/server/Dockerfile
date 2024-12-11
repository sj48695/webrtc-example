# Server 빌드 단계
FROM base AS server
WORKDIR /app/server
COPY . .
RUN npm install
CMD [ "npm", "run", "start:dev" ]