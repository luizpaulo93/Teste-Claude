import type { Viewer } from './session';
import type { AuthorInfo } from './types';

/** Nome/foto/papel copiados em cada mensagem (evita buscar o perfil de cada autor ao listar). */
export function authorOf(viewer: Viewer): AuthorInfo {
  return {
    author_name: viewer.profile.full_name || viewer.email.split('@')[0],
    author_avatar: viewer.profile.avatar_url || '',
    author_role: viewer.profile.role,
  };
}
