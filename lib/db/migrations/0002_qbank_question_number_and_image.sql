-- Optional explicit question numbering and image links for editable Q-bank imports.
ALTER TABLE qbank_questions
  ADD COLUMN IF NOT EXISTS question_number integer,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS qbank_questions_lesson_question_number_idx
  ON qbank_questions (lesson_id, question_number);
