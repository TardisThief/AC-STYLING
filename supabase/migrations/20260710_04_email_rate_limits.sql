-- P1 — Rate limiting for the transactional-email auth actions.
--
-- Additive and non-destructive: a counter table + an atomic fixed-window
-- function. Safe to apply anytime; old code ignores it. The app calls
-- check_rate_limit via the service-role client (see app/lib/rate-limit.ts) and
-- fails OPEN if this function is absent, so the code can ship before this runs.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text PRIMARY KEY,
  count        integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Lock the table down: RLS on with no policies means anon/authenticated cannot
-- touch it. The service role (used by the app) and the SECURITY DEFINER function
-- bypass RLS.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text, p_max integer, p_window interval
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start)
    VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.window_start < now() - p_window THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limits.window_start < now() - p_window THEN now()
      ELSE public.rate_limits.window_start
    END
  RETURNING count INTO v_count;

  -- Allowed when this request is within the max for the current window.
  RETURN v_count <= p_max;
END;
$$;
