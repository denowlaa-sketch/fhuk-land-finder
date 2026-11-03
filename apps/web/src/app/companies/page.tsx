import { PageHeader } from "@/components/PageHeader";

export default function CompaniesPage() {
  return (
    <>
      <PageHeader
        title="Companies"
        description="Optional CRM entity browser. Land deals are often plot + poster contact rather than a ltd company — stub for Solar shell parity."
      />
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
        No company graph yet. Import creates leads with landowner / contact
        fields; a Company model can be added later when agented sellers appear.
      </div>
    </>
  );
}
