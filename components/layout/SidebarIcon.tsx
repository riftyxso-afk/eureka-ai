import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  kursus: <><path fill="#8253D4" d="m2 12 14-7 14 7-14 7z"/><path fill="#B995ED" d="M7 17v7q9 7 18 0v-7l-9 5z"/><path stroke="#FFCC54" strokeWidth="2" strokeLinecap="round" d="M28 14v10"/><circle cx="28" cy="25" r="2" fill="#FFCC54"/></>,
  catatan: <><rect x="6" y="4" width="20" height="25" rx="4" fill="#8253d4"/><rect x="9" y="6" width="15" height="20" rx="2" fill="#e6d8fa"/><path d="M12 12h9M12 16h9M12 20h6" stroke="#a37de0" strokeWidth="2" strokeLinecap="round"/></>,
  dashboard: <><path fill="#FFBB38" d="M5 15h22v13H5z"/><path fill="#FF6E64" d="M2 15 16 3l14 12-2.8 3L16 8.7 4.8 18z"/><path fill="#FFE783" d="M9 16h14v12H9z"/><path fill="#8B58D6" d="M13 20h6v8h-6z"/></>,
  "mata-pelajaran": <><path fill="#7643D3" d="M3 6q7-3 13 2 6-5 13-2v20q-7-3-13 2-6-5-13-2z"/><path fill="#C1A1F5" d="M5 8q6-2 10 2v15q-4-3-10-2z"/><path fill="#E8DAFF" d="M17 10q4-4 10-2v15q-6-1-10 2z"/></>,
  leaderboard: <><path fill="#EBA51C" d="M7 5h18v13c0 6-4 9-9 11-5-2-9-5-9-11z"/><path fill="#FFD14A" d="M9 5h16v11c0 5-3 8-8 10-4-2-8-5-8-10z"/><path fill="#FFF2A8" d="m16 9 1.6 3.3 3.7.5-2.7 2.6.7 3.6-3.3-1.7-3.3 1.7.7-3.6-2.7-2.6 3.7-.5z"/></>,
  misi: <><rect x="4" y="10" width="24" height="18" rx="3" fill="#E3A323"/><rect x="4" y="8" width="24" height="12" rx="3" fill="#FFCB43"/><path fill="#FFF0AE" d="M13 15h6v8h-6z"/><path fill="#8050CC" d="M15 17h2v4h-2z"/><path fill="#FFDC74" d="M8 5h3v7H8zm13 0h3v7h-3z"/></>,
  jadwal: <><rect x="5" y="5" width="22" height="23" rx="4" fill="#8D5DDC"/><path fill="#C8ACFA" d="M7 12h18v13H7z"/><path stroke="#FFCA47" strokeWidth="2.5" strokeLinecap="round" d="m11 18 2.5 2.5L21 14"/><path stroke="#6840AC" strokeWidth="3" strokeLinecap="round" d="M11 3v5m10-5v5"/></>,
  profil: <><circle cx="16" cy="16" r="14" fill="#B58AEA"/><path fill="#6540A8" d="M6 25q1-7 10-7t10 7q-10 9-20 0"/><circle cx="16" cy="13" r="6" fill="#FFCB94"/><path fill="#493366" d="M10 12q0-8 6-8 7 0 7 8l-3-2-2-3q-2 4-8 5"/></>,
  more: <><circle cx="16" cy="16" r="13" fill="#B47DE8"/><circle cx="10" cy="16" r="1.7" fill="white"/><circle cx="16" cy="16" r="1.7" fill="white"/><circle cx="22" cy="16" r="1.7" fill="white"/></>,
};

export default function SidebarIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false" className="eureka-sidebar-art">{icons[name] ?? icons.more}</svg>;
}
