-- Extend category check constraint to include 'random'
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_category_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_category_check
  CHECK (category IN ('business', 'investor', 'community', 'friend', 'acquaintance', 'random'));
