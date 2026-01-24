
import ConciergeNavbar from "@/components/ConciergeNavbar";

export default function VaultLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen bg-ac-sand pb-20">
            <ConciergeNavbar />
            <main className="pt-24 container mx-auto px-6 md:px-12">
                {children}
            </main>
        </div>
    );
}
