import type { Metadata } from 'next';
import { Compass } from 'lucide-react';
import { CourseCard } from '@/components/course/course-card';
import { EmptyState, PageHeader } from '@/components/ui';
import { courseProgress, getCatalog, getMyProgress } from '@/lib/data';
import { getCatalogData } from '@/lib/db';
import { canAccessCourse, getSettings, requireViewer } from '@/lib/session';
import { CategoryFilter } from './category-filter';

export const metadata: Metadata = { title: 'Cursos' };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const viewer = await requireViewer();
  const [{ c }, settings, { courses, lessonCount, courseLessons }, progress] = await Promise.all([
    searchParams,
    getSettings(),
    getCatalog(),
    getMyProgress(viewer.userId),
  ]);
  // Curso gratuito só aparece para quem não está em nenhuma turma
  const visible = courses.filter((x) => !(x.is_free && viewer.classGroup && !viewer.isAdmin));
  // Filtro: as tags que o admin criou (na ordem dele), só as que têm curso
  const { tags } = await getCatalogData();
  const used = new Set(visible.flatMap((x) => x.tag_ids ?? []));
  const categories = tags.filter((t) => used.has(t.id)).map((t) => ({ id: t.id, name: t.name }));
  const list = c ? visible.filter((x) => (x.tag_ids ?? []).includes(c)) : visible;

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Cursos" />
      {categories.length > 0 && <CategoryFilter categories={categories} active={c} />}
      {list.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 xl:grid-cols-5">
          {list.map((course, i) => {
            const locked = !canAccessCourse(viewer, course, settings.restrict_to_student_list);
            const total = lessonCount.get(course.id) ?? 0;
            return (
              <div key={course.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <CourseCard course={course} locked={locked} lessons={total} progress={locked ? 0 : courseProgress(courseLessons.get(course.id), progress)} priority={i < 6} />
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Compass className="size-6" />} title="Nenhum curso por aqui" description="Assim que novos cursos forem publicados eles aparecem nesta página." />
      )}
    </>
  );
}
