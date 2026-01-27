-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    price_display TEXT, -- Display string like "$500" or "$2,000/mo"
    price_id TEXT, -- Stripe Price ID (optional if using direct links)
    stripe_url TEXT, -- Direct payment link
    image_url TEXT,
    type TEXT DEFAULT 'session' CHECK (type IN ('session', 'retainer')),
    recommendation_tags TEXT[] DEFAULT '{}', -- Array of essence keywords
    active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read services"
ON public.services FOR SELECT
USING (active = true OR (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
));

CREATE POLICY "Admins can insert services"
ON public.services FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admins can update services"
ON public.services FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admins can delete services"
ON public.services FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    )
);

-- Trigger for updated_at
CREATE TRIGGER on_services_update
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
