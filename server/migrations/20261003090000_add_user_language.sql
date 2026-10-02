-- Preferred language for emails (and the UI default); one of the supported codes.
ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'fi';
ALTER TABLE users ADD CONSTRAINT users_language_supported CHECK (language IN ('fi', 'sv', 'en'));
