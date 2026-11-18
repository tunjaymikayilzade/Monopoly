import { DurableObject } from 'cloudflare:workers';
import { newGame, join, setToken, start, act } from '../public/game.js';

const ROOM_TTL_MS = 30 * 60 * 1000; // heç kim qalmasa 30 dəq sonra otaq tam silinir

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/ws/')) {
      const code = url.pathname.slice(4).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (!code) return new Response('Kod yoxdur', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket lazımdır', { status: 426 });
      const stub = env.GAME.get(env.GAME.idFromName(code));
      return stub.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // "ping" → "pong" DO-nu oyatmadan və hesablanmadan cavablanır
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get('s')) || null;
    });
  }

  async fetch(request) {
    const code = new URL(request.url).pathname.slice(4).toUpperCase();
    if (!this.s) this.s = newGame(code);
    await this.ctx.storage.deleteAlarm();
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }

  // Hər oyunçuya yalnız oyun vəziyyəti göndərilir (mətn jurnalı yoxdur)
  broadcast() {
    const s = this.s;
    const socks = this.ctx.getWebSockets();
    const online = new Set(), voice = new Set();
    for (const w of socks) { const a = w.deserializeAttachment(); if (a?.id) { online.add(a.id); if (a.voice) voice.add(a.id); } }
    const pub = { ...s, decks: undefined, players: s.players.map((p) => ({ ...p, id: undefined, online: online.has(p.id), voice: voice.has(p.id), jc: p.jc.length })) };
    for (const w of socks) {
      const a = w.deserializeAttachment();
      if (!a?.id) continue;
      const you = s.players.findIndex((p) => p.id === a.id);
      this.send(w, { t: 'state', s: pub, you, host: s.hostId === a.id });
    }
  }

  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const s = this.s;
    if (!s) return;
    if (m.t === 'hello') {
      const id = String(m.id || '').slice(0, 40);
      if (!id) return;
      ws.serializeAttachment({ id });
      join(s, id, String(m.name || '').slice(0, 16));
      await this.save();
      this.broadcast();
      return;
    }
    const a = ws.deserializeAttachment();
    if (!a?.id) return;
    const pi = s.players.findIndex((p) => p.id === a.id);
    if (pi < 0) return this.send(ws, { t: 'err', m: 'Tamaşaçısan' });
    // Səsli söhbət: yalnız siqnal ötürülür (səsin özü oyunçular arasında birbaşadır)
    if (m.t === 'voice') {
      ws.serializeAttachment({ id: a.id, voice: !!m.on });
      return this.broadcast();
    }
    if (m.t === 'rtc') {
      const target = s.players[+m.to];
      if (!target) return;
      for (const w of this.ctx.getWebSockets()) {
        if (w.deserializeAttachment()?.id === target.id) this.send(w, { t: 'rtc', from: pi, data: m.data });
      }
      return;
    }
    let err = null;
    if (m.t === 'token') err = setToken(s, pi, m.token);
    else if (m.t === 'start') err = start(s, pi);
    else if (m.t === 'act') err = act(s, pi, m);
    else return;
    // Xəta olanda yalnız göndərənə cavab ver, hamıya yayma
    if (err) return this.send(ws, { t: 'err', m: err });
    await this.save();
    this.broadcast();
  }

  async webSocketClose(ws) {
    try { ws.close(); } catch {}
    await this.afterDisconnect(ws);
  }
  async webSocketError(ws) { await this.afterDisconnect(ws); }

  async afterDisconnect(ws) {
    const left = this.ctx.getWebSockets().filter((w) => w !== ws);
    if (left.length === 0) await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    else this.broadcast();
  }

  // Heç kim qayıtmadı → otaq datası tam silinir
  async alarm() {
    if (this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
      this.s = null;
    }
  }

  async save() { await this.ctx.storage.put('s', this.s); }
}
