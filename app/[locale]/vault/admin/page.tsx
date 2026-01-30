import AdminDashboard from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
    return (
        <div>
            <div className="mb-8">
                <h1 className="font-serif text-4xl text-ac-taupe mb-2">Content Manager</h1>
                <p className="text-ac-taupe/60">Manage Masterclass chapters and resources</p>
            </div>

            <AdminDashboard />
        </div>
    );
}
