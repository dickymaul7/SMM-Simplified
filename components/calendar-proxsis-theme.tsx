"use client";

export default function CalendarProxsisTheme() {
  return (
    <style jsx global>{`
      .app-workspace .bg-blue-600,
      .app-workspace .bg-violet-600 { background-color: #DE0016 !important; }
      .app-workspace .hover\\:bg-blue-700:hover,
      .app-workspace .hover\\:bg-violet-700:hover { background-color: #B90012 !important; }
      .app-workspace .bg-blue-50,
      .app-workspace .bg-violet-50 { background-color: #FFF0F1 !important; }
      .app-workspace .bg-blue-100,
      .app-workspace .bg-violet-100 { background-color: #FFD8DC !important; }
      .app-workspace .text-blue-700,
      .app-workspace .text-blue-600,
      .app-workspace .text-violet-700,
      .app-workspace .text-violet-600 { color: #B90012 !important; }
      .app-workspace .text-blue-500,
      .app-workspace .text-violet-500 { color: #DE0016 !important; }
      .app-workspace .border-blue-500,
      .app-workspace .border-blue-400,
      .app-workspace .border-blue-300,
      .app-workspace .border-blue-200,
      .app-workspace .border-violet-500,
      .app-workspace .border-violet-400,
      .app-workspace .border-violet-300,
      .app-workspace .border-violet-200,
      .app-workspace .border-violet-100 { border-color: #FFB3BA !important; }
      .app-workspace .ring-blue-300,
      .app-workspace .ring-blue-200,
      .app-workspace .ring-violet-300 { --tw-ring-color: #FFB3BA !important; }
      .app-workspace .focus\\:border-blue-500:focus,
      .app-workspace .focus\\:border-violet-500:focus,
      .app-workspace .focus\\:border-red-700:focus { border-color: #B90012 !important; }
      .app-workspace .focus\\:ring-blue-50:focus { --tw-ring-color: rgb(185 0 18 / .10) !important; }
      .app-workspace .hover\\:border-blue-300:hover,
      .app-workspace .hover\\:border-red-300:hover { border-color: #DE0016 !important; }
      .app-workspace .hover\\:bg-red-50\\/40:hover { background-color: rgb(255 240 241 / .72) !important; }
    `}</style>
  );
}
