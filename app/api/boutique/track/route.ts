import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isHttpUrl } from "@/app/lib/validation/parse";

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const itemId = searchParams.get("item_id");
    // Stored in boutique_clicks, so only a locale we actually have.
    const locale = searchParams.get("locale") === "es" ? "es" : "en";

    if (!itemId) {
        return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the item to get the target URL
    const { data: item, error } = await supabase
        .from("boutique_items")
        .select("affiliate_url_usa, affiliate_url_es")
        .eq("id", itemId)
        .single();

    if (error || !item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const targetUrl =
        locale === "es"
            ? item.affiliate_url_es || item.affiliate_url_usa
            : item.affiliate_url_usa || item.affiliate_url_es;

    // The schema refuses anything else on write; this also covers rows
    // written before it did. Never 302 a browser to javascript:, data: or a
    // relative URL (which NextResponse.redirect would throw on).
    if (!isHttpUrl(targetUrl)) {
        return NextResponse.json({ error: "No affiliate URL configured" }, { status: 404 });
    }

    // Record the click (best-effort — don't block the redirect on failure)
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("boutique_clicks").insert({
        item_id: itemId,
        user_id: user?.id || null,
        locale,
    });

    return NextResponse.redirect(targetUrl, { status: 302 });
}
