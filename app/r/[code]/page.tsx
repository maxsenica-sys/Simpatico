import { LangRoot } from "@/components/LangRoot";
import { Room } from "@/components/Room";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <LangRoot>
      <Room code={code.toLowerCase()} />
    </LangRoot>
  );
}
