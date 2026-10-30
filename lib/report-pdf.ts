/** PDF do relatório da mentoria (gerado no navegador com pdf-lib). */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { MentoriaReport, TopicStat } from './mentoria-report';

const W = 595.28; // A4
const H = 841.89;
const M = 42;
const INK = rgb(0.1, 0.12, 0.18);
const MUTED = rgb(0.42, 0.45, 0.52);
const BRAND = rgb(0.15, 0.39, 0.92);
const RED = rgb(0.85, 0.2, 0.25);
const LEVEL_COLORS = [rgb(0.94, 0.27, 0.27), rgb(0.98, 0.75, 0.14), rgb(0.22, 0.74, 0.97), rgb(0.23, 0.51, 0.96), rgb(0.06, 0.73, 0.51)];
const LEVEL_LABELS = ['Não estudado', 'Estudado', 'Revisão 01', 'Revisão 02', 'Revisão 03'];

/** Fonte padrão do PDF só tem Latin-1: troca o que não existe. */
const clean = (s: string) =>
  s
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');

class Writer {
  doc: PDFDocument;
  page!: PDFPage;
  y = 0;
  constructor(
    doc: PDFDocument,
    public font: PDFFont,
    public bold: PDFFont,
    private footer: string,
  ) {
    this.doc = doc;
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
    this.page.drawText(clean(this.footer), { x: M, y: 22, size: 8, font: this.font, color: MUTED });
  }
  need(h: number) {
    if (this.y - h < M) this.newPage();
  }
  lines(text: string, size: number, font: PDFFont, width: number) {
    const words = clean(text).split(/\s+/);
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > width && cur) {
        out.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }
  text(text: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.font;
    const x = o.x ?? M;
    for (const line of this.lines(text, size, font, o.width ?? W - x - M)) {
      this.need(size + 4);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= size + 3;
    }
    this.y -= o.gap ?? 2;
  }
  heading(t: string, color = INK) {
    this.need(40);
    this.y -= 8;
    this.text(t, { size: 13, bold: true, color, gap: 4 });
  }
  levels(levels: number[]) {
    this.need(34);
    const total = levels.reduce((a, b) => a + b, 0) || 1;
    let x = M;
    const bw = W - 2 * M;
    levels.forEach((n, i) => {
      const w = (n / total) * bw;
      if (w > 0) this.page.drawRectangle({ x, y: this.y - 10, width: w, height: 10, color: LEVEL_COLORS[i] });
      x += w;
    });
    this.y -= 22;
    this.text(LEVEL_LABELS.map((l, i) => `${l}: ${levels[i]}`).join('   '), { size: 8.5, color: MUTED, gap: 6 });
  }
  topics(list: TopicStat[], kind: 'hard' | 'errors' | 'best', empty: string) {
    if (!list.length) return this.text(empty, { size: 9.5, color: MUTED });
    list.forEach((t, i) => {
      const detail =
        kind === 'hard'
          ? [t.hard && `${t.hard}x ladeira abaixo`, t.medium && `${t.medium}x mais ou menos`, `${t.acc}% de acerto`].filter(Boolean).join(' · ')
          : kind === 'errors'
            ? `${t.errors} erros em ${t.questions} questões (${t.acc}%)`
            : `${t.correct}/${t.questions} acertos (${t.acc}%)`;
      this.text(`${i + 1}. ${t.title}`, { size: 10, bold: true, gap: 0 });
      this.text(`${t.discipline} · ${detail}`, { size: 8.5, color: MUTED, x: M + 12, gap: 3 });
    });
  }
}

