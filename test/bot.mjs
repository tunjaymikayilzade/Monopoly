// Lokal test üçün sadə bot: node test/bot.mjs TEST1
const room = process.argv[2] || 'TEST1';
const ws = new WebSocket(`ws://localhost:8787/ws/${room}`);
let you = -1;
ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', id: 'bot-' + room, name: 'Bot' }));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.t !== 'state') return;
  const s = m.s; you = m.you;
  const a = (x, o = {}) => setTimeout(() => ws.send(JSON.stringify({ t: 'act', a: x, ...o })), 900);
  if (s.phase !== 'play') return;
  if (s.turn !== you) return;
  if (s.step === 'roll') a('roll');
  else if (s.step === 'buy') a('buy');
  else if (s.step === 'end') a('endTurn');
  else if (s.step === 'debt') a('bankrupt');
};
