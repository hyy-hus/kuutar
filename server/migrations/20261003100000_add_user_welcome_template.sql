-- Allow the welcome email template alongside the reservation ones.
ALTER TABLE email_templates DROP CONSTRAINT email_templates_key_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_key_check
    CHECK (key IN ('reservation_created', 'reservation_confirmed', 'reservation_cancelled', 'user_welcome'));
