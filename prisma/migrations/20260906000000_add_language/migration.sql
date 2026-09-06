-- Restaurant UI language. "EN" = English (default), "NEP" = Nepali.
-- Only fixed admin UI strings are translated; menu content and forms stay in
-- the language they were authored in.
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'EN';

UPDATE "Restaurant" SET "language" = 'EN' WHERE "language" IS NULL OR "language" NOT IN ('EN', 'NEP');