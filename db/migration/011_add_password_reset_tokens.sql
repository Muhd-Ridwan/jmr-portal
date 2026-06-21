CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL PRIVILEGES ON TABLE password_reset_tokens TO jmr;
GRANT ALL PRIVILEGES ON SEQUENCE password_reset_tokens_id_seq TO jmr;
