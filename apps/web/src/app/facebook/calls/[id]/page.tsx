import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Legacy route — call detail lives at /ad-leads/calls/[id]. */
export default async function FacebookCallRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/ad-leads/calls/${id}`);
}
