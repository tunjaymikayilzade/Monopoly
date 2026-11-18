// Oyun məntiqi (təmiz JS, server tərəfi). Hər funksiya xəta mətni qaytarır (və ya null).
import { BOARD, CHANCE, CHEST, TOKENS } from './board.js';

const START_MONEY = 1500;
const GO_SALARY = 200;
const JAIL_FINE = 50;

const rnd = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const range = (n) => [...Array(n).keys()];

export function newGame(code) {
  return {
    code, phase: 'lobby', hostId: null, players: [], props: {},
    turn: 0, step: 'roll', dice: [0, 0], rollSeq: 0, dbl: 0, pm: 0,
    buy: null, debt: null, trade: null,
    decks: { chance: shuffle(range(CHANCE.length)), chest: shuffle(range(CHEST.length)) },
    houses: 32, hotels: 12, ev: [], evSeq: 0, card: null, cardSeq: 0, winner: null,
  };
}

// Mətn jurnalı yoxdur. Yalnız səs üçün hadisə etiketi saxlanır.
const log = (s, m) => {
  const tag = m.includes('GO-dan keçdi') ? 'go' : m.includes('həbsxanaya düşdü') ? 'jail' : m.includes('iflas etdi') ? 'bankrupt' : m.includes('mübadilə etdi') ? 'trade' : null;
  if (!s.ev) s.ev = [];
  if (tag && !s.ev.includes(tag)) s.ev.push(tag);
};
const cur = (s) => s.players[s.turn];
const active = (s) => s.players.map((p, i) => (p.out ? -1 : i)).filter((i) => i >= 0);
const fmt = (n) => '₥' + n;
const groupSquares = (g) => BOARD.map((b, i) => (b.g === g ? i : -1)).filter((i) => i >= 0);
const ownsAll = (s, pi, g) => groupSquares(g).every((i) => s.props[i]?.o === pi);
const countOwned = (s, pi, g) => groupSquares(g).filter((i) => s.props[i]?.o === pi).length;

// ---------- Lobby ----------
export function join(s, id, name) {
  let i = s.players.findIndex((p) => p.id === id);
  if (i >= 0) { if (name) s.players[i].name = name.slice(0, 16); return i; }
  if (s.phase !== 'lobby') return -1;
  if (s.players.length >= TOKENS.length) return -1;
  const used = new Set(s.players.map((p) => p.token));
  const token = TOKENS.find((t) => !used.has(t.id)).id;
  s.players.push({ id, name: (name || 'Oyunçu').slice(0, 16), token, money: START_MONEY, pos: 0, jail: false, jt: 0, jc: [], out: false });
  if (!s.hostId) s.hostId = id;
  return s.players.length - 1;
}

export function setToken(s, pi, token) {
  if (s.phase !== 'lobby') return 'Oyun başlayıb';
  if (!TOKENS.some((t) => t.id === token)) return 'Yanlış fiqur';
  if (s.players.some((p, i) => i !== pi && p.token === token)) return 'Bu fiqur götürülüb';
  s.players[pi].token = token;
  return null;
}

export function start(s, pi) {
  if (s.phase !== 'lobby') return 'Oyun artıq başlayıb';
  if (s.players[pi].id !== s.hostId) return 'Yalnız host başlada bilər';
  if (s.players.length < 2) return 'Ən azı 2 oyunçu lazımdır';
  s.phase = 'play';
  s.turn = rnd(s.players.length);
  s.step = 'roll';
  log(s, 'Oyun başladı! İlk gedən: ' + cur(s).name);
  return null;
}

export function rematch(s, pi) {
  if (s.players[pi].id !== s.hostId) return 'Yalnız host';
  const fresh = newGame(s.code);
  fresh.hostId = s.hostId;
  fresh.players = s.players.map((p) => ({ id: p.id, name: p.name, token: p.token, money: START_MONEY, pos: 0, jail: false, jt: 0, jc: [], out: false }));
  Object.assign(s, fresh);
  return null;
}

// ---------- Rent / money ----------
function rentFor(s, pos, diceTotal, mult = 1) {
  const b = BOARD[pos], pr = s.props[pos];
  if (b.type === 'street') {
    if (pr.h > 0) return b.rents[pr.h];
    return b.rents[0] * (ownsAll(s, pr.o, b.g) ? 2 : 1);
  }
  if (b.type === 'rail') return (25 << (countOwned(s, pr.o, 'rail') - 1)) * (mult === 2 ? 2 : 1);
  if (b.type === 'util') {
    const m = mult === 10 ? 10 : countOwned(s, pr.o, 'util') >= 2 ? 10 : 4;
    return m * diceTotal;
  }
  return 0;
}

