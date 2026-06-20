CREATE TABLE IF NOT EXISTS service_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    monthly_fee NUMERIC(10, 2) NOT NULL,
    registration_fee NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO service_types (name, monthly_fee, registration_fee) VALUES
('quran_only', 30.00, 20.00),
('tuition_and_quran', 200.00, 50.00)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE children
    ADD COLUMN IF NOT EXISTS service_type_id INTEGER REFERENCES service_types(id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'children' AND column_name = 'service_type'
    ) THEN
        UPDATE children
            SET service_type_id = (SELECT id FROM service_types WHERE name = children.service_type)
            WHERE service_type_id IS NULL;
    END IF;
END $$;

ALTER TABLE children
    ALTER COLUMN service_type_id SET NOT NULL;

ALTER TABLE children
    DROP COLUMN IF EXISTS service_type;