import { unzip } from 'fflate';

const MIME: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  avif: 'image/avif',
  json: 'application/json',
};

/**
 * Abre um .zip no aparelho e devolve os arquivos de dentro (de qualquer pasta), com o nome sem a pasta.
 * Ignora pastas, arquivos ocultos e a sujeira do Mac (__MACOSX). Zip dentro do zip também é aberto.
 */
export async function filesFromZip(zip: File, depth = 0): Promise<File[]> {
  const buf = new Uint8Array(await zip.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(buf, { filter: (f) => !f.name.endsWith('/') && !/(^|\/)(__MACOSX|\.)/.test(f.name) }, (err, data) => (err ? reject(err) : resolve(data))),
  );
  const out: File[] = [];
  for (const [path, data] of Object.entries(entries)) {
    const name = path.split('/').pop() ?? path;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const file = new File([data as BlobPart], name, { type: MIME[ext] ?? 'application/octet-stream' });
    // guarda a pasta de dentro do zip: imagens com o mesmo nome em provas diferentes não se misturam
    Object.defineProperty(file, 'relPath', { value: `${zip.name}/${path}` });
    if (ext === 'zip' && depth < 2) out.push(...(await filesFromZip(file, depth + 1)));
    else out.push(file);
  }
  return out;
}