function pay(s, pi, amt, to, each = 0) {
  if (amt <= 0) return true;
  if (s.players[pi].money >= amt) { settle(s, pi, amt, to, each); return true; }
  s.debt = { p: pi, amount: amt, to, each };
  log(s, `${s.players[pi].name} ${fmt(amt)} ödəməlidir, amma pulu çatmır!`);
  return false;
}
function settle(s, pi, amt, to, each) {
  s.players[pi].money -= amt;
  if (each) { for (const q of active(s)) if (q !== pi) s.players[q].money += each; }
  else if (to != null) s.players[to].money += amt;
}

// ---------- Movement ----------
function movePlayer(s, pi, steps) {
  const p = s.players[pi];
  const np = (p.pos + steps + 40) % 40;
  if (steps > 0 && p.pos + steps >= 40) { p.money += GO_SALARY; log(s, `${p.name} GO-dan keçdi: +${fmt(GO_SALARY)}`); }
  p.pos = np;
}
function jumpTo(s, pi, target, collect) {
  const p = s.players[pi];
  if (collect && target < p.pos) { p.money += GO_SALARY; log(s, `${p.name} GO-dan keçdi: +${fmt(GO_SALARY)}`); }
  else if (collect && target === 0) { p.money += GO_SALARY; }
  p.pos = target;
}
function sendToJail(s, pi) {
  const p = s.players[pi];
  p.pos = 10; p.jail = true; p.jt = 0; s.dbl = 0;
  log(s, `${p.name} həbsxanaya düşdü!`);
}

function landOn(s, pi, ctx = {}) {
  const p = s.players[pi], b = BOARD[p.pos];
  switch (b.type) {
    case 'tax': log(s, `${p.name} ${b.name}: ${fmt(b.amount)}`); pay(s, pi, b.amount, null); break;
    case 'gotojail': sendToJail(s, pi); break;
    case 'chance': drawCard(s, pi, 'chance'); break;
    case 'chest': drawCard(s, pi, 'chest'); break;
    case 'street': case 'rail': case 'util': {
      const pr = s.props[p.pos];
      if (!pr) { s.buy = p.pos; break; }
      if (pr.o === pi || pr.m) break;
      const rent = rentFor(s, p.pos, s.dice[0] + s.dice[1], ctx.mult);
      log(s, `${p.name} → ${s.players[pr.o].name}: kirayə ${fmt(rent)} (${b.name})`);
      pay(s, pi, rent, pr.o);
      break;
    }
    default: break;
  }
}

function drawCard(s, pi, deck) {
  const defs = deck === 'chance' ? CHANCE : CHEST;
  const idx = s.decks[deck].shift();
  const c = defs[idx];
  const p = s.players[pi];
  s.card = { pi, deck, text: c.text }; s.cardSeq++;
  log(s, `${p.name} ${deck === 'chance' ? 'Şans' : 'Community Chest'} kartı çəkdi: ${c.text}`);
  if (c.k === 'jailcard') { p.jc.push(`${deck}:${idx}`); return; }
  s.decks[deck].push(idx);
  switch (c.k) {
    case 'gain': p.money += c.v; break;
    case 'pay': pay(s, pi, c.v, null); break;
    case 'moveTo': jumpTo(s, pi, c.v, true); landOn(s, pi); break;
    case 'moveBy': p.pos = (p.pos + c.v + 40) % 40; landOn(s, pi); break;
    case 'jail': sendToJail(s, pi); break;
    case 'repairs': {
      let h = 0, ht = 0;
      for (const [pos, pr] of Object.entries(s.props)) if (pr.o === pi) { if (pr.h === 5) ht++; else h += pr.h; }
      pay(s, pi, h * c.v[0] + ht * c.v[1], null); break;
    }
    case 'eachPay': { const n = active(s).length - 1; pay(s, pi, c.v * n, null, c.v); break; }
    case 'eachGet':
      for (const q of active(s)) if (q !== pi) { const t = Math.min(c.v, s.players[q].money); s.players[q].money -= t; p.money += t; }
      break;
    case 'nearest': {
      let t = p.pos;
      do { t = (t + 1) % 40; } while (BOARD[t].g !== c.v);
      jumpTo(s, pi, t, true);
      landOn(s, pi, { mult: c.v === 'rail' ? 2 : 10 });
      break;
    }
    default: break;
  }
}

