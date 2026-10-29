import { redirect } from 'next/navigation';

// O calendário visual (com "Adicionar evento" e arrastar sobre os dias) serve para alunos e admin
export default function AdminCalendar() {
  redirect('/calendario');
}
