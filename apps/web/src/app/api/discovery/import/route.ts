import { NextResponse } from "next/server";
import { importProspect } from "@/lib/discovery";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id =
    typeof body === "object" &&
    body !== null &&
    "id" in body &&
    typeof (body as { id: unknown }).id === "string"
      ? (body as { id: string }).id
      : null;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const result = await importProspect(id);
    if (!result) {
      return NextResponse.json(
        { error: "Prospect not found or database unavailable" },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