// Növbənin gedişatını yenidən müəyyən et
function resolve(s) {
  if (s.phase !== 'play') return;
  const p = cur(s);
  if (s.debt) s.step = 'debt';
  else if (s.buy != null) s.step = 'buy';
  else if (s.dbl > 0 && !p.jail && !p.out) s.step = 'roll';
  else s.step = 'end';
}

function checkWinner(s) {
  const a = active(s);
  if (a.length === 1 && s.phase === 'play') {
    s.phase = 'over'; s.winner = a[0]; s.step = 'end';
    log(s, `🏆 ${s.players[a[0]].name} qalib gəldi!`);
  }
}

function nextTurn(s) {
  let i = s.turn;
  do { i = (i + 1) % s.players.length; } while (s.players[i].out);
  s.turn = i; s.dbl = 0; s.step = 'roll'; s.buy = null;
}

// ---------- Actions ----------
export function act(s, pi, msg) {
  const a = msg.a;
  const me = s.players[pi];
  s.ev = [];
  if (!me) return 'Oyunçu tapılmadı';
  if (s.phase !== 'play') {
    if (a === 'rematch' && s.phase === 'over') return rematch(s, pi);
    return 'Oyun getmir';
  }
  if (me.out) return 'Sən oyundan çıxmısan';
  const mine = pi === s.turn;
  let err = null;

  switch (a) {
    case 'roll': err = mine ? doRoll(s, pi) : 'Növbə səndə deyil'; break;
    case 'buy': err = mine ? doBuy(s, pi) : 'Növbə səndə deyil'; break;
    case 'decline':
      if (!mine || s.step !== 'buy') return 'İndi olmaz';
      log(s, `${me.name} ${BOARD[s.buy].name} mülkünü almadı`);
      s.buy = null; break;
    case 'endTurn':
      if (!mine || s.step !== 'end') return 'İndi növbəni bitirə bilməzsən';
      nextTurn(s); log(s, `Növbə: ${cur(s).name}`); break;
    case 'payJail':
      if (!mine || s.step !== 'roll' || !me.jail) return 'İndi olmaz';
      if (me.money < JAIL_FINE) return 'Pulun çatmır';
      me.money -= JAIL_FINE; me.jail = false; me.jt = 0; log(s, `${me.name} ${fmt(JAIL_FINE)} verib həbsdən çıxdı`); break;
    case 'jailCard':
      if (!mine || s.step !== 'roll' || !me.jail || !me.jc.length) return 'İndi olmaz';
      { const [dk, ix] = me.jc.pop().split(':'); s.decks[dk].push(+ix); }
      me.jail = false; me.jt = 0; log(s, `${me.name} kartla həbsdən çıxdı`); break;
    case 'build': err = doBuild(s, pi, +msg.pos); break;
    case 'sell': err = doSell(s, pi, +msg.pos); break;
    case 'mortgage': err = doMortgage(s, pi, +msg.pos); break;
    case 'unmortgage': err = doUnmortgage(s, pi, +msg.pos); break;
    case 'trade': err = doTrade(s, pi, msg); break;
    case 'tradeAccept': err = tradeAccept(s, pi); break;
    case 'tradeReject': err = tradeReject(s, pi); break;
    case 'bankrupt': err = doBankrupt(s, pi); break;
    default: return 'Naməlum əmr';
  }
  if (err) return err;
  afterChange(s, ['roll', 'buy', 'decline'].includes(a));
  if (s.ev.length) s.evSeq = (s.evSeq || 0) + 1;
  return null;
}

function afterChange(s, needResolve) {
  if (s.debt) {
    const d = s.debt;
    if (s.players[d.p].money >= d.amount) {
      settle(s, d.p, d.amount, d.to, d.each);
      s.debt = null; needResolve = true;
      log(s, `${s.players[d.p].name} borcunu ödədi`);
      if (s.pm) { const m = s.pm; s.pm = 0; movePlayer(s, s.turn, m); landOn(s, s.turn); }
    }
  }
  if (needResolve) resolve(s);
  checkWinner(s);
}

