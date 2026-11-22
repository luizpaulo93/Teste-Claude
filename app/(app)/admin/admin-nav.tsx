"use client";

import {
  BarChart3,
  BookOpen,
  FileQuestion,
  FolderOpen,
  Radio,
  Trophy,
  CalendarDays,
  ClipboardCheck,
  Settings,
  Target,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Visão geral", icon: BarChart3 },
  { href: "/admin/aulas", label: "Aulas", icon: FolderOpen },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/alunos", label: "Alunos", icon: Users },
  { href: "/admin/turmas", label: "Turmas", icon: UsersRound },
  { href: "/admin/ao-vivo", label: "Ao vivo", icon: Radio },
  { href: "/admin/simulados", label: "Simulados", icon: ClipboardCheck },
  { href: "/admin/questoes", label: "Questões", icon: FileQuestion },
  { href: "/desempenho", label: "Desempenho", icon: Trophy },
  { href: "/admin/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/admin/mentoria", label: "Mentoria", icon: Target },
  { href: "/admin/config", label: "Configurações", icon: Settings },
];

export function AdminNav({ mentoriaAlert = 0 }: { mentoriaAlert?: number }) {
  const pathname = usePathname();
  const rail = useRef<HTMLDivElement>(null);
  // no celular as abas rolam de lado: a aba aberta fica sempre à vista (no meio), sem mexer na página
  useEffect(() => {
    const box = rail.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (box && el)
      box.scrollLeft = Math.max(
        0,
        el.offsetLeft - (box.clientWidth - el.clientWidth) / 2,
      );
  }, [pathname]);
  // Só nas telas de gestão (e em Desempenho/Calendário, que o admin abre daqui)
  if (!/^\/(admin|desempenho|calendario)(\/|$)/.test(pathname)) return null;
  return (
    // fica preso no topo ao rolar (abaixo da barra do celular)
    <div
      data-chrome
      className="sticky top-14 z-30 -mx-4 mb-6 border-b border-line bg-bg/95 backdrop-blur-xl sm:-mx-6 lg:top-0 lg:-mx-10"
    >
      <div
        ref={rail}
        className="rail flex gap-1 overflow-x-auto px-4 sm:px-6 lg:px-10"
      >
        {TABS.map((t) => {
          const active =
            t.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium transition-colors",
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <t.icon className="size-4" /> {t.label}
              {t.href === "/admin/mentoria" && mentoriaAlert > 0 && (
                <span
                  className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
                  title="Dúvidas da mentoria sem resposta"
                >
                  {mentoriaAlert}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      {/* esmaecido na borda: há mais abas para o lado */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent lg:hidden"
      />
    </div>
  );
}
