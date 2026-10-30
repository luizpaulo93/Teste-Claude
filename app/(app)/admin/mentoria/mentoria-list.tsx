"use client";

import { CalendarClock, Plus, Target, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MeetingForm } from "@/components/admin/meeting-form";
import { Avatar, Badge, Button, Card, EmptyState } from "@/components/ui";
import { ActionButton, Modal } from "@/components/ui-client";
import type { Mentoria, MentoriaMeeting } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { deleteMeeting } from "../misc-actions";
import { MentoriaForm } from "./mentoria-form";

export interface MentoriaSignals {
  idleDays: number | null;
  unread: number;
  tasks: number | null;
}

export function MentoriaList({
  mentorias,
  weekly,
  groupMeetings,
  signals,
}: {
  mentorias: Mentoria[];
  weekly: Record<string, string>;
  groupMeetings: MentoriaMeeting[];
  signals: Record<string, MentoriaSignals>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [meeting, setMeeting] = useState<{ m?: MentoriaMeeting } | null>(null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold text-ink">
            {mentorias.length} alunos
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Novo mentorado
          </Button>
        </div>
        {mentorias.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {mentorias.map((m) => (
              <Link key={m.id} href={`/admin/mentoria/${m.id}`}>
                <Card className="space-y-3 p-4 transition hover:border-brand/40">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={m.student_name || m.student_email}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">
                        {m.student_name || m.student_email}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {m.exam_target || m.student_email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        tone={m.status === "active" ? "success" : "neutral"}
                      >
                        {m.status === "active"
                          ? "Ativa"
                          : m.status === "paused"
                            ? "Pausada"
                            : "Encerrada"}
                      </Badge>
                      {weekly[m.id] === "pendente" && (
                        <Badge tone="warning">Check-in novo</Badge>
                      )}
                      {(signals[m.id]?.unread ?? 0) > 0 && (
                        <Badge tone="brand">
                          {signals[m.id].unread} mensagem(ns)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 empty:hidden">
                    {m.status === "active" &&
                      signals[m.id]?.idleDays === null && (
                        <Badge tone="danger">Ainda não estudou pelo app</Badge>
                      )}
                    {m.status === "active" &&
                      (signals[m.id]?.idleDays ?? 0) >= 3 && (
                        <Badge tone="danger">
                          {signals[m.id].idleDays} dias sem estudar
                        </Badge>
                      )}
                    {signals[m.id]?.tasks != null && (
                      <Badge
                        tone={
                          signals[m.id].tasks! >= 70
                            ? "success"
                            : signals[m.id].tasks! >= 40
                              ? "warning"
                              : "danger"
                        }
                      >
                        Tarefas da semana {signals[m.id].tasks}%
                      </Badge>
                    )}
                    {!m.diagnosed_at && <Badge>Sem diagnóstico</Badge>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Target className="size-6" />}
            title="Nenhum mentorado"
            description="Cadastre o e-mail do aluno para liberar a área de mentoria para ele."
          />
        )}
      </div>

      <Card className="p-5 xl:self-start">
        <div className="mb-4 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Users className="size-4 text-brand" /> Encontros em grupo
          </p>
          <Button size="sm" variant="secondary" onClick={() => setMeeting({})}>
            <Plus className="size-3.5" /> Agendar
          </Button>
        </div>
        {groupMeetings.length ? (
          <ul className="space-y-2">
            {groupMeetings.map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-3"
              >
                <CalendarClock className="size-4 shrink-0 text-brand" />
                <button
                  type="button"
                  onClick={() => setMeeting({ m: g })}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-semibold text-ink">
                    {g.title}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(g.starts_at)}
                  </p>
                </button>
                <ActionButton
                  action={() => deleteMeeting(g.id)}
                  confirm="Excluir encontro?"
                  success="Encontro excluído"
                  variant="ghost"
                  size="sm"
                  className="px-1.5 hover:text-danger"
                  title="Excluir"
                >
                  <Trash2 className="size-3.5" />
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Nenhum encontro em grupo agendado.
          </p>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Novo mentorado"
        size="lg"
      >
        <MentoriaForm
          onSaved={(id) => {
            setCreating(false);
            if (id) router.push(`/admin/mentoria/${id}`);
          }}
        />
      </Modal>
      <Modal
        open={Boolean(meeting)}
        onClose={() => setMeeting(null)}
        title={meeting?.m ? "Editar encontro" : "Encontro em grupo"}
      >
        {meeting && (
          <MeetingForm meeting={meeting.m} onDone={() => setMeeting(null)} />
        )}
      </Modal>
    </div>
  );
}
