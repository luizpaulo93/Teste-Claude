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

  // ---------------- quem transmite
  /** A imagem da live (null = este aparelho não transmite mais: fecha as ligações). */
  setSource(stream: MediaStream | null) {
    if (stream === this.source) return;
    this.source = stream;
    if (!stream) for (const d of [...this.peers.keys()]) this.drop(d);
  }

  private drop(device: string) {
    const p = this.peers.get(device);
    p?.dc?.close();
    p?.pc.close();
    this.peers.delete(device);
  }

  private async serve(device: string, sdp: string) {
    const stream = this.source;
    if (!stream) return;
    this.drop(device);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer: { pc: RTCPeerConnection; dc?: RTCDataChannel } = { pc };
    this.peers.set(device, peer);
    const track = stream.getVideoTracks()[0];
    if (track) {
      const sender = pc.addTrack(track, stream);
      // espelho leve: não pesa no aparelho que transmite
      const params = sender.getParameters();
      params.encodings = [{ maxBitrate: 1_200_000, maxFramerate: 24, scaleResolutionDownBy: track.getSettings().width && track.getSettings().width! > 1280 ? 2 : 1.34 }];
      void sender.setParameters(params).catch(() => {});
    }
    pc.ondatachannel = (e) => {
      peer.dc = e.channel;
      e.channel.onmessage = (ev) => this.read(ev.data, device);
      e.channel.onopen = () => this.onOpen?.(device);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') if (this.peers.get(device)?.pc === pc) this.peers.delete(device);
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

  /** Manda para todos os aparelhos ligados (ou só para um). */
  post(m: LinkMsg, to?: string) {
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
