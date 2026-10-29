/** WhatsApp da coordenação (liberação de acesso). Número: (91) 98046-1223. */
export const WHATSAPP_NUMBER = '5591980461223';

export function whatsappLink(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
