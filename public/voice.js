// Səsli söhbət: WebRTC (oyunçu ↔ oyunçu birbaşa). Server yalnız siqnal ötürür.
const ICE = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }] };

export function createVoice({ send, onChange, onSpeak }) {
  let stream = null, on = false, micOn = true, you = -1, ac = null;
  const peers = new Map();   // idx → { pc, audio, pending:[], analyser, buf }
  const localMuted = new Set();
  let localAnalyser = null, localBuf = null;

  const ctxAudio = () => { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; };
  const mkAnalyser = (st) => {
    try { const c = ctxAudio(), src = c.createMediaStreamSource(st), an = c.createAnalyser(); an.fftSize = 512; src.connect(an); return { an, buf: new Uint8Array(an.fftSize) }; }
    catch { return null; }
  };
  const level = (o) => { if (!o) return 0; o.an.getByteTimeDomainData(o.buf); let m = 0; for (const v of o.buf) m = Math.max(m, Math.abs(v - 128)); return m; };

  function closePeer(i) {
    const p = peers.get(i); if (!p) return;
    try { p.pc.close(); } catch {}
    p.audio?.remove(); peers.delete(i);
  }

  function makePeer(i) {
    const pc = new RTCPeerConnection(ICE);
    const p = { pc, audio: null, pending: [], an: null };
    peers.set(i, p);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) send({ t: 'rtc', to: i, data: { candidate: e.candidate } }); };
    pc.ontrack = (e) => {
      const st = e.streams[0]; if (!st || p.audio) return;
      const a = document.createElement('audio'); a.autoplay = true; a.playsInline = true; a.srcObject = st; a.muted = localMuted.has(i);
      a.style.display = 'none'; document.body.appendChild(a); p.audio = a; p.an = mkAnalyser(st);
      a.play?.().catch(() => {});
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { if (peers.get(i) === p) closePeer(i); } };
    return p;
  }

  async function handleSignal(from, data) {
    if (!on) return;
    let p = peers.get(from);
    try {
      if (data.sdp) {
        if (data.sdp.type === 'offer') {
          if (p) closePeer(from);
          p = makePeer(from);
          await p.pc.setRemoteDescription(data.sdp);
          for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {});
          p.pending = [];
          const ans = await p.pc.createAnswer(); await p.pc.setLocalDescription(ans);
          send({ t: 'rtc', to: from, data: { sdp: p.pc.localDescription } });
        } else if (p) {
          await p.pc.setRemoteDescription(data.sdp);
          for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {});
          p.pending = [];
        }
      } else if (data.candidate && p) {
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate).catch(() => {}); else p.pending.push(data.candidate);
      }
    } catch (e) { console.warn('voice', e); }
  }

  // Hər vəziyyət yenilənməsində: kimlə bağlantı olmalıdır?
  async function sync(S, me) {
    you = me;
    if (!on || !S) return;
    S.players.forEach(async (pl, i) => {
      if (i === you) return;
      const want = pl.voice && pl.online;
      if (!want) { closePeer(i); return; }
      if (!peers.has(i) && you < i) { // aşağı nömrəli oyunçu təklif göndərir
        const p = makePeer(i);
        try { const off = await p.pc.createOffer(); await p.pc.setLocalDescription(off); send({ t: 'rtc', to: i, data: { sdp: p.pc.localDescription } }); } catch (e) { console.warn(e); closePeer(i); }
      }
    });
  }

  async function join() {
    if (on) return true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch { return false; }
    on = true; micOn = true; localAnalyser = mkAnalyser(stream);
    send({ t: 'voice', on: true });
    onChange(); return true;
  }
  function leave() {
    if (!on) return;
    on = false; for (const i of [...peers.keys()]) closePeer(i);
    stream?.getTracks().forEach((t) => t.stop()); stream = null; localAnalyser = null;
    send({ t: 'voice', on: false }); onSpeak(new Set()); onChange();
  }
  function setMic(b) { micOn = b; stream?.getAudioTracks().forEach((t) => (t.enabled = b)); onChange(); }
  function muteUser(i, m) { if (m) localMuted.add(i); else localMuted.delete(i); const p = peers.get(i); if (p?.audio) p.audio.muted = m; onChange(); }

  // Kim danışır?
  setInterval(() => {
    if (!on) return;
    const sp = new Set();
    if (micOn && level(localAnalyser) > 9) sp.add(you);
    for (const [i, p] of peers) if (!localMuted.has(i) && level(p.an) > 9) sp.add(i);
    onSpeak(sp);
  }, 160);

  return {
    sync, join, leave, setMic, muteUser, handleSignal,
    get on() { return on; }, get micOn() { return micOn; }, isMuted: (i) => localMuted.has(i),
  };
}
