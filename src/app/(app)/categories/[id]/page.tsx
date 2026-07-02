import { CategoryPageContent } from "@/components/category-page";

export default async function CustomCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CategoryPageContent categoryId={id} path={`/categories/${id}`} />;
}
