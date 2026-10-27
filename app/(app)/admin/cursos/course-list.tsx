'use client';

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CoverFallback } from '@/components/course/course-card';
import { Badge, Button, Card, Img, buttonClass } from '@/components/ui';
import { ActionButton, Modal } from '@/components/ui-client';
import type { Course } from '@/lib/types';
import { deleteCourse, moveItem } from '../content-actions';
import { CourseForm } from './course-form';

export function NewCourseButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Novo curso
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo curso" size="lg">
        <CourseForm
          onSaved={(id) => {
            setOpen(false);
            router.push(`/admin/cursos/${id}`);
          }}
        />
      </Modal>
    </>
  );
}

export function CourseList({ courses, counts }: { courses: Course[]; counts: Record<string, number> }) {
  return (
    <div className="grid gap-3">
      {courses.map((c, i) => (
        <Card key={c.id} className="flex items-center gap-3 p-3 sm:gap-4">
          <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-16">
            {c.cover_url ? <Img src={c.cover_url} className="size-full object-cover" /> : <CoverFallback title="" seed={c.id} />}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/admin/cursos/${c.id}`} className="line-clamp-1 font-bold text-ink hover:text-brand">
              {c.title}
            </Link>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone={c.is_published ? 'success' : 'neutral'}>{c.is_published ? 'Publicado' : 'Rascunho'}</Badge>
              {c.is_free && <Badge tone="brand">Grátis</Badge>}
              {c.featured && <Badge tone="warning">Destaque</Badge>}
              <Badge>{counts[c.id] ?? 0} aulas</Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="hidden flex-col sm:flex">
              <ActionButton action={() => moveItem('courses', c.id, -1)} variant="ghost" size="sm" className="h-6 px-1.5" title="Subir">
                <ArrowUp className="size-3.5" />
              </ActionButton>
              <ActionButton action={() => moveItem('courses', c.id, 1)} variant="ghost" size="sm" className="h-6 px-1.5" title="Descer">
                <ArrowDown className="size-3.5" />
              </ActionButton>
            </div>
            <Link href={`/admin/cursos/${c.id}`} className={buttonClass('secondary', 'sm')}>
              <Pencil className="size-3.5" /> <span className="hidden sm:inline">Editar</span>
            </Link>
            <ActionButton
              action={() => deleteCourse(c.id)}
              confirm={`Excluir o curso "${c.title}" com todos os módulos e aulas? Essa ação não pode ser desfeita.`}
              success="Curso excluído"
              variant="danger"
              size="sm"
              title="Excluir"
            >
              <Trash2 className="size-3.5" />
            </ActionButton>
          </div>
          <span className="sr-only">{i}</span>
        </Card>
      ))}
    </div>
  );
}
