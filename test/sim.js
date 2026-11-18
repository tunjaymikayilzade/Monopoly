// Təsadüfi oyunçularla oyun məntiqinin dayanıqlıq testi
import { newGame, join, start, act } from '../public/game.js';
import { BOARD } from '../public/board.js';

let finished = 0, stuck = 0;
for (let g = 0; g < 300; g++) {
  const s = newGame('T');
  const n = 2 + (g % 5);
  for (let i = 0; i < n; i++) join(s, 'p' + i, 'P' + i);
  start(s, 0);
  let guard = 0, lastSig = '', same = 0;
  while (s.phase === 'play' && guard++ < 6000) {
    const t = s.turn, me = s.players[t];
    const owned = Object.keys(s.props).filter((k) => s.props[k].o === t).map(Number);
    const r = Math.random();
    if (s.step === 'roll') { if (me.jail && r < 0.3) act(s, t, { a: 'payJail' }); act(s, t, { a: 'roll' }); }
    else if (s.step === 'buy') act(s, t, { a: r < 0.6 ? 'buy' : 'decline' });
    else if (s.step === 'debt') {
      let done = false;
      for (const pos of owned) { if (act(s, t, { a: 'sell', pos }) == null) done = true; if (s.step !== 'debt') break; }
      for (const pos of owned) { if (s.step !== 'debt') break; act(s, t, { a: 'mortgage', pos }); }
      if (s.step === 'debt') act(s, t, { a: 'bankrupt' });
    } else if (s.step === 'end') {
      for (const pos of owned) { if (Math.random() < 0.5) act(s, t, { a: 'build', pos }); }
      act(s, t, { a: 'endTurn' });
    }
    const sig = JSON.stringify([s.step, s.turn, s.dice, s.rollSeq, s.players.map((p) => [p.pos, p.money]), s.auction]);
    if (sig === lastSig) { if (++same > 30) { console.log('DONMA', g, s.step, s.turn, JSON.stringify(s.auction), JSON.stringify(s.debt)); break; } } else { same = 0; lastSig = sig; }
    const total = s.players.reduce((a, p) => a + p.money, 0);
    if (s.players.some((p) => !Number.isFinite(p.money))) throw new Error('NaN money');
  }
  if (s.phase === 'over') finished++; else stuck++;
}
console.log({ finished, stuck });
