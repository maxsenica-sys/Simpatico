import { Home } from "@/components/Home";
import { LangRoot } from "@/components/LangRoot";
import { StartSplash } from "@/components/StartSplash";

export default function Page() {
  return (
    <>
      <StartSplash />
      <LangRoot>
        <Home />
      </LangRoot>
    </>
  );
}
