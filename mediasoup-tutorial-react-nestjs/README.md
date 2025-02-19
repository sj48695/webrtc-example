# Mediasoup Tutorial(NestJS & React)

## 인증서 적용

```shell
brew install mkcert
mkcert -install

cd client/.cert
mkcert localhost 127.0.0.1 ::1 [IP]

cd server/src/.cert
mkcert localhost 127.0.0.1 ::1 [IP]
```

## 실행 방법(with docker)

```shell
docker compose up -d
```

## 실행 방법(without docker)

- 서버 실행

```shell
cd server
npm i
npm run start:dev
```

- 클라이언트 실행

```shell
cd client
npm i
npm run start
```

## 접속 방법

- 서버  
  https://localhost:5001

- 클라이언트  
  https://localhost:3001
