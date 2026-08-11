import AppLayout from "@/components/AppLayout";
import ArquivoClient from "./ArquivoClient";

export const dynamic = "force-dynamic";

export default function ArquivoPage() {
  return (
    <AppLayout>
      <ArquivoClient />
    </AppLayout>
  );
}
