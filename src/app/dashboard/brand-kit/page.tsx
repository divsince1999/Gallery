import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function updateBrandKit(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const studioName = formData.get("studioName") as string;
  const primaryColor = formData.get("primaryColor") as string;
  const accentColor = formData.get("accentColor") as string;
  
  await prisma.brandKit.upsert({
    where: { photographerId: session.user.id },
    update: { studioName, primaryColor, accentColor },
    create: { photographerId: session.user.id, studioName, primaryColor, accentColor },
  });

  revalidatePath("/dashboard/brand-kit");
}

export default async function BrandKitPage() {
  const session = await getServerSession(authOptions);
  
  const brandKit = await prisma.brandKit.findUnique({
    where: { photographerId: session?.user?.id },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Brand Kit</h1>
      <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
        <form action={updateBrandKit} className="space-y-6">
          <div>
            <label htmlFor="studioName" className="block text-sm font-medium text-gray-700">Studio Name</label>
            <input 
              type="text" 
              id="studioName" 
              name="studioName"
              required
              defaultValue={brandKit?.studioName || ""} 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">Primary Color</label>
            <div className="mt-1 flex items-center space-x-2">
              <input 
                type="color" 
                id="primaryColor" 
                name="primaryColor"
                defaultValue={brandKit?.primaryColor || "#000000"} 
                className="h-10 w-10 border-0 rounded-md shadow-sm p-0 cursor-pointer"
              />
              <span className="text-gray-500 text-sm">Select your main brand color</span>
            </div>
          </div>
          <div>
            <label htmlFor="accentColor" className="block text-sm font-medium text-gray-700">Accent Color (Optional)</label>
            <div className="mt-1 flex items-center space-x-2">
              <input 
                type="color" 
                id="accentColor" 
                name="accentColor"
                defaultValue={brandKit?.accentColor || "#ffffff"} 
                className="h-10 w-10 border-0 rounded-md shadow-sm p-0 cursor-pointer"
              />
              <span className="text-gray-500 text-sm">Select an optional secondary color</span>
            </div>
          </div>
          <button 
            type="submit" 
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Brand Kit
          </button>
        </form>
      </div>
    </div>
  );
}
