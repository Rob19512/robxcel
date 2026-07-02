import { getAEncaisserRows } from "@/lib/a-encaisser";
import { AEncaisserList } from "@/components/a-encaisser";

export default async function AEncaisserPage() {
  const rows = await getAEncaisserRows();
  return <AEncaisserList initialRows={rows} />;
}
