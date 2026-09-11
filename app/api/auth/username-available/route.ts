import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,23}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username || "").trim().toLowerCase();
    if (!usernamePattern.test(username)) {
      return NextResponse.json(
        { available: false, error: "Use 3–24 letters, numbers, dots, dashes, or underscores." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .limit(1);
    if (error) throw error;
    return NextResponse.json({ available: !data?.length });
  } catch (error) {
    return NextResponse.json(
      { available: false, error: error instanceof Error ? error.message : "Could not check username." },
      { status: 500 },
    );
  }
}
