import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BUFFER_ENDPOINT = "https://api.buffer.com";

type ScheduleBody = {
  channelId?: string;
  text?: string;
  dueAt?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Session login tidak valid." }, { status: 401 });

  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "BUFFER_API_KEY belum dikonfigurasi di environment Vercel." }, { status: 500 });
  }

  let body: ScheduleBody;
  try {
    body = (await request.json()) as ScheduleBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload scheduling tidak valid." }, { status: 400 });
  }

  const channelId = body.channelId?.trim();
  const text = body.text?.trim() || "";
  const mediaUrl = body.mediaUrl?.trim();
  const mediaType = body.mediaType === "video" ? "video" : "image";
  const instagramPostType = mediaType === "video" ? "reel" : "post";
  const dueAt = body.dueAt?.trim();

  if (!channelId) return NextResponse.json({ ok: false, error: "Channel Instagram Buffer belum dipilih." }, { status: 400 });
  if (!mediaUrl || !/^https:\/\//i.test(mediaUrl)) {
    return NextResponse.json({ ok: false, error: "Instagram membutuhkan direct public media URL dengan https://." }, { status: 400 });
  }
  if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) {
    return NextResponse.json({ ok: false, error: "Tanggal/jam publish tidak valid." }, { status: 400 });
  }
  if (new Date(dueAt).getTime() <= Date.now() + 60_000) {
    return NextResponse.json({ ok: false, error: "Waktu publish harus berada di masa depan." }, { status: 400 });
  }

  const asset = mediaType === "video"
    ? { video: { url: mediaUrl } }
    : { image: { url: mediaUrl } };

  const query = `
    mutation ScheduleInstagramPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            dueAt
            status
            channelId
            assets { id mimeType }
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  try {
    const response = await fetch(BUFFER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            text,
            channelId,
            type: instagramPostType,
            schedulingType: "automatic",
            mode: "customScheduled",
            dueAt,
            assets: [asset],
            source: "smm-simplified",
          },
        },
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: payload?.message || `Buffer API error ${response.status}.` }, { status: 502 });
    }
    if (payload?.errors?.length) {
      return NextResponse.json({ ok: false, error: payload.errors[0]?.message || "Buffer API request gagal." }, { status: 502 });
    }

    const result = payload?.data?.createPost;
    if (result?.message && !result?.post) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
    }
    if (!result?.post?.id) {
      return NextResponse.json({ ok: false, error: "Buffer tidak mengembalikan post ID." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, post: result.post });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Gagal menjadwalkan post ke Buffer." },
      { status: 500 },
    );
  }
}
