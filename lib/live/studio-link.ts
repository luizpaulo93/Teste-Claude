/**
 * Ligação direta entre os aparelhos do estúdio (WebRTC):
 * - o aparelho que transmite manda a imagem da live (o quadro que vai para o YouTube) para os outros,
 *   que mostram exatamente a mesma cena, com a câmera de quem transmite;
 * - um canal de dados leva os comandos nos dois sentidos, na hora: cena, posição e zoom do PDF,
 *   câmera no canto, câmera e microfone de quem transmite.
 * A combinação inicial (oferta/resposta) passa pelo servidor; depois tudo vai direto entre os aparelhos.
 */
export type LinkMsg = { t: string; [k: string]: unknown };
export interface LinkSignal {
  from: string;
  kind: 'offer' | 'answer';
  sdp: string;
}

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

/** Espera juntar os caminhos de rede (sem isso a oferta vai incompleta). */
function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((r) => {
    const t = window.setTimeout(r, 2500);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(t);
        r();
      }
    });
  });
}

export class StudioLink {
  /** quem assiste: ligação com o aparelho que transmite */
  private vpc: RTCPeerConnection | null = null;
  private vdc: RTCDataChannel | null = null;
  private vTarget = '';
  private vStarted = 0;
  /** quem transmite: uma ligação por aparelho que assiste */
  private peers = new Map<string, { pc: RTCPeerConnection; dc?: RTCDataChannel }>();
  private source: MediaStream | null = null;
  /** espelho leve ou mínimo (aparelho da live sobrecarregado: a transmissão vem primeiro) */
  private level: 'normal' | 'low' = 'normal';
  /** quem só controla: junta os comandos e manda o último de cada tipo a cada 1 s (não pesa na live) */
  private pending = new Map<string, LinkMsg>();
  private flushTimer = 0;
  static VIEWER_DELAY_MS = 1000;

  /** câmera deste aparelho indo para o aparelho que transmite (quando ele pede: "câmera do celular") */
  private up: MediaStream | null = null;
  /** quem transmite: chegou (ou caiu) a câmera de outro aparelho */
  onFeed?: (device: string, s: MediaStream | null) => void;
  private feeding = new Set<string>();

  onStream?: (s: MediaStream | null) => void;
  onMessage?: (m: LinkMsg, from: string) => void;
  /** canal aberto com um aparelho (quem transmite manda o estado completo) */
  onOpen?: (device: string) => void;

  constructor(private send: (to: string, kind: 'offer' | 'answer', sdp: string) => Promise<unknown>) {}

  /** Há canal aberto com algum aparelho? */
  get connected() {
    return this.vdc?.readyState === 'open' || [...this.peers.values()].some((p) => p.dc?.readyState === 'open');
  }

  // ---------------- quem assiste
  async watch(holder: string) {
    const st = this.vpc?.connectionState;
    if (this.vTarget === holder && this.vpc) {
      if (st === 'connected') return;
      if ((st === 'new' || st === 'connecting') && Date.now() - this.vStarted < 15_000) return;
    }
    this.unwatch();
    this.vTarget = holder;
    this.vStarted = Date.now();
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.vpc = pc;
    pc.addTransceiver('video', { direction: 'recvonly' });
    // câmera deste aparelho para a live (boa qualidade: é a imagem que vai ao ar)
    const upTrack = this.up?.getVideoTracks()[0];
    if (upTrack && this.up) {
      const sender = pc.addTrack(upTrack, this.up);
      const params = sender.getParameters();
      params.encodings = [{ maxBitrate: 1_800_000, maxFramerate: 30 }];
      params.degradationPreference = 'maintain-framerate';
      void sender.setParameters(params).catch(() => {});
    }
    const dc = pc.createDataChannel('ctl');
    this.vdc = dc;
    dc.onmessage = (e) => this.read(e.data, holder);
    dc.onopen = () => this.onOpen?.(holder);
    pc.ontrack = (e) => this.onStream?.(e.streams[0] ?? new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.onStream?.(null);
    };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    if (this.vpc !== pc || !pc.localDescription) return;
    await this.send(holder, 'offer', pc.localDescription.sdp).catch(() => {});
  }

  unwatch() {
    if (!this.vpc) return;
    this.vdc?.close();
    this.vpc.close();
    this.vpc = null;
    this.vdc = null;
    this.vTarget = '';
    this.onStream?.(null);
  }

  /** Liga ou desliga o envio da câmera deste aparelho para quem transmite (refaz a ligação com a faixa nova). */
  setUpstream(stream: MediaStream | null) {
    if (stream === this.up) return;
    this.up = stream;
    const t = this.vTarget;
    if (this.vpc && t) {
      this.unwatch();
      void this.watch(t);
    }
  }
  get upstream() {
    return this.up;
  }

