import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, LayoutDashboard, Palette } from "lucide-react";
import LogoutButton from "./LogoutButton";
import BfcacheGuard from "./BfcacheGuard";
import Providers from "./Providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <Providers>
      {/* Detects bfcache restoration and redirects to login if session is gone */}
      <BfcacheGuard />
      <div className="flex h-screen bg-gray-100">
        <aside className="w-64 bg-white shadow-md">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800">Gallery Platform</h1>
          </div>
          <nav className="mt-6">
            <Link href="/dashboard" className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50 hover:text-blue-600">
              <LayoutDashboard className="h-5 w-5 mr-3" />
              Dashboard
            </Link>
            <Link href="/dashboard/profile" className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50 hover:text-blue-600">
              <User className="h-5 w-5 mr-3" />
              Profile
            </Link>
            <Link href="/dashboard/brand-kit" className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50 hover:text-blue-600">
              <Palette className="h-5 w-5 mr-3" />
              Brand Kit
            </Link>
          </nav>
          <div className="absolute bottom-0 w-64 border-t p-4">
            <div className="flex items-center text-sm mb-4 truncate px-2">
              <span className="text-gray-500">{session.user.email}</span>
            </div>
            <LogoutButton />
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}
