import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  // Get the origin from the request
  const origin = new URL(request.url).origin;
  
  return NextResponse.redirect(new URL("/login", origin));
}

