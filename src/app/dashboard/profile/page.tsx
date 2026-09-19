import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function updateProfile(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  
  await prisma.photographer.update({
    where: { id: session.user.id },
    data: { name },
  });

  revalidatePath("/dashboard/profile");
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  
  const user = await prisma.photographer.findUnique({
    where: { id: session?.user?.id },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile Settings</h1>
      <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
        <form action={updateProfile} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Cannot be changed)</label>
            <input 
              type="email" 
              id="email" 
              value={user?.email || ""} 
              disabled 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 text-gray-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input 
              type="text" 
              id="name" 
              name="name"
              defaultValue={user?.name || ""} 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <button 
            type="submit" 
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
