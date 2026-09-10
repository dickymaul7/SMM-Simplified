import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUFFER_ENDPOINT = "https://api.buffer.com";

type Metric = { type: string; name?: string | null; value: number | string | null; unit?: string | null };

type Channel = {
  id: string;
  name?: string | null;
  displayName?: string | null;
  service?: string | null;
  avatar?: string | null;
  organizationId: string;
  organizationName: string;
};

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

function dateWindow(days: number) {
  const now = new Date();
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setUTCDate(currentStart.getUTCDate() - days + 1);
  currentStart.setUTCHours(0, 0, 0, 0);
  currentEnd.setUTCHours(23, 59, 59, 999);

  const previousEnd = new Date(currentStart);
  previousEnd.setUTCMilliseconds(-1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  previousStart.setUTCHours(0, 0, 0, 0);

  return {
    currentStart: currentStart.toISOString(),
    currentEnd: currentEnd.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Session login tidak valid." }, { status: 401 });

  try {
    const requestedDays = Number(request.nextUrl.searchParams.get("days") || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const requestedChannelId = request.nextUrl.searchParams.get("channelId") || "";

    const account = await bufferRequest(`
      query GetOrganizations {
        account {
          organizations { id name channelCount }
        }
      }
    `);

    const organizations = account?.account?.organizations ?? [];
    if (!organizations.length) {
      return NextResponse.json({ ok: false, error: "Tidak ada Buffer organization pada API key ini." }, { status: 404 });
    }

    const channelQuery = `
      query GetChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id name displayName service avatar
        }
      }
    `;

    const channelGroups = await Promise.all(
      organizations.map(async (organization: { id: string; name: string }) => {
        const data = await bufferRequest(channelQuery, { organizationId: organization.id });
        return (data?.channels ?? []).map((channel: Omit<Channel, "organizationId" | "organizationName">) => ({
          ...channel,
          organizationId: organization.id,
          organizationName: organization.name,
        }));
      }),
    );

    const channels: Channel[] = channelGroups.flat();
    if (!channels.length) {
      return NextResponse.json({ ok: false, error: "Tidak ada channel Buffer yang terhubung." }, { status: 404 });
    }

    const selectedChannel = channels.find((channel) => channel.id === requestedChannelId) ?? channels[0];
    const range = dateWindow(days);

    const query = `
      query Analytics(
        $organizationId: OrganizationId!
        $channelIds: [ChannelId!]
        $currentStart: DateTime!
        $currentEnd: DateTime!
        $previousStart: DateTime!
        $previousEnd: DateTime!
      ) {
        current: aggregatedPostMetrics(input: {
          organizationId: $organizationId
          channelIds: $channelIds
          startDateTime: $currentStart
          endDateTime: $currentEnd
        }) {
          metrics { type name value unit }
          metricsUpdatedAt
        }
        previous: aggregatedPostMetrics(input: {
          organizationId: $organizationId
          channelIds: $channelIds
          startDateTime: $previousStart
          endDateTime: $previousEnd
        }) {
          metrics { type name value unit }
          metricsUpdatedAt
        }
        posts(
          first: 100
          input: {
            organizationId: $organizationId
            filter: {
              status: [sent]
              channelIds: $channelIds
              startDate: $currentStart
              endDate: $currentEnd
            }
            sort: [{ field: dueAt, direction: desc }, { field: createdAt, direction: desc }]
          }
        ) {
          edges {
            node {
              id
              text
              dueAt
              sentAt
              createdAt
              channelId
              externalLink
              metrics { type name value unit }
              metricsUpdatedAt
            }
          }
        }
      }
    `;

    const data = await bufferRequest(query, {
      organizationId: selectedChannel.organizationId,
      channelIds: [selectedChannel.id],
      ...range,
    });

    return NextResponse.json({
      ok: true,
      days,
      range,
      channels,
      selectedChannel,
      current: data?.current ?? { metrics: [], metricsUpdatedAt: null },
      previous: data?.previous ?? { metrics: [], metricsUpdatedAt: null },
      posts: (data?.posts?.edges ?? []).map((edge: { node: unknown }) => edge.node),
      note: "Buffer metrics diperbarui harian dan dapat tertinggal hingga sekitar 24 jam dari social network sumber.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Gagal mengambil analytics dari Buffer." },
      { status: 500 },
    );
  }
}
