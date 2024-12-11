# Client 빌드 단계
FROM base AS client
WORKDIR /app/client
COPY . .
RUN npm install
CMD [ "npm", "run", "start" ]