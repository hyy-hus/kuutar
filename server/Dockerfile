# server/Dockerfile
FROM rust:1-slim AS builder
WORKDIR /app

# Install native dependencies & curl
RUN apt-get update && apt-get install -y pkg-config libssl-dev curl && rm -rf /var/lib/apt/lists/*

# Copy manifest files
COPY Cargo.toml Cargo.lock ./

# Copy source code, migrations, AND the sqlx query cache
COPY src ./src
COPY migrations ./migrations
COPY .sqlx ./.sqlx

# Force SQLx to use offline metadata mode
ENV SQLX_OFFLINE=true

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/kuutar /app/server
COPY --from=builder /app/migrations /app/migrations

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
