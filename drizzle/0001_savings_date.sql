ALTER TABLE savings ADD COLUMN savings_date TEXT;
CREATE INDEX idx_savings_date ON savings(savings_date);
