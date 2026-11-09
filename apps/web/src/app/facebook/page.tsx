import { redirect } from "next/navigation";

/** Legacy route — unified inbox lives at /ad-leads. */
export default function FacebookRedirectPage() {
  redirect("/ad-leads");
}
