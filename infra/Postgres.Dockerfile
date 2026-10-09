FROM postgres:18.6-alpine3.24
RUN apk add --no-cache postgresql-pgvector=0.8.1-r0 \
    && cp /usr/lib/postgresql18/vector.so /usr/local/lib/postgresql/ \
    && cp /usr/share/postgresql18/extension/vector* /usr/local/share/postgresql/extension/
COPY --chmod=0644 infra/init-db.sh /docker-entrypoint-initdb.d/init.sh
