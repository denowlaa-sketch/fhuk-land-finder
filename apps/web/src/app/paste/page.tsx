import { PageHeader } from "@/components/PageHeader";
import { PasteForm } from "@/components/PasteForm";

export default function PastePage() {
  return (
    <>
      <PageHeader
        title="Facebook paste"
        description="Compliant intake: paste a public post URL (optional) and the text you copied. No Graph API or group scrapers."
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <PasteForm />
      </div>
    </>
  );
}