function doRoll(s, pi) {
  if (s.step !== 'roll') return 'İndi zər atmaq olmaz';
  const p = s.players[pi];
  const d1 = 1 + rnd(6), d2 = 1 + rnd(6);
  s.dice = [d1, d2]; s.rollSeq++;
  const dbl = d1 === d2;
  log(s, `${p.name} zər atdı: ${d1} + ${d2}${dbl ? ' (cüt!)' : ''}`);
  if (p.jail) {
    if (dbl) { p.jail = false; p.jt = 0; s.dbl = 0; log(s, `${p.name} cüt atıb həbsdən çıxdı`); }
    else {
      p.jt++;
      if (p.jt >= 3) {
        log(s, `${p.name} 3 dəfə uğursuz oldu, ${fmt(JAIL_FINE)} ödəməlidir`);
        p.jail = false; p.jt = 0; s.dbl = 0;
        if (!pay(s, pi, JAIL_FINE, null)) { s.pm = d1 + d2; return null; }
      } else { s.step = 'end'; return null; }
    }
  } else if (dbl) {
    s.dbl++;
    if (s.dbl >= 3) { log(s, `${p.name} 3 dəfə cüt atdı!`); sendToJail(s, pi); return null; }
  } else s.dbl = 0;
  movePlayer(s, pi, d1 + d2);
  landOn(s, pi);
  return null;
}

function doBuy(s, pi) {
  if (s.step !== 'buy' || s.buy == null) return 'Alınacaq mülk yoxdur';
  const p = s.players[pi], b = BOARD[s.buy];
  if (p.money < b.price) return 'Pulun çatmır';
  p.money -= b.price;
  s.props[s.buy] = { o: pi, h: 0, m: false };
  log(s, `${p.name} ${b.name} mülkünü ${fmt(b.price)}-a aldı`);
  s.buy = null;
  return null;
}

function groupHouses(s, g) { return groupSquares(g).map((i) => s.props[i].h); }

function doBuild(s, pi, pos) {
  const b = BOARD[pos], pr = s.props[pos], p = s.players[pi];
  if (!b || b.type !== 'street' || !pr || pr.o !== pi) return 'Bu mülk sənin deyil';
  if (!ownsAll(s, pi, b.g)) return 'Bütün rəng qrupu lazımdır';
  if (groupSquares(b.g).some((i) => s.props[i].m)) return 'Qrupda girovlu mülk var';
  if (pr.h >= 5) return 'Maksimum səviyyə';
  if (pr.h > Math.min(...groupHouses(s, b.g))) return 'Bərabər tikmək lazımdır';
  if (p.money < b.hc) return 'Pulun çatmır';
  if (pr.h === 4) { if (s.hotels < 1) return 'Bankda otel qalmayıb'; s.hotels--; s.houses += 4; }
  else { if (s.houses < 1) return 'Bankda ev qalmayıb'; s.houses--; }
  p.money -= b.hc; pr.h++;
  log(s, `${p.name} ${b.name} üzərində ${pr.h === 5 ? 'otel' : 'ev'} tikdi`);
  return null;
}

function doSell(s, pi, pos) {
  const b = BOARD[pos], pr = s.props[pos], p = s.players[pi];
  if (!b || b.type !== 'street' || !pr || pr.o !== pi) return 'Bu mülk sənin deyil';
  if (pr.h < 1) return 'Satılacaq bina yoxdur';
  if (pr.h < Math.max(...groupHouses(s, b.g))) return 'Bərabər satmaq lazımdır';
  if (pr.h === 5) { if (s.houses < 4) return 'Bankda 4 ev yoxdur'; s.houses -= 4; s.hotels++; }
  else s.houses++;
  pr.h--; p.money += b.hc / 2;
  log(s, `${p.name} ${b.name} üzərində bina satdı (+${fmt(b.hc / 2)})`);
  return null;
}

function doMortgage(s, pi, pos) {
  const b = BOARD[pos], pr = s.props[pos], p = s.players[pi];
  if (!b || !pr || pr.o !== pi) return 'Bu mülk sənin deyil';
  if (pr.m) return 'Artıq girovdadır';
  if (b.g && groupSquares(b.g).some((i) => s.props[i]?.h > 0)) return 'Əvvəlcə binaları sat';
  pr.m = true; p.money += b.price / 2;
  log(s, `${p.name} ${b.name} mülkünü girov qoydu (+${fmt(b.price / 2)})`);
  return null;
}

function doUnmortgage(s, pi, pos) {
  const b = BOARD[pos], pr = s.props[pos], p = s.players[pi];
  if (!b || !pr || pr.o !== pi || !pr.m) return 'Girovda deyil';
  const cost = Math.ceil((b.price / 2) * 1.1);
  if (p.money < cost) return 'Pulun çatmır';
  p.money -= cost; pr.m = false;
  log(s, `${p.name} ${b.name} girovunu açdı (-${fmt(cost)})`);
  return null;
}

