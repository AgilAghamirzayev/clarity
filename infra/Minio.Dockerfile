FROM golang:1.24.5-bookworm AS build
WORKDIR /src
RUN git clone --depth 1 --branch RELEASE.2025-07-23T15-54-02Z https://github.com/minio/minio.git . \
    && test "$(git rev-parse HEAD)" = "7ced9663e6a791fef9dc6be798ff24cda9c730ac"
RUN CGO_ENABLED=0 go build -trimpath -ldflags "$(MINIO_RELEASE=RELEASE go run buildscripts/gen-ldflags.go)" -o /out/minio .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /usr/share/doc/minio/LICENSE
EXPOSE 9000
ENTRYPOINT ["minio"]
CMD ["server", "/data"]
