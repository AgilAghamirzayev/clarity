ALTER TABLE calls ADD COLUMN display_number bigint GENERATED ALWAYS AS IDENTITY (START WITH 1001);
CREATE UNIQUE INDEX calls_display_number ON calls(display_number);
