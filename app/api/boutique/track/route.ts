import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const itemId = searchParams.get("item_id");
    const locale = searchParams.get("locale") || "en";

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

    if (!targetUrl) {
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
