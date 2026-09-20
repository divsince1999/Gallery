"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  const handleLogout = async () => {
    await signOut({ redirect: false });
    // Use window.location.replace to overwrite the current history entry
    // This prevents the user from clicking 'Back' and triggering a redirect loop
    window.location.replace("/login");
  };

  return (
    <button 
      onClick={handleLogout}
      className="flex items-center text-red-600 hover:text-red-700 px-2 w-full text-left"
    >
      <LogOut className="h-5 w-5 mr-2" />
      Logout
    </button>
  );
}
