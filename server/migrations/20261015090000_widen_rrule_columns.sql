-- Rules with a DTSTART line and a list of EXDATEs don't fit in 255 characters.
-- Widening varchar to text keeps every value as it is.
ALTER TABLE restrictions ALTER COLUMN rrule TYPE text;
ALTER TABLE reservable_blocks ALTER COLUMN rrule TYPE text;
