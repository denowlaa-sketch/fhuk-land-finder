import { PageHeader } from "@/components/PageHeader";
import { PostcodeAppraisal } from "@/components/appraisal/PostcodeAppraisal";

export default function AppraisalPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Appraisal"
        description="Type a land address, postcode, and house type. The sheet follows the BuildUp template. A cell is filled only when a cited source states the figure. The other cells stay blank until you type them or link a source."
      />
      <PostcodeAppraisal />
    </div>
  );
}