export async function reportPdf(r: MentoriaReport) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const dmy = (x: string) => x.split('-').reverse().join('/');
  const when = r.week ? `Semana de ${dmy(r.week.from)} a ${dmy(r.week.to)}` : new Date(r.generatedAt).toLocaleDateString('pt-BR');
  const w = new Writer(doc, font, bold, `Relatório da mentoria · ${r.title} · ${when}`);
  const FEEL = ['', 'de boas', 'mais ou menos', 'ladeira abaixo'];
  const KIND = ['estudo', 'revisão 01', 'revisão 02', 'revisão 03', 'manutenção'];
  const g = r.general;
  const group = r.students.length > 1;

  w.text('RELATÓRIO DA MENTORIA', { size: 9, bold: true, color: BRAND, gap: 2 });
  w.text(r.title, { size: 20, bold: true, gap: 4 });
  const active = r.students.filter((s) => s.done.length);
  w.text(`${when}`, { size: 11, bold: true, gap: 2 });
  w.text(
    `${g.students} aluno${g.students === 1 ? '' : 's'} · ${active.length} estudaram na semana · ${g.questions} questões na semana · acerto ${g.questions ? `${g.acc}%` : '-'} · ${g.studied}/${g.total} assuntos já estudados no total`,
    { size: 9.5, color: MUTED, gap: 8 },
  );
  const idle = r.students.filter((s) => !s.done.length);
  if (group && idle.length) {
    w.heading('Não estudaram nesta semana', RED);
    w.text(idle.map((s) => s.name).join(', '), { size: 10, gap: 4 });
  }

  w.heading(group ? 'Assuntos de maior dificuldade da turma' : 'Assuntos de maior dificuldade', RED);
  w.topics(g.hardest, 'hard', 'Ninguém marcou dificuldade ainda.');
  w.heading(group ? 'Assuntos que a turma mais erra' : 'Assuntos que mais erra', RED);
  w.topics(g.mostErrors, 'errors', 'Sem erros registrados ainda.');
  w.heading('Onde está');
  w.levels(g.levels);
  w.heading('Por disciplina');
  for (const d of g.disciplines) w.text(`${d.name}: ${d.studied}/${d.total} estudados · ${d.questions} questões · acerto ${d.questions ? `${d.acc}%` : '-'}`, { size: 10, gap: 2 });
  if (g.best.length) {
    w.heading('Assuntos em que vai melhor');
    w.topics(g.best, 'best', '');
  }
  if (!group && r.students[0]) {
    w.heading('O que fez na semana');
    if (!r.students[0].done.length) w.text('Não estudou nesta semana.', { size: 10, color: RED });
    for (const x of r.students[0].done)
      w.text(`${dmy(x.d).slice(0, 5)} · ${x.discipline} · ${x.title} (${KIND[Math.min(4, x.l)]}) — ${x.c}/${x.q} (${x.acc}%)${x.f ? ` · ${FEEL[x.f]}` : ''}`, { size: 9.5, gap: 1 });
  }

  if (group)
    for (const s of r.students) {
      w.newPage();
      w.text('ALUNO', { size: 9, bold: true, color: BRAND, gap: 2 });
      w.text(s.name, { size: 16, bold: true, gap: 2 });
      w.text(
        `${s.email} · na semana: ${s.done.length} assunto(s), ${s.questions} questões, acerto ${s.questions ? `${s.acc}%` : '-'} · total: ${s.studied}/${s.total} estudados`,
        { size: 9.5, color: MUTED, gap: 6 },
      );
      w.levels(s.levels);
      w.heading('O que fez na semana');
      if (!s.done.length) w.text('Não estudou nesta semana.', { size: 10, color: RED });
      for (const x of s.done)
        w.text(`${dmy(x.d).slice(0, 5)} · ${x.discipline} · ${x.title} (${KIND[Math.min(4, x.l)]}) — ${x.c}/${x.q} (${x.acc}%)${x.f ? ` · ${FEEL[x.f]}` : ''}`, { size: 9.5, gap: 1 });
      w.heading('Maior dificuldade', RED);
      w.topics(s.hardest, 'hard', 'Nenhuma dificuldade marcada.');
      w.heading('Mais erra', RED);
      w.topics(s.mostErrors, 'errors', 'Sem erros registrados.');
      w.heading('Por disciplina');
      for (const d of s.disciplines) w.text(`${d.name}: ${d.studied}/${d.total} estudados · acerto ${d.questions ? `${d.acc}%` : '-'}`, { size: 10, gap: 2 });
      if (s.best.length) {
        w.heading('Vai melhor');
        w.topics(s.best, 'best', '');
      }
    }
  return doc.save();
}
