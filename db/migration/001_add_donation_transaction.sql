CREATE TABLE IF NOT EXISTS donation_transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    receipt_key TEXT,
    transaction_date DATE NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);