import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUFFER_ENDPOINT = "https://api.buffer.com";

async function bufferRequest(query: string, variables?: Record<string, unknown>) {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) throw new Error("BUFFER_API_KEY belum dikonfigurasi di environment Vercel.");

  const response = await fetch(BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Buffer API error ${response.status}.`);
  if (payload?.errors?.length) throw new Error(payload.errors[0]?.message || "Buffer API request gagal.");
  return payload?.data;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Session login tidak valid." }, { status: 401 });

  try {
    const account = await bufferRequest(`
      query BufferOrganizations {
        account {
          organizations { id name }
        }
      }
    `);

    const organizations = account?.account?.organizations ?? [];
    if (!organizations.length) {
      return NextResponse.json({ ok: false, error: "Tidak ada Buffer organization pada API key ini." }, { status: 404 });
    }

    const organization = organizations[0];
    const channelData = await bufferRequest(`
      query BufferChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          displayName
          service
          type
          avatar
          isQueuePaused
          isDisconnected
          isLocked
          timezone
        }
      }
    `, { organizationId: organization.id });

    const channels = (channelData?.channels ?? []).filter(
      (channel: any) => channel.service === "instagram" && !channel.isDisconnected && !channel.isLocked,
    );

    return NextResponse.json({
      ok: true,
      organization: { id: organization.id, name: organization.name },
      channels,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Gagal membaca channel Buffer." },
      { status: 500 },
    );
  }
}