  // ---------------- quem transmite
  /** A imagem da live (null = este aparelho não transmite mais: fecha as ligações). */
  setSource(stream: MediaStream | null) {
    if (stream === this.source) return;
    this.source = stream;
    if (!stream) for (const d of [...this.peers.keys()]) this.drop(d);
  }

  /** Espelho: ~640 px, 15 quadros e 0,8 Mbps; no modo mínimo, 6 quadros e 0,3 Mbps. */
  private tune(sender: RTCRtpSender, device = '') {
    const w = sender.track?.getSettings().width ?? 1280;
    const params = sender.getParameters();
    const low = this.level === 'low';
    // aparelho que está servindo de câmera: ninguém olha a tela dele, o espelho vai no mínimo
    // (sobra processador e internet para a transmissão)
    const cam = this.feeding.has(device);
    params.encodings = [
      cam
        ? { maxBitrate: 120_000, maxFramerate: 2, scaleResolutionDownBy: Math.max(1, w / 320) }
        : { maxBitrate: low ? 300_000 : 800_000, maxFramerate: low ? 6 : 15, scaleResolutionDownBy: Math.max(1, w / 640) },
    ];
    params.degradationPreference = 'maintain-resolution';
    void sender.setParameters(params).catch(() => {});
  }

  /** O aparelho da live apertou (perdendo quadros): o espelho fica no mínimo para não disputar com a transmissão. */
  setLevel(level: 'normal' | 'low') {
    if (level === this.level) return;
    this.level = level;
    for (const [d, p] of this.peers) for (const sd of p.pc.getSenders()) if (sd.track) this.tune(sd, d);
  }

  private drop(device: string) {
    const p = this.peers.get(device);
    p?.dc?.close();
    p?.pc.close();
    this.peers.delete(device);
    if (this.feeding.delete(device)) this.onFeed?.(device, null);
  }

  private async serve(device: string, sdp: string) {
    const stream = this.source;
    if (!stream) return;
    this.drop(device);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    // câmera vinda do outro aparelho
    pc.ontrack = (e) => {
      this.feeding.add(device);
      for (const sd of pc.getSenders()) if (sd.track) this.tune(sd, device);
      this.onFeed?.(device, e.streams[0] ?? new MediaStream([e.track]));
    };
    const peer: { pc: RTCPeerConnection; dc?: RTCDataChannel } = { pc };
    this.peers.set(device, peer);
    const track = stream.getVideoTracks()[0];
    if (track) {
      const sender = pc.addTrack(track, stream);
      // espelho leve: não pesa no aparelho que transmite
      this.tune(sender, device);
    }
    pc.ondatachannel = (e) => {
      peer.dc = e.channel;
      e.channel.onmessage = (ev) => this.read(ev.data, device);
      e.channel.onopen = () => this.onOpen?.(device);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed')
        if (this.peers.get(device)?.pc === pc) {
          this.peers.delete(device);
          if (this.feeding.delete(device)) this.onFeed?.(device, null);
        }
    };
    await pc.setRemoteDescription({ type: 'offer', sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    if (this.peers.get(device)?.pc !== pc || !pc.localDescription) return;
    await this.send(device, 'answer', pc.localDescription.sdp).catch(() => {});
  }

  // ---------------- sinais e mensagens
  async handle(s: LinkSignal) {
    try {
      if (s.kind === 'offer') await this.serve(s.from, s.sdp);
      else if (s.from === this.vTarget && this.vpc?.signalingState === 'have-local-offer') await this.vpc.setRemoteDescription({ type: 'answer', sdp: s.sdp });
    } catch {
      /* combinação falhou: a próxima tentativa refaz */
    }
  }

  /**
   * Manda para todos os aparelhos ligados (ou só para um).
   * Quem só controla espera até 1 s e manda só o último comando de cada tipo; quem transmite manda na hora.
   */
  post(m: LinkMsg, to?: string) {
    if (this.vpc && !this.source && !to) {
      this.pending.set(m.t, m);
      if (!this.flushTimer)
        this.flushTimer = window.setTimeout(() => {
          this.flushTimer = 0;
          const all = [...this.pending.values()];
          this.pending.clear();
          for (const x of all) this.postNow(x);
        }, StudioLink.VIEWER_DELAY_MS);
      return;
    }
    this.postNow(m, to);
  }

  private postNow(m: LinkMsg, to?: string) {
    const text = JSON.stringify(m);
    if (this.vdc?.readyState === 'open' && (!to || to === this.vTarget)) this.vdc.send(text);
    for (const [d, p] of this.peers) if (p.dc?.readyState === 'open' && (!to || to === d)) p.dc.send(text);
  }

  private read(data: unknown, from: string) {
    try {
      this.onMessage?.(JSON.parse(String(data)) as LinkMsg, from);
    } catch {
      /* mensagem inválida */
    }
  }

  close() {
    this.unwatch();
    this.setSource(null);
  }
}
