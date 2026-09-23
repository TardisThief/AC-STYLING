-- Masterclass-level resources.
--
-- `resource_urls` has only ever existed on `chapters`, so a downloadable that
-- belongs to a whole masterclass — a workbook, a colour chart — had to be
-- duplicated onto every module or dropped into one arbitrary module where
-- members would not find it. This gives the masterclass its own list; a module
-- page merges its masterclass's resources above its own, and the masterclass
-- screen gets a button that opens them for download.
--
-- Purely additive, one column with a default, so it is safe to apply before or
-- after the code ships: the reading code falls back to [] when the column is
-- absent from a cached type, and nothing writes it until the admin form does.
--
-- NOT NULL DEFAULT '[]' rather than nullable, matching how the chapters column
-- behaves in practice (every read does `?? []`) while making that explicit.
--
-- No grant change is needed. `chapters` carries COLUMN-level SELECT grants
-- since migration 09, where a new column would be invisible to anon and
-- authenticated until named in the grant; `masterclasses` still has a plain
-- table-level grant, so this column is readable immediately and none of the
-- `select('*')` call sites break.
--
-- KNOWN LIMITATION, deliberately out of scope. Exactly like
-- chapters.resource_urls (see the "STILL PUBLIC" note in
-- 20260911_09_chapter_video_entitlement.sql), this column is anonymously
-- readable over PostgREST: the entitlement check on the new panels is UI-level,
-- the same gating the courses page has today. Closing it properly means
-- revoking the table-level SELECT on `masterclasses`, re-granting every other
-- column, and replacing the three `select('*')` call sites with an explicit
-- column list — the same shape of change migration 09 made for chapters.

ALTER TABLE public.masterclasses
  ADD COLUMN IF NOT EXISTS resource_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- DOWN
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.masterclasses DROP COLUMN resource_urls;
