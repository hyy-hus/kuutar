use kuutar::config::Config;

pub fn test_config() -> Config {
    Config {
        database_url: "postgres://postgres:postgres@localhost:5432/test_db".to_string(),
        bind_addr: "127.0.0.1:0".parse().expect("valid socket address"),
        max_db_connections: 5,
        jwt_secret: "test_secret_key_12345_super_secret".to_string(),
        jwt_expiration_seconds: 900,
    }
}
