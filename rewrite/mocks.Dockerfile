# 1edge rewrite mocks — mockd static server + annotation feedback endpoint.
# Built by kaniko from repo root: dockerfile=rewrite/mocks.Dockerfile
# (mirrors the proven design/mocks.Dockerfile; paths moved to rewrite/).
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY rewrite/server/go.mod rewrite/server/main.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/mockd .

FROM alpine:3.20
COPY --from=build /out/mockd /mockd
COPY rewrite/mocks/ /srv/html
ENV HTML_DIR=/srv/html \
    FEEDBACK_PATH=/data/feedback.jsonl \
    PORT=80
VOLUME /data
EXPOSE 80
ENTRYPOINT ["/mockd"]
