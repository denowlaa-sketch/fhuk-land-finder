import { lookupPostcode } from "@/lib/appraisal/lookupPostcode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const postcode = new URL(request.url).searchParams.get("postcode") ?? "";
  try {
    const lookup = await lookupPostcode(postcode);
    return Response.json(lookup);
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : "The lookup failed.";
    if (status === 400) return Response.json({ error: message }, { status: 400 });
    if (status === 404) return Response.json({ error: "That postcode was not found." }, { status: 404 });
    if (message.startsWith("HTTP 404")) {
      return Response.json({ error: "That postcode was not found." }, { status: 404 });
    }
    return Response.json({ error: "The postcode lookup failed before a quote could be filled." }, { status: 502 });
  }
}
