import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Welcome back, {session?.user?.name || session?.user?.email}!</h2>
        <p className="text-gray-600">
          This is your V1 gallery dashboard. You can manage your profile, configure your brand kit, and (soon) create events and upload photos.
        </p>
      </div>
    </div>
  );
}
