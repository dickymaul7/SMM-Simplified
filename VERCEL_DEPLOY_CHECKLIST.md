# Deploy Checklist — SMM StoryBrief Lite

1. Buat GitHub repository baru, disarankan **SMM-StoryBrief-Lite**.
2. Upload **isi folder** project ini ke root repository.
3. Buat Vercel project baru dan import repository tersebut.
4. Tambahkan Environment Variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - GEMINI_API_KEY
   - GEMINI_MODEL
   - TAVILY_API_KEY
5. Deploy.
6. Login menggunakan user Supabase Auth yang sudah ada.
7. Test Quick Brief → Story Angles → Generate Full Brief → Improve / Copy / Export PDF.

Tidak perlu menjalankan SQL atau RLS ulang jika memakai Supabase project lama.
