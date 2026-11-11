# server/Dockerfile
#
# cargo-chef splits the build in two: the dependencies are compiled in their own layer, which is
# reused until Cargo.toml or Cargo.lock change, so a normal code change only recompiles the crate.
FROM lukemathwalker/cargo-chef:latest-rust-1-slim-bookworm AS chef
WORKDIR /app

# Work out the dependency "recipe" (changes only when the manifests change)
FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
# Compile the dependencies only; this is the slow, cached layer
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --bin kuutar --recipe-path recipe.json

# Copy manifests, source code, migrations, and SQLx metadata
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
COPY .sqlx ./.sqlx

# Force SQLx to use offline metadata mode
ENV SQLX_OFFLINE=true

RUN cargo build --release --locked --bin kuutar

# Runtime stage (matching bookworm base)
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/kuutar /app/server
COPY --from=builder /app/migrations /app/migrations

ENV PORT=8080
EXPOSE 8080

CMD ["/app/server"]
