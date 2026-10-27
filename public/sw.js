// Service worker mínimo: permite instalar a plataforma como aplicativo.
// Não guarda páginas em cache para o aluno sempre ver o conteúdo atualizado.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
