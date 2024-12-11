# Dockerfile
# 공통 베이스 이미지
FROM node:20-slim AS base

WORKDIR /app

# 공통 요구사항 설치
RUN apt-get update && apt-get install -y \
    python3 python3-pip build-essential \
    && apt-get clean

# # Server 빌드 단계
# FROM base AS server
# WORKDIR /app/server
# COPY ./server ./
# RUN npm install

# # Client 빌드 단계
# FROM base AS client
# WORKDIR /app/client
# COPY ./client ./
# RUN npm install