"use client";

import AuthGuard from "@/components/auth-guard";
import AppHeader from "@/components/app-header";

type PlaceholderKind = "overview" | "analytics" | "brands" | "settings";

const content: Record<PlaceholderKind, { eyebrow: string; title: string; description: string; label: string; detail: string }> = {
  overview: { eyebrow: "Workspace", title: "Overview", description: "Ringkasan operasional konten akan membantu tim melihat prioritas dari brief hingga design handoff.", label: "Overview sedang disiapkan", detail: "Fase ini membangun fondasi antarmuka terlebih dahulu. Data overview akan ditambahkan tanpa mengubah workflow produksi yang sudah stabil." },
  analytics: { eyebrow: "Performance", title: "Analytics", description: "Satu workspace untuk membaca performa konten dan mengambil keputusan editorial berikutnya.", label: "Analytics segera hadir", detail: "Integrasi data dan Meta API tidak termasuk dalam fase ini. Halaman ini belum membaca atau menyimpan data apa pun." },
  brands: { eyebrow: "Workspace", title: "Brands", description: "Kelola konteks brand dalam satu tempat saat dukungan multi-brand sudah siap diluncurkan.", label: "Brand workspace segera hadir", detail: "Belum ada filter, context provider, query, atau perubahan akses brand pada fase ini." },
  settings: { eyebrow: "Account", title: "Settings", description: "Pengaturan workspace, preferensi, dan akses akun akan tersedia dari halaman ini.", label: "Settings sedang disiapkan", detail: "Tidak ada pengaturan autentikasi, Supabase, atau hak akses yang diubah pada fase ini." },
};

function PlaceholderIcon({ kind }: { kind: PlaceholderKind }) {
  const glyph = kind === "overview" ? "⌁" : kind === "analytics" ? "↗" : kind === "brands" ? "◎" : "⚙";
  return <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-xl font-semibold text-blue-600">{glyph}</div>;
}

export default function WorkspacePlaceholder({ kind }: { kind: PlaceholderKind }) {
  const page = content[kind];
  return <AuthGuard>
    <AppHeader />
    <main className="app-workspace px-5 py-8 lg:px-8 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="ui-page-header">
          <div>
            <p className="ui-eyebrow">{page.eyebrow}</p>
            <h1 className="ui-page-title">{page.title}</h1>
            <p className="ui-page-description">{page.description}</p>
          </div>
          <span className="ui-badge ui-badge-neutral"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Phase berikutnya</span>
        </header>

        <section className="ui-card grid min-h-[360px] place-items-center p-8 text-center">
          <div className="max-w-md">
            <div className="flex justify-center"><PlaceholderIcon kind={kind} /></div>
            <h2 className="mt-5 text-lg font-bold tracking-tight text-slate-900">{page.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{page.detail}</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> UI shell aktif · Belum ada data logic
            </div>
          </div>
        </section>
      </div>
    </main>
  </AuthGuard>;
}
