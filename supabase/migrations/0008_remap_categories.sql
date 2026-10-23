-- Drop old constraint first, then migrate data, then add new constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_category_check;

UPDATE contacts SET category = 'extern'   WHERE category IN ('business', 'investor');
UPDATE contacts SET category = 'other'    WHERE category IN ('community', 'acquaintance', 'random');
UPDATE contacts SET category = 'private'  WHERE category = 'friend';

ALTER TABLE contacts ADD CONSTRAINT contacts_category_check
  CHECK (category IN ('colleague', 'alumni', 'extern', 'private', 'other'));
