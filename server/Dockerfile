# server/Dockerfile
FROM rust:1-slim-bookworm AS builder
WORKDIR /app

# Install native dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev curl && rm -rf /var/lib/apt/lists/*

# Copy manifests, source code, migrations, and SQLx metadata
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY .sqlx ./.sqlx

# Force SQLx to use offline metadata mode
ENV SQLX_OFFLINE=true

# Build release binary using BuildKit cache mounts for Cargo registry & build cache
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    cp /app/target/release/kuutar /app/kuutar-bin

# Runtime stage (matching bookworm base)
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/kuutar-bin /app/server
COPY --from=builder /app/migrations /app/migrations

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
