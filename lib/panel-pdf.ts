/** PDF do painel do mentor (gerado no navegador): rankings, evolução, onde atacar e a ficha de cada aluno. */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { MentorPanel, PanelStudent } from './mentoria-panel';
import { BRAND, clean, H, INK, LEVEL_COLORS, M, MUTED, RED, W, Writer } from './report-pdf';

const GREEN = rgb(0.05, 0.6, 0.38);
const dmy = (x: string) => x.split('-').reverse().join('/');
const accTxt = (a: number | null) => (a === null ? '-' : `${a}%`);
const deltaTxt = (d: number | null) => (d === null ? '-' : d > 0 ? `+${d} p.p.` : `${d} p.p.`);

export async function panelPdf(p: MentorPanel) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const period = `${dmy(p.start)} a ${dmy(p.today)} (comparado aos ${p.days} dias anteriores)`;
  const w = new Writer(doc, font, bold, `Painel da mentoria · ${period}`);

  w.text('PAINEL DA MENTORIA', { size: 9, bold: true, color: BRAND, gap: 2 });
  w.text(`Últimos ${p.days} dias`, { size: 20, bold: true, gap: 4 });
  w.text(period, { size: 10, color: MUTED, gap: 8 });
  const t = p.totals;
  w.text(
    `${t.students} mentorados · ${t.active} ativos no período · ${t.answered} questões · acerto ${accTxt(t.accuracy)} · ${t.lists} listas feitas · ${t.mastered}/${t.subjects} assuntos dominados`,
    { size: 10, gap: 8 },
  );

  const rank = (title: string, list: PanelStudent[], line: (s: PanelStudent) => string, color = INK, empty = 'Ninguém neste período.') => {
    w.heading(title, color);
    if (!list.length) return w.text(empty, { size: 9.5, color: MUTED });
    list.forEach((s, i) => {
      w.text(`${i + 1}. ${s.name}`, { size: 10, bold: true, gap: 0 });
      w.text(line(s), { size: 8.5, color: MUTED, x: M + 12, gap: 3 });
    });
  };
  rank('Mais ativos', p.rankings.active, (s) => `${s.answered} questões · ${s.activeDays} dia(s) com estudo · ${s.listsDone} lista(s)`);
  rank('Mais acertam', p.rankings.best, (s) => `${accTxt(s.accuracy)} de acerto em ${s.answered} questões`, GREEN);
  rank('Mais erram', p.rankings.worst, (s) => `${s.answered - s.correct} erros em ${s.answered} questões (${accTxt(s.accuracy)})`, RED);
  rank(
    'Sem usar a plataforma',
    p.rankings.inactive,
    (s) => (s.lastActive ? `última atividade em ${dmy(s.lastActive)} (há ${s.idleDays} dias)` : 'nunca respondeu questões'),
    RED,
    'Todos estudaram no período.',
  );
  rank('Maior melhora', p.rankings.improving, (s) => `acerto de ${accTxt(s.accuracyBefore)} para ${accTxt(s.accuracy)} (${deltaTxt(s.delta)})`, GREEN, 'Sem dados para comparar.');
  rank('Estão piorando', p.rankings.worsening, (s) => `acerto de ${accTxt(s.accuracyBefore)} para ${accTxt(s.accuracy)} (${deltaTxt(s.delta)})`, RED, 'Ninguém piorou no período.');

  w.heading('Onde atacar: assuntos com mais listas sem passar', RED);
  if (!p.attack.length) w.text('Nenhuma lista sem passar no período.', { size: 9.5, color: MUTED });
  p.attack.forEach((a, i) => {
    w.text(`${i + 1}. ${a.title}`, { size: 10, bold: true, gap: 0 });
    w.text(`${a.discipline} · ${a.failed} listas sem passar · ${a.students} aluno(s) · acerto ${accTxt(a.accuracy)}`, { size: 8.5, color: MUTED, x: M + 12, gap: 3 });
  });

  // ficha de cada aluno
  w.newPage();
  w.text('FICHA DE CADA ALUNO', { size: 9, bold: true, color: BRAND, gap: 6 });
  for (const s of [...p.students].sort((a, b) => a.name.localeCompare(b.name))) {
    w.need(96);
    w.text(s.name, { size: 12, bold: true, gap: 0 });
    w.text([s.email, s.group && `grupo ${s.group}`, s.status === 'paused' && 'pausada'].filter(Boolean).join(' · '), { size: 8.5, color: MUTED, gap: 3 });
    w.text(
      `${s.answered} questões (antes ${s.answeredBefore}) · acerto ${accTxt(s.accuracy)} (antes ${accTxt(s.accuracyBefore)}, ${deltaTxt(s.delta)}) · ${s.activeDays} dia(s) ativo(s) · ${s.listsDone} listas (${s.listsPassed} passou, ${s.listsFailed} retido)`,
      { size: 9.5, gap: 2 },
    );
    w.text(
      `Última atividade: ${s.lastActive ? `${dmy(s.lastActive)} (há ${s.idleDays} dias)` : 'nunca'} · ${s.stages[4]}/${s.total} dominados · ${s.retainedNow} retidos agora · ${s.hard} com reforço`,
      { size: 9.5, gap: 3 },
    );
    // barra das etapas
    const total = s.total || 1;
    let x = M;
    const bw = W - 2 * M;
    w.need(14);
    s.stages.forEach((n, i) => {
      const width = (n / total) * bw;
      if (width > 0) w.page.drawRectangle({ x, y: w.y - 6, width, height: 6, color: LEVEL_COLORS[i] });
      x += width;
    });
    w.y -= 14;
    if (s.struggling.length) w.text(`Atenção: ${s.struggling.join(', ')}`, { size: 9, color: RED, gap: 2 });
    w.page.drawLine({ start: { x: M, y: w.y - 4 }, end: { x: W - M, y: w.y - 4 }, thickness: 0.5, color: rgb(0.85, 0.86, 0.88) });
    w.y -= 12;
  }
  void H;
  void clean;
  return doc.save();
}
