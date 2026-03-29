import { redirect } from "next/navigation";
import { getWardrobeByToken } from "@/app/actions/wardrobes";
import WardrobeUploadLanding from "@/components/studio/WardrobeUploadLanding";

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{ token: string; locale: string }>;
}

export default async function WardrobeUploadPage({ params }: Props) {
    const { token, locale } = await params;

    // Validate token and get wardrobe info
    const result = await getWardrobeByToken(token);

    if (!result.success || !result.wardrobe) {
        // Invalid or expired token
        redirect('/');
    }

    return (
        <section className="min-h-screen flex items-center justify-center py-12">
            <WardrobeUploadLanding
                wardrobe={result.wardrobe}
                token={token}
                locale={locale}
            />
        </section>
    );
}
