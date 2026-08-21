import { StorefrontSidebar } from "@/components/navigation/StorefrontSidebar";
import { getCachedCategoryTree } from "@/server/cache/catalogue";

export const revalidate = 60;

export default async function StorefrontSidebarSlot() {
  const tree = await getCachedCategoryTree();

  return <StorefrontSidebar tree={tree} />;
}
