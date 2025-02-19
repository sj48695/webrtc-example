# Server 빌드 단계
FROM mediasoup-base:node-20-ubuntu-22 AS server
WORKDIR /app/server
COPY . .
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  build-essential \
  make \
  cmake \
  g++ \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
RUN npm install

EXPOSE 5001
EXPOSE 2000-2020
EXPOSE 2000-2020/udp

CMD [ "npm", "run", "start:dev" ]