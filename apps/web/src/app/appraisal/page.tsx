import { PageHeader } from "@/components/PageHeader";
import { PostcodeAppraisal } from "@/components/appraisal/PostcodeAppraisal";

export default function AppraisalPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Appraisal"
        description="Enter a UK postcode. Sale prices come from Land Registry Price Paid. CIL, Section 106, and housing-land notes come only from the local planning authority’s published pages. A blank cost stays blank."
      />
      <PostcodeAppraisal />
    </div>
  );
}
