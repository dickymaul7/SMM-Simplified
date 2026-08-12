# SMM Simplified — Team Setup Guide

Paket ini berasal dari branch `ui-revamp` terbaru dan ditujukan agar tim dapat membuat repository GitHub dan deployment Vercel mereka sendiri.

## 1. Buat repository GitHub baru

1. Extract ZIP.
2. Buat repository GitHub baru.
3. Upload seluruh ISI folder project ke root repository.
4. Jangan upload `.env.local`, `.env`, `node_modules`, `.next`, atau `.vercel`.

## 2. Environment Variables

Salin `.env.example` menjadi `.env.local` untuk penggunaan lokal, atau masukkan variabel yang sama di Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `TAVILY_API_KEY`

Nilai rahasia harus dibagikan melalui channel internal yang aman, bukan GitHub.

## 3. Supabase

Versi source ini menggunakan Supabase untuk Auth + database.

### Opsi tercepat — backend bersama
Gunakan project Supabase yang sama dengan aplikasi utama. Semua deployment akan membaca database yang sama.

### Opsi independen
Jika tim ingin database yang benar-benar terpisah, buat project Supabase baru lalu migrasikan schema/RLS dari project sumber. Repository ini saat ini tidak membawa export lengkap schema production; `database/README.txt` hanya menjelaskan bahwa aplikasi Lite menggunakan schema SMM Dashboard yang sudah ada.

## 4. Gemini + Tavily

- Gemini digunakan untuk reasoning/storytelling.
- Tavily digunakan untuk live web research.
- Jangan commit API key.

## 5. Local development

```bash
npm install
npm run dev
```

Lalu buka URL localhost yang ditampilkan Next.js.

## 6. Deploy ke Vercel

1. Import repository GitHub ke Vercel.
2. Framework: Next.js (auto detect).
3. Tambahkan seluruh Environment Variables.
4. Deploy.
5. Setelah status `Ready`, test login dan `Cari Kasus & Buat 5 Story Angles`.

## 7. Smoke test wajib

- Login berhasil.
- Brief Studio terbuka.
- Quick Brief autosave bekerja.
- Generate menghasilkan 5 Story Angles.
- Full Brief terbuka.
- Slide bisa edit / reorder / delete.
- Human QC bekerja.
- Jadwalkan Brief bekerja.
- Content Calendar menampilkan scheduled content.
- Ready to Design / Designed bekerja.
- Link file design tersimpan.

## 8. Catatan penting

- `AGENTS.md` dan folder `docs/` sengaja ikut disertakan agar Codex/developer memahami arsitektur, quality bar, dan aturan non-regression.
- Jangan menggunakan file root-level `calendar-client.tsx` sebagai basis pengembangan; implementasi Calendar aktif berada di `components/pages/calendar-client.tsx`.
- Jangan mengubah AI prompt/storytelling engine hanya untuk redesign UI.
