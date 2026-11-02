import Link from "next/link";
import { PasteForm } from "@/components/PasteForm";

export const dynamic = "force-dynamic";

export default function PastePage() {
  return (
    <>
      <Link className="back" href="/leads">
        ← All leads
      </Link>
      <h1>Facebook paste</h1>
      <PasteForm />
    </>
  );
}
