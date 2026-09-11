import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,23}$/;

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("display_name,username")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return NextResponse.json({ email: user.email, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthenticated";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const displayName = String(body?.displayName || "").trim();
    const username = String(body?.username || "").trim().toLowerCase();
    if (!displayName || displayName.length > 40) {
      return NextResponse.json({ error: "Display name must be 1–40 characters." }, { status: 400 });
    }
    if (!usernamePattern.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–24 letters, numbers, dots, dashes, or underscores." },
        { status: 400 },
      );
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, username, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("display_name,username")
      .single();
    if (error?.code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    if (error) throw error;
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save your account.";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
