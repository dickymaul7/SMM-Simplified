# SMM StoryBrief Lite

Versi ringkas dari SMM Dashboard untuk menghasilkan brief storytelling B2B berkualitas tinggi dengan friction yang jauh lebih rendah.

## UX baru — hanya 3 tahap

1. **Quick Brief** — user mengisi 5 input utama: brand, topik/program, audience, objective, CTA (CTA opsional).
2. **Story Angles** — Tavily mencari kasus nyata; Gemini menyusun hidden Brand Context + memilih verified cases + menghasilkan 5 angle case-led.
3. **Final Brief** — pilih satu angle; AI membuat story sequence, quality review, auto-revision jika skor <90, Improve with AI, Copy Full Brief, dan Export PDF.

Tidak ada halaman Brand Intelligence panjang, Research Workspace, Content Pillars, atau Quality Review manual yang wajib dilewati user.

## Database

Project ini **sengaja menggunakan schema Supabase SMM Dashboard v1 yang sama**. Tidak perlu menjalankan SQL/RLS ulang jika schema lama sudah tersedia.

Data dari Lite ditandai secara internal pada `campaigns.priority_topics` dengan marker `__storybrief_lite__`, sehingga halaman history Lite hanya menampilkan campaign yang dibuat dari app ini.

## Environment Variables

Masukkan di Vercel Project Settings → Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (contoh: model Gemini yang saat ini dipakai project lama)
- `TAVILY_API_KEY`

Jangan upload `.env.local` ke GitHub.

## Deploy ke project baru

Rekomendasi nama:
- GitHub repo: `SMM-StoryBrief-Lite`
- Vercel project: `smm-storybrief-lite`

Upload seluruh isi folder ini ke root repo GitHub baru, sambungkan repo ke Vercel, tambahkan env variables, lalu Deploy.

Semua page utama menggunakan `dynamic = force-dynamic` supaya tidak bergantung pada Supabase env saat static prerender build.

## Quality controls

- live web research via Tavily
- source-aware synthesis via Gemini
- minimum verified case filtering
- Case-First opening sebagai default
- evidence safety rules
- mechanism-first insight
- self-review 12 dimensi
- auto-revision jika draft <90/100
- AI Improve tidak menerapkan versi baru jika score turun
- final sources + fact-check notes ditampilkan untuk human verification

## Catatan

Project ini tidak mengubah project lama. GitHub/Vercel dapat dibuat sebagai project yang benar-benar terpisah, tetapi tetap menggunakan Supabase dan API credentials yang sama untuk menghindari setup ulang database/auth.
