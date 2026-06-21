CREATE TABLE IF NOT EXISTS child_services (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    service_type_id INTEGER NOT NULL REFERENCES service_types(id),
    UNIQUE (child_id, service_type_id)
);

-- Migrate existing single service assignments into the junction table
INSERT INTO child_services (child_id, service_type_id)
SELECT id, service_type_id FROM children WHERE service_type_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE children DROP COLUMN IF EXISTS service_type_id;
