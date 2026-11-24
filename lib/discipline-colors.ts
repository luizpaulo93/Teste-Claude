/**
 * Cor de cada disciplina na mentoria (matiz OKLCH). Tons suaves, distantes entre si e longe do vermelho
 * (reservado para "atrasado"). O CSS (.disc em globals.css) acerta claro e escuro a partir do matiz.
 */
export const DISCIPLINE_HUE: Record<string, number> = {
  matematica: 265, // índigo
  fisica: 55, // âmbar terroso
  quimica: 195, // petróleo
  biologia: 145, // sálvia
};
/** Revisões (semana/mês) ganham um tom próprio, neutro-violeta */
export const REVIEW_HUE = 305;

const NAME_TO_KEY: Record<string, string> = { Matemática: 'matematica', Física: 'fisica', Química: 'quimica', Biologia: 'biologia' };

/** Matiz da disciplina pela chave ("fisica") ou pelo nome ("Física"); desconhecida → cinza-azulado */
export function disciplineHue(keyOrName: string) {
  return DISCIPLINE_HUE[keyOrName] ?? DISCIPLINE_HUE[NAME_TO_KEY[keyOrName] ?? ''] ?? 240;
}

/** Estilo para um elemento com class "disc" */
export const discStyle = (keyOrName: string, review = false) => ({ '--dh': review ? REVIEW_HUE : disciplineHue(keyOrName) }) as React.CSSProperties;
