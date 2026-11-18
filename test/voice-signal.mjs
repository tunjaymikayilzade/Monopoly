// Siqnal ötürməsini yoxlayır: node test/voice-signal.mjs   (wrangler dev işləməlidir)
const room = 'VOICE' + Math.floor(Math.random() * 1000);
const mk = (id) => new Promise((res) => {
  const ws = new WebSocket(`ws://localhost:8787/ws/${room}`); const box = { ws, msgs: [], you: -1 };
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', id, name: id })); res(box); };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); box.msgs.push(m); if (m.t === 'state') box.you = m.you; };
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const a = await mk('A'), b = await mk('B');
await wait(400);
a.ws.send(JSON.stringify({ t: 'voice', on: true })); await wait(300);
const st = b.msgs.filter((m) => m.t === 'state').pop();
console.log('A voice flag seen by B:', st.s.players[a.you].voice === true, '| B flag:', st.s.players[b.you].voice === false);
a.ws.send(JSON.stringify({ t: 'rtc', to: b.you, data: { sdp: { type: 'offer', sdp: 'x' } } })); await wait(300);
const r = b.msgs.find((m) => m.t === 'rtc');
console.log('B got relayed signal from A:', !!r && r.from === a.you && r.data.sdp.type === 'offer');
console.log('A did not get its own signal:', !a.msgs.some((m) => m.t === 'rtc'));
process.exit(0);
