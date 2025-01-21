IMAGE_NAME=mediasoup-base
IMAGE_TAG=node-20-ubuntu-22
IMAGE_NAME=$IMAGE_NAME:$IMAGE_TAG
# docker build \
#   --platform linux/amd64 \
#   -t $IMAGE_NAME -f Dockerfile .
docker build \
  -t $IMAGE_NAME -f Dockerfile .

docker compose up -d --build

#  docker compose build --progress plain --no-cache