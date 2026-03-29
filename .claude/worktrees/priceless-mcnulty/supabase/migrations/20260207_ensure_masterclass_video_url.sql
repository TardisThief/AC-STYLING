DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'masterclasses' 
        AND column_name = 'video_url'
    ) THEN
        ALTER TABLE public.masterclasses ADD COLUMN video_url text;
    END IF;
END $$;