// ---------- Trade ----------
const cleanOffer = (o = {}) => ({
  money: Math.max(0, Math.floor(+o.money || 0)),
  props: (o.props || []).map(Number).filter((n) => Number.isInteger(n)),
  jc: Math.max(0, Math.floor(+o.jc || 0)),
});

function offerValid(s, from, o) {
  const p = s.players[from];
  if (o.money > p.money) return 'Pul çatmır';
  if (o.jc > p.jc.length) return 'Kart çatmır';
  for (const pos of o.props) {
    const pr = s.props[pos];
    if (!pr || pr.o !== from) return 'Mülk sənin deyil';
    const g = BOARD[pos].g;
    if (g && groupSquares(g).some((i) => s.props[i]?.h > 0)) return 'Binalı qrupdan mülk verilə bilməz';
  }
  return null;
}

function doTrade(s, pi, msg) {
  if (s.trade) return 'Başqa təklif aktivdir';
  const to = +msg.to;
  if (!s.players[to] || to === pi || s.players[to].out) return 'Yanlış oyunçu';
  const give = cleanOffer(msg.give), get = cleanOffer(msg.get);
  const e = offerValid(s, pi, give) || offerValid(s, to, get);
  if (e) return e;
  if (!give.money && !give.props.length && !give.jc && !get.money && !get.props.length && !get.jc) return 'Boş təklif';
  s.trade = { from: pi, to, give, get };
  log(s, `${s.players[pi].name} → ${s.players[to].name}: mübadilə təklif etdi`);
  return null;
}

function tradeReject(s, pi) {
  if (!s.trade) return 'Təklif yoxdur';
  if (pi !== s.trade.to && pi !== s.trade.from) return 'Bu təklif sənə aid deyil';
  log(s, pi === s.trade.from ? 'Təklif geri çəkildi' : `${s.players[pi].name} təklifi rədd etdi`);
  s.trade = null;
  return null;
}

function tradeAccept(s, pi) {
  const t = s.trade;
  if (!t || t.to !== pi) return 'Təklif yoxdur';
  const e = offerValid(s, t.from, t.give) || offerValid(s, t.to, t.get);
  if (e) { s.trade = null; return 'Təklif artıq etibarsızdır: ' + e; }
  const A = s.players[t.from], B = s.players[t.to];
  A.money += t.get.money - t.give.money; B.money += t.give.money - t.get.money;
  for (const pos of t.give.props) s.props[pos].o = t.to;
  for (const pos of t.get.props) s.props[pos].o = t.from;
  for (let i = 0; i < t.give.jc; i++) B.jc.push(A.jc.pop());
  for (let i = 0; i < t.get.jc; i++) A.jc.push(B.jc.pop());
  log(s, `✅ ${A.name} və ${B.name} mübadilə etdi`);
  s.trade = null;
  return null;
}

// ---------- Bankruptcy ----------
function doBankrupt(s, pi) {
  const p = s.players[pi];
  const creditor = s.debt && s.debt.p === pi && s.debt.to != null && !s.debt.each ? s.debt.to : null;
  // binaları bankə qaytar
  for (const [pos, pr] of Object.entries(s.props)) {
    if (pr.o !== pi) continue;
    if (pr.h === 5) { s.hotels++; } else s.houses += pr.h;
    pr.h = 0;
  }
  for (const pos of Object.keys(s.props)) {
    if (s.props[pos].o !== pi) continue;
    if (creditor != null) s.props[pos].o = creditor; else delete s.props[pos];
  }
  if (creditor != null) { s.players[creditor].money += p.money; s.players[creditor].jc.push(...p.jc); }
  else for (const d of p.jc) { const [dk, ix] = d.split(':'); s.decks[dk].push(+ix); }
  p.money = 0; p.jc = []; p.out = true;
  if (s.trade && (s.trade.from === pi || s.trade.to === pi)) s.trade = null;
  log(s, `💥 ${p.name} iflas etdi!`);
  if (s.debt && s.debt.p === pi) s.debt = null;
  s.pm = 0;
  if (pi === s.turn) { s.buy = null; if (s.phase === 'play' && active(s).length > 1) { nextTurn(s); log(s, `Növbə: ${cur(s).name}`); } }
  return null;
}
