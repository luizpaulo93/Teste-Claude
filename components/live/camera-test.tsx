'use client';

import { Aperture } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui-client';

type Range = { min: number; max: number; step?: number };
type Caps = MediaTrackCapabilities & {
  exposureMode?: string[];
  exposureTime?: Range;
  exposureCompensation?: Range;
  brightness?: Range;
  contrast?: Range;
};

/**
 * Teste da câmera: a imagem pura que chega da câmera (o vídeo do próprio aparelho, sem passar pela live).
 * Se o rastro aparece aqui também, ele vem da câmera (pouca luz → exposição longa), não do app.
 * Quando a câmera e o navegador deixam, mostra os controles de exposição: exposição curta = sem rastro.
 */
export function CameraTest({ track }: { track: () => MediaStreamTrack | null }) {
  const [open, setOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [caps, setCaps] = useState<Caps>({});
  const [vals, setVals] = useState<Record<string, number | string>>({});
  const video = useRef<HTMLVideoElement>(null);
  const t = open ? track() : null;

  useEffect(() => {
    const v = video.current;
    if (!open || !t || !v) return;
    v.srcObject = new MediaStream([t]);
    void v.play().catch(() => {});
    setCaps((t.getCapabilities?.() ?? {}) as Caps);
    const st = t.getSettings() as Record<string, unknown>;
    setVals({
      exposureMode: String(st.exposureMode ?? ''),
      exposureTime: Number(st.exposureTime ?? 0),
      exposureCompensation: Number(st.exposureCompensation ?? 0),
      brightness: Number(st.brightness ?? 0),
    });
    // quadros por segundo que aparecem de verdade na tela
    const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
    let n = 0;
    let alive = true;
    const tick = () => {
      n++;
      if (alive && rvfc) rvfc.call(v, tick);
    };
    if (rvfc) rvfc.call(v, tick);
    const iv = window.setInterval(() => {
      setFps(n);
      n = 0;
    }, 1000);
    return () => {
      alive = false;
      window.clearInterval(iv);
      v.srcObject = null;
    };
  }, [open, t]);

  async function set(name: string, value: number | string) {
    if (!t) return;
    setVals((o) => ({ ...o, [name]: value }));
    const c: Record<string, unknown> = { [name]: value };
    // exposição em tempo exige o modo manual
    if (name === 'exposureTime') c.exposureMode = 'manual';
    await t.applyConstraints({ advanced: [c as MediaTrackConstraintSet] }).catch(() => {});
  }

  const slider = (name: 'exposureTime' | 'exposureCompensation' | 'brightness', label: string, hint: string) => {
    const r = caps[name] as Range | undefined;
    if (!r || r.max <= r.min) return null;
    return (
      <label className="block space-y-1">
        <span className="flex items-center justify-between text-xs font-medium text-ink-2">
          {label} <span className="num text-muted">{vals[name]}</span>
        </span>
        <input
          type="range"
          min={r.min}
          max={r.max}
          step={r.step || (r.max - r.min) / 100}
          value={Number(vals[name] ?? r.min)}
          onChange={(e) => void set(name, Number(e.target.value))}
          className="w-full accent-[var(--brand)]"
        />
        <span className="block text-[11px] text-muted">{hint}</span>
      </label>
    );
  };
  const controls = [
    slider('exposureTime', 'Tempo de exposição', 'Menor = sem rastro no movimento (precisa de mais luz).'),
    slider('exposureCompensation', 'Compensação de exposição', 'Clareia ou escurece a imagem.'),
    slider('brightness', 'Brilho', ''),
  ].filter(Boolean);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-7 px-2 text-[11px]">
        <Aperture className="size-3.5" /> Testar câmera
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Teste da câmera" size="lg">
        {t ? (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={video} muted playsInline autoPlay className="aspect-video w-full object-contain" />
              <span className="num absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white">{fps} quadros/s na tela</span>
            </div>
            <p className="text-xs text-ink-2">
              Esta é a imagem pura da câmera, sem passar pelo app. Mexa a mão na frente dela: se aparecer rastro (fantasma) aqui, ele vem da
              câmera. O mais comum é pouca luz: a câmera deixa cada quadro mais tempo exposto e o movimento borra. Mais luz no rosto (de frente)
              resolve.
            </p>
            {controls.length ? (
              <div className="space-y-3 rounded-lg border border-line p-3">
                {(caps.exposureMode ?? []).includes('continuous') && vals.exposureMode === 'manual' && (
                  <button type="button" onClick={() => void set('exposureMode', 'continuous')} className="text-xs font-medium text-brand">
                    Voltar a exposição automática
                  </button>
                )}
                {controls}
              </div>
            ) : (
              <p className="text-[11px] text-muted">Este navegador não deixa ajustar a exposição desta câmera (no iPad, o Safari não permite).</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Escolha uma câmera deste aparelho primeiro.</p>
        )}
      </Modal>
    </>
  );
}
