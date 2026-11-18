import { BOARD, GROUP_COLORS, TOKENS } from './board.js';
import { createScene } from './scene3d.js';
import { sfx, unlock, isMuted, setMuted } from './sound.js';
import { createVoice } from './voice.js';
import { newGame, join as gJoin, setToken as gSetToken, start as gStart, act as gAct } from './game.js';

// ---------- Bir cihazda oyun (server lazım deyil) ----------
let localMode = false, localS = null, setup = null;
const LOCAL_KEY = 'mono_local';
const saveLocal = () => { try { if (localS && localS.phase === 'play') localStorage.setItem(LOCAL_KEY, JSON.stringify(localS)); else localStorage.removeItem(LOCAL_KEY); } catch {} };
const loadLocal = () => { try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY)); return v && v.phase === 'play' ? v : null; } catch { return null; } };

function localEmit() {
  const s = localS, prev = S;
  S = JSON.parse(JSON.stringify({ ...s, decks: undefined, players: s.players.map((p) => ({ ...p, id: undefined, online: true, voice: false, jc: p.jc.length })) }));
  you = s.phase === 'play' || s.phase === 'over' ? s.turn : 0; isHost = true;
  saveLocal();
  onState(prev);
}
function localSend(o) {
  const s = localS;
  if (o.t !== 'act') return;
  let pi = s.turn;
  if (o.a === 'tradeAccept' || o.a === 'tradeReject') pi = s.trade ? s.trade.to : s.turn;
  if (o.a === 'rematch') pi = 0;
  const err = gAct(s, pi, o);
  if (err) { toast(err); sfx.error(); return; }
  localEmit();
}
function startLocal(list) {
  localMode = true; localS = newGame('LOCAL');
  list.forEach((p, i) => { gJoin(localS, 'local' + i, p.name || 'Oyunçu ' + (i + 1)); gSetToken(localS, i, p.token); });
  gStart(localS, 0); localEmit();
}
function resumeLocal() { localMode = true; localS = loadLocal(); localEmit(); }

function renderLocalSetup() {
  const used = new Set(setup.map((p) => p.token));
  $('#lobby').innerHTML = `<div class="lobcard">
    <div class="logo">MONOPOLY</div>
    <p class="sub">Bir cihazda növbə ilə oyna (2–8 nəfər)</p>
    <div class="plist">${setup.map((p, i) => { const t = tokOf(p.token); return `<div class="pl"><button class="tk" style="border-color:${t.color}" title="Fiquru dəyiş" onclick="localTok(${i})">${t.icon}</button><input class="lname" maxlength="16" value="${esc(p.name)}" oninput="setup[${i}].name=this.value" placeholder="Oyunçu ${i + 1}">${setup.length > 2 ? `<button class="x" onclick="localDel(${i})">✕</button>` : ''}</div>`; }).join('')}</div>
    <div class="share" style="gap:8px"><button class="btn" onclick="localAdd()" ${setup.length >= TOKENS.length ? 'disabled' : ''}>＋ Oyunçu əlavə et</button></div>
    <button class="btn primary big" onclick="localGo()">Oyunu başlat</button>
    <button class="btn big" style="margin-top:10px" onclick="location.reload()">← Geri</button></div>`;
}
window.setup = null;
window.localTok = (i) => { const used = new Set(setup.map((p) => p.token)); const idx = TOKENS.findIndex((t) => t.id === setup[i].token); for (let k = 1; k <= TOKENS.length; k++) { const t = TOKENS[(idx + k) % TOKENS.length]; if (!used.has(t.id)) { setup[i].token = t.id; break; } } renderLocalSetup(); };
window.localAdd = () => { const used = new Set(setup.map((p) => p.token)); const t = TOKENS.find((x) => !used.has(x.id)); if (t) setup.push({ name: '', token: t.id }); renderLocalSetup(); };
window.localDel = (i) => { setup.splice(i, 1); renderLocalSetup(); };
window.localGo = () => { setup.forEach((p, i) => { if (!p.name.trim()) p.name = 'Oyunçu ' + (i + 1); }); startLocal(setup); };
window.exitLocal = () => { if (confirm('Menyuya qayıtmaq istəyirsən? Oyun saxlanılır, sonra davam edə bilərsən.')) location.reload(); };
window.localNewAfter = () => { try { localStorage.removeItem(LOCAL_KEY); } catch {} location.reload(); };

// ---------- Səsli söhbət ----------
let speaking = new Set();
const voice = createVoice({
  send: (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
  onChange: () => { if (!S) return; if (S.phase === 'lobby') renderLobby(); else { renderSide(); if (modal) renderModal(); } },
  onSpeak: (set) => {
    const same = set.size === speaking.size && [...set].every((i) => speaking.has(i));
    speaking = set; if (!same) applySpeaking();
  },
});
function applySpeaking() {
  document.querySelectorAll('.pcard[data-i]').forEach((el) => el.classList.toggle('speak', speaking.has(+el.dataset.i)));
  document.querySelectorAll('.pl[data-i]').forEach((el) => el.classList.toggle('speak', speaking.has(+el.dataset.i)));
}
window.toggleVoice = async () => {
  if (voice.on) { voice.leave(); return; }
  const ok = await voice.join();
  if (!ok) toast('Mikrofona icazə verilmədi');
  else { toast('Səsli söhbətə qoşuldun'); $('#toast').lastChild.style.background = '#2fa14a'; if (S) voice.sync(S, you); }
};
window.toggleMic = () => voice.setMic(!voice.micOn);
window.muteUser = (i) => voice.muteUser(i, !voice.isMuted(i));
const voiceBtns = () => voice.on
  ? `<button class="rbtn" onclick="toggleMic()">${voice.micOn ? '🎙️' : '🔇'}<small>${voice.micOn ? 'Mikrofon' : 'Səssiz'}</small></button>
     <button class="rbtn" onclick="toggleVoice()">📴<small>Söhbətdən çıx</small></button>`
  : `<button class="rbtn" onclick="toggleVoice()">🎤<small>Səsli söhbət</small></button>`;

// Brauzer səs üçün ilk toxunuşu gözləyir; düymələrə də kiçik klik səsi
document.addEventListener('pointerdown', (e) => { unlock(); if (e.target.closest('.btn, .rbtn, .pcard, .x')) sfx.click(); });

const $ = (q) => document.querySelector(q);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => '₥' + n;
const tokOf = (id) => TOKENS.find((t) => t.id === id) || TOKENS[0];

let S = null, you = -1, isHost = false, ws = null, code = '', myName = '';
let modal = null; // { type, arg }
const myId = (() => {
  try { let v = localStorage.getItem('mono_id'); if (!v) { v = crypto.randomUUID(); localStorage.setItem('mono_id', v); } return v; }
  catch { return 'id' + Math.random().toString(36).slice(2); }
})();

// ---------- Home ----------
$('#nameIn').value = (() => { try { return localStorage.getItem('mono_name') || ''; } catch { return ''; } })();
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) $('#codeIn').value = urlRoom.toUpperCase();

function goRoom(c) {
  const name = $('#nameIn').value.trim();
  if (!name) { $('#homeErr').textContent = 'Adını yaz'; return; }
  myName = name;
  try { localStorage.setItem('mono_name', name); } catch {}
  code = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) { $('#homeErr').textContent = 'Otaq kodunu yaz'; return; }
  history.replaceState(null, '', '?room=' + code);
  connect();
}
$('#createBtn').onclick = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  goRoom(Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''));
};
$('#joinBtn').onclick = () => goRoom($('#codeIn').value);
$('#localBtn').onclick = () => { setup = window.setup = [{ name: '', token: 'cat' }, { name: '', token: 'hat' }]; showScreen('lobby'); renderLocalSetup(); };
if (loadLocal()) { $('#localResume').classList.remove('hidden'); $('#localResume').onclick = resumeLocal; }

// ---------- Network ----------
let pingTimer = null;
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
  ws.onopen = () => {
    $('#conn').classList.add('hidden'); send({ t: 'hello', id: myId, name: myName });
    if (voice.on) send({ t: 'voice', on: true }); // yenidən qoşulanda səsli statusu bərpa et
    // "ping" mətni Cloudflare tərəfindən DO-nu oyatmadan cavablanır (limitə təsir etmir)
    clearInterval(pingTimer); pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 40000);
  };
  ws.onmessage = (e) => {
    if (e.data === 'pong') return;
    const m = JSON.parse(e.data);
    if (m.t === 'state') { const prev = S; S = m.s; you = m.you; isHost = m.host; onState(prev); voice.sync(S, you); }
    else if (m.t === 'rtc') voice.handleSignal(m.from, m.data);
    else if (m.t === 'err') { toast(m.m); sfx.error(); }
  };
  ws.onclose = () => { $('#conn').classList.remove('hidden'); setTimeout(connect, 1500); };
}
const send = (o) => { if (localMode) return localSend(o); if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const act = (a, extra = {}) => send({ t: 'act', a, ...extra });
window.act = act;
let topDown = false;
window.toggleView = () => { topDown = !topDown; topDown ? scene.topView() : scene.resetView(); };
window.toggleMute = () => { setMuted(!isMuted()); if (S) renderSide(); };

function toast(m) {
  const d = document.createElement('div'); d.textContent = m; $('#toast').appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

// ---------- State handling ----------
let lastRoll = null, lastCard = null, scene = null;
let lastEv = null;

// Fiqurlar yeriyib bitənə qədər gözlə, sonra səs/kart göstər
function afterWalk(fn, tries = 60) {
  if (!scene || !scene.busy || tries <= 0) return fn();
  setTimeout(() => afterWalk(fn, tries - 1), 100);
}

function onState(prev) {
  if (S.phase === 'lobby') { showScreen('lobby'); renderLobby(); return; }
  showScreen('game');
  if (!scene) scene = createScene($('#stage'), { onTile: (i) => openModal('prop', i), sfx });
  scene.sync(S);
  if (lastRoll === null) { lastRoll = S.rollSeq; if (S.dice[0]) scene.setDice(S.dice); }
  else if (S.rollSeq !== lastRoll) { lastRoll = S.rollSeq; scene.rollDice(S.dice); sfx.diceRoll(); setTimeout(sfx.diceLand, 780); }
  const card = S.card, cs = S.cardSeq;
  if (lastCard === null) lastCard = cs;
  else if (cs !== lastCard) { lastCard = cs; afterWalk(() => { sfx.card(); showCard(card); }); }
  const evNew = lastEv !== null && S.evSeq !== lastEv;
  lastEv = S.evSeq;
  if (prev && prev.phase !== 'lobby') playSounds(prev, evNew ? S.ev : []);
  renderGame();
}

function playSounds(prev, ev) {
  if (ev.includes('go')) afterWalk(sfx.go);
  if (ev.includes('jail')) afterWalk(sfx.jail);
  if (ev.includes('bankrupt')) afterWalk(sfx.bankrupt);
  if (ev.includes('trade')) sfx.tradeDone();
  let bought = false, built = false, sold = false;
  for (const k of Object.keys(S.props)) {
    const a = prev.props[k], b = S.props[k];
    if (!a) bought = true; else if (b.h > a.h) built = true; else if (b.h < a.h) sold = true;
  }
  if (bought) sfx.buy(); else if (built) sfx.build(); else if (sold) sfx.sell();
  const pm = prev.players[you]?.money, nm = S.players[you]?.money;
  if (!bought && !built && !sold && pm != null && nm != null && pm !== nm && !ev.includes('go') && !ev.includes('trade')) {
    afterWalk(nm > pm ? sfx.cashIn : sfx.cashOut);
  }
  if (S.phase === 'play' && S.turn === you && prev.turn !== you) sfx.yourTurn();
  if (S.trade && S.trade.to === you && !prev.trade) sfx.trade();
  if (S.phase === 'over' && prev.phase !== 'over') sfx.win();
}

function showScreen(n) {
  for (const id of ['home', 'lobby', 'game']) $('#' + id).classList.toggle('hidden', id !== n);
}

function showCard(c) {
  const el = $('#cardpop');
  el.className = c.deck;
  el.innerHTML = `<small>${c.deck === 'chance' ? 'Şans' : 'Community Chest'} · ${esc(S.players[c.pi].name)}</small>${esc(c.text)}`;
  clearTimeout(showCard.t);
  showCard.t = setTimeout(() => el.classList.add('hidden'), 4200);
}

// ---------- Lobby ----------
function renderLobby() {
  const link = `${location.origin}/?room=${S.code}`;
  const me = S.players[you];
  $('#lobby').innerHTML = `
  <div class="lobcard">
    <div class="logo">MONOPOLY</div>
    <div class="code">${S.code}</div>
    <div class="share"><input readonly value="${link}" id="lnk"><button class="btn" id="cp">Kopyala</button></div>
    <div class="plist">${S.players.map((p) => { const t = tokOf(p.token); return `<div class="pl" data-i="${S.players.indexOf(p)}"><span class="tk" style="border-color:${t.color}">${t.icon}</span>${esc(p.name)}<small>${p.voice ? '🎙️ ' : ''}${p.online ? '🟢' : '⚪'} ${t.name}</small></div>`; }).join('')}</div>
    ${me ? `<div class="share" style="gap:8px">${voice.on ? `<button class="btn" onclick="toggleMic()">${voice.micOn ? '🎙️ Mikrofon açıq' : '🔇 Mikrofon bağlı'}</button><button class="btn" onclick="toggleVoice()">📴 Söhbətdən çıx</button>` : '<button class="btn" onclick="toggleVoice()">🎤 Səsli söhbətə qoşul</button>'}</div>` : ''}
    ${me ? `<b>Fiqurunu seç</b><div class="tokpick">${TOKENS.map((t) => `<button data-t="${t.id}" title="${t.name}" class="${me.token === t.id ? 'sel' : ''}" ${S.players.some((p, i) => i !== you && p.token === t.id) ? 'disabled' : ''}>${t.icon}</button>`).join('')}</div>` : '<p>Oyun artıq başlayıb.</p>'}
    ${isHost ? `<button class="btn primary big" id="startBtn" ${S.players.length < 2 ? 'disabled' : ''}>Oyunu başlat (${S.players.length} oyunçu)</button>` : '<p style="text-align:center;color:#667">Hostun oyunu başlatmasını gözləyirik…</p>'}
  </div>`;
  $('#cp').onclick = () => { navigator.clipboard?.writeText(link); toast('Link kopyalandı'); $('#toast').lastChild.style.background = '#2fa14a'; };
  document.querySelectorAll('.tokpick button').forEach((b) => (b.onclick = () => send({ t: 'token', token: b.dataset.t })));
  const sb = $('#startBtn'); if (sb) sb.onclick = () => send({ t: 'start' });
}

// ---------- Game render ----------
function renderGame() {
  renderCenter(); renderSide(); renderAuto();
  if (modal) renderModal();
}

function renderCenter() {
  const cp = S.players[S.turn], mine = S.turn === you;
  const st = $('#status'), acts = $('#acts'), cb = $('#cardbox');
  let status = '', a = '', card = '';
  if (S.phase === 'over') status = `🏆 ${esc(S.players[S.winner].name)} qalib!`;
  else if (S.step === 'roll') {
    if (mine) {
      if (cp.jail) {
        status = `Həbsdəsən (${cp.jt}/3 cəhd)`;
        a = `<button class="btn primary rollbtn" onclick="act('roll')">🎲 Zər at</button><button class="btn" onclick="act('payJail')" ${cp.money < 50 ? 'disabled' : ''}>${money(50)} ver</button>${cp.jc ? `<button class="btn" onclick="act('jailCard')">🎫 Kart</button>` : ''}`;
      } else { status = localMode ? `${esc(cp.name)} — ${S.dbl ? 'cüt! yenə at' : 'növbə səndədir'}` : S.dbl ? 'Cüt atdın! Yenə at' : 'Sənin növbəndir'; a = `<button class="btn primary rollbtn" onclick="act('roll')">🎲 Zər at</button>`; }
    } else status = `${esc(cp.name)} zər atmağa hazırlaşır…`;
  } else if (S.step === 'buy') {
    const b = BOARD[S.buy];
    if (mine) {
      status = `${esc(b.name)} — almaq istəyirsən?`;
      card = miniCard(S.buy);
      a = `<button class="btn green" onclick="act('buy')" ${cp.money < b.price ? 'disabled' : ''}>Al ${money(b.price)}</button><button class="btn dark" onclick="act('decline')">Almıram</button>`;
    } else { status = `${esc(cp.name)} ${esc(b.name)} haqqında qərar verir…`; card = miniCard(S.buy); }
  }
  else if (S.step === 'debt') {
    if (mine) { status = `Borcun ${money(S.debt.amount)}! Mülk sat / girov qoy`; a = `<button class="btn" onclick="openModal('manage')">🏠 Mülklərim</button><button class="btn primary" onclick="if(confirm('İflas etmək istəyirsən?'))act('bankrupt')">💥 İflas</button>`; }
    else status = `${esc(cp.name)} borc ödəməyə çalışır…`;
  } else if (S.step === 'end') {
    if (mine) { status = 'Növbəni bitir və ya mülklərini idarə et'; a = `<button class="btn primary rollbtn" onclick="act('endTurn')">Növbəni bitir ➜</button>`; }
    else status = `${esc(cp.name)} növbəsini tamamlayır…`;
  }
  st.innerHTML = status; acts.innerHTML = a; cb.innerHTML = card;
}

function miniCard(i) {
  const b = BOARD[i];
  const color = GROUP_COLORS[b.g] || '#ddd';
  return `<div class="minicard"><div class="hd" style="background:${color};color:${['yellow', 'lblue'].includes(b.g) ? '#111' : '#fff'}">${esc(b.name)}</div><div class="bd"><b>${money(b.price)}</b>${b.rents ? ` · kirayə ${money(b.rents[0])}` : ''}</div></div>`;
}

function renderSide() {
  const left = $('#left');
  const hasTrade = S.trade && S.trade.to === you;
  left.innerHTML = `
    <button class="rbtn ${hasTrade ? 'alert' : ''}" onclick="openModal('trade')">🤝<small>Mübadilə</small></button>
    <button class="rbtn" onclick="openModal('manage')">🏠<small>Mülklər</small></button>
    <button class="rbtn" onclick="toggleView()">🎥<small>Kamera</small></button>
    <button class="rbtn" onclick="toggleMute()">${isMuted() ? '🔇' : '🔊'}<small>Effekt</small></button>
    ${localMode ? '<button class="rbtn" onclick="exitLocal()">🚪<small>Menyu</small></button>' : you >= 0 ? voiceBtns() : ''}`;
  $('#right').innerHTML = S.players.map((p, i) => {
    const t = tokOf(p.token);
    const owned = Object.entries(S.props).filter(([, pr]) => pr.o === i).sort((a, b) => a[0] - b[0]);
    return `<div class="pcard ${S.turn === i && S.phase === 'play' ? 'turn' : ''} ${p.out ? 'out' : ''}" data-i="${i}" style="--c:${t.color}" onclick="openModal('player',${i})">
      <div class="tk">${t.icon}</div>
      <div class="nm2">${esc(p.name)}${i === you ? ' <span class="tag">sən</span>' : ''}${!p.online ? ' <span class="tag">oflayn</span>' : ''}${p.jail ? ' <span class="tag">🚔</span>' : ''}${p.jc ? ` <span class="tag">🎫${p.jc}</span>` : ''}${p.voice ? ` <span class="tag">${i === you && !voice.micOn ? '🔇' : voice.isMuted(i) ? '🔈✖' : '🎙️'}</span>` : ''}</div>
      <div class="mn">${p.out ? 'İflas' : money(p.money)}</div>
      <div class="dots">${owned.map(([pos, pr]) => `<i class="${pr.m ? 'm' : ''}" style="background:${GROUP_COLORS[BOARD[pos].g]}"></i>`).join('')}</div>
    </div>`;
  }).join('');
  applySpeaking();
}


// ---------- Auto overlays (təklif, qalib) ----------
function renderAuto() {
  const el = $('#auto');
  let html = '';
  if (S.phase === 'over') {
    html = `<div class="mbox win"><div class="big">🏆</div><h1>${esc(S.players[S.winner].name)} qalib gəldi!</h1>${isHost ? '<button class="btn primary big" onclick="act(\'rematch\')">Yenidən oyna</button>' : '<p>Hostun yenidən başlatmasını gözlə</p>'}</div>`;
  } else if (S.trade && (localMode || S.trade.to === you || S.trade.from === you)) {
    const t = S.trade, A = S.players[t.from], B = S.players[t.to];
    const tv = localMode ? t.to : you; // bir cihazda: cavab verən təklif alan oyunçudur
    const side = (o) => [o.money ? money(o.money) : '', ...o.props.map((p) => BOARD[p].name), o.jc ? `🎫×${o.jc}` : ''].filter(Boolean).join(', ') || '—';
    html = `<div class="mbox"><h2>🤝 Mübadilə təklifi</h2>
      <p><b>${esc(A.name)}</b> verir:<br>${esc(side(t.give))}</p>
      <p><b>${esc(B.name)}</b> verir:<br>${esc(side(t.get))}</p>${localMode ? `<p style="text-align:center"><b>${esc(B.name)}</b>, cihazı götür və cavab ver.</p>` : ''}
      <div class="acts" style="display:flex;gap:8px">${t.to === tv ? '<button class="btn green" onclick="act(\'tradeAccept\')">Qəbul et</button><button class="btn primary" onclick="act(\'tradeReject\')">Rədd et</button>' : '<span>Cavab gözlənilir…</span><button class="btn" onclick="act(\'tradeReject\')">Geri çək</button>'}</div></div>`;
  }
  el.innerHTML = html;
  el.classList.toggle('hidden', !html);
}

// ---------- Modals ----------
function openModal(type, arg) { modal = { type, arg }; renderModal(true); $('#modal').classList.remove('hidden'); }
function closeModal() { modal = null; $('#modal').classList.add('hidden'); }
window.openModal = openModal; window.closeModal = closeModal;

function deed(i) {
  const b = BOARD[i], color = GROUP_COLORS[b.g] || '#ddd';
  const dark = !['yellow', 'lblue', 'util'].includes(b.g);
  let body = '';
  if (b.type === 'street') {
    body = `<div><span>Kirayə</span><b>${money(b.rents[0])}</b></div>` + b.rents.slice(1, 5).map((r, k) => `<div><span>${k + 1} ev</span><b>${money(r)}</b></div>`).join('') + `<div><span>Otel</span><b>${money(b.rents[5])}</b></div><hr><div><span>Ev qiyməti</span><b>${money(b.hc)}</b></div>`;
  } else if (b.type === 'rail') body = '<div><span>1 dəmiryolu</span><b>₥25</b></div><div><span>2</span><b>₥50</b></div><div><span>3</span><b>₥100</b></div><div><span>4</span><b>₥200</b></div>';
  else if (b.type === 'util') body = '<div>1 şirkət: zər × 4</div><div>2 şirkət: zər × 10</div>';
  else body = `<div>${esc(b.name)}</div>`;
  const pr = S.props[i];
  return `<div class="deed"><div class="hd" style="background:${color};color:${dark ? '#fff' : '#111'}">${esc(b.name)}</div><div class="bd">${body}${b.price ? `<hr><div><span>Qiymət</span><b>${money(b.price)}</b></div><div><span>Girov</span><b>${money(b.price / 2)}</b></div>` : ''}${pr ? `<hr><div><span>Sahib</span><b>${esc(S.players[pr.o].name)}${pr.m ? ' (girov)' : ''}</b></div>` : ''}</div></div>`;
}

function renderModal(fresh) {
  if (!modal) return;
  const el = $('#modal');
  const head = (t) => `<h2>${t}<button class="x" onclick="closeModal()">✕</button></h2>`;
  if (modal.type === 'prop') {
    el.innerHTML = `<div class="mbox" style="width:min(340px,100%)">${head(esc(BOARD[modal.arg].name))}${deed(modal.arg)}</div>`;
  } else if (modal.type === 'player') {
    const p = S.players[modal.arg];
    el.innerHTML = `<div class="mbox">${head(`${tokOf(p.token).icon} ${esc(p.name)} — ${money(p.money)}`)}${propRows(modal.arg, false)}${modal.arg !== you && !p.out && you >= 0 ? `<button class="btn dark" onclick="openModal('trade',${modal.arg})">🤝 Mübadilə təklif et</button>` : ''}${modal.arg !== you && p.voice && voice.on ? ` <button class="btn" onclick="muteUser(${modal.arg})">${voice.isMuted(modal.arg) ? '🔊 Səsini aç' : '🔈 Səsini bağla'}</button>` : ''}</div>`;
  } else if (modal.type === 'manage') {
    el.innerHTML = `<div class="mbox">${head('🏠 Mülklərim — ' + money(S.players[you].money))}${propRows(you, true)}${S.phase === 'play' && !S.players[you].out ? `<hr><button class="btn primary sm" onclick="if(confirm('Həqiqətən iflas etmək istəyirsən?')){act('bankrupt');closeModal()}">💥 Təslim ol</button>` : ''}</div>`;
  } else if (modal.type === 'trade') {
    if (fresh) renderTrade(el, modal.arg);
  }
  el.classList.remove('hidden');
}

function propRows(pi, manage) {
  const owned = Object.entries(S.props).filter(([, pr]) => pr.o === pi).map(([k, pr]) => [+k, pr]).sort((a, b) => a[0] - b[0]);
  if (!owned.length) return '<p style="color:#778">Mülk yoxdur.</p>';
  return owned.map(([pos, pr]) => {
    const b = BOARD[pos];
    const lvl = b.type === 'street' ? (pr.h === 5 ? ' · 🏨 otel' : pr.h ? ' · ' + '🏠'.repeat(pr.h) : '') : '';
    return `<div class="mrow"><span class="dot" style="background:${GROUP_COLORS[b.g]}"></span><span class="nmx">${esc(b.name)}<br><small>${pr.m ? 'GİROV' : money(b.price)}${lvl}</small></span>
      ${manage ? `${b.type === 'street' ? `<button class="btn sm" onclick="act('build',{pos:${pos}})" title="Tik">➕${money(b.hc)}</button><button class="btn sm" onclick="act('sell',{pos:${pos}})" title="Sat">➖</button>` : ''}
      <button class="btn sm dark" onclick="act('${pr.m ? 'unmortgage' : 'mortgage'}',{pos:${pos}})">${pr.m ? 'Girovu aç' : 'Girov'}</button>` : `<button class="btn sm" onclick="openModal('prop',${pos})">Bax</button>`}</div>`;
  }).join('');
}

function renderTrade(el, target) {
  if (you < 0 || S.players[you].out) return;
  const others = S.players.map((p, i) => i).filter((i) => i !== you && !S.players[i].out);
  if (!others.length) return;
  if (target === undefined || !others.includes(target)) target = others[0];
  modal.arg = target;
  const side = (pi, pre) => {
    const p = S.players[pi];
    const owned = Object.entries(S.props).filter(([, pr]) => pr.o === pi).map(([k]) => +k).sort((a, b) => a - b);
    return `<div><h3>${pre === 'give' ? 'Sən verirsən' : 'Sən alırsan'}</h3>
      <label>Pul (maks ${money(p.money)})<input type="number" min="0" max="${p.money}" value="0" id="${pre}M"></label>
      ${p.jc ? `<label>Həbs kartı (maks ${p.jc})<input type="number" min="0" max="${p.jc}" value="0" id="${pre}J"></label>` : ''}
      ${owned.map((pos) => { const g = BOARD[pos].g; const blocked = g && Object.entries(S.props).some(([k, q]) => BOARD[k].g === g && q.h > 0); return `<label class="chk"><input type="checkbox" class="${pre}" value="${pos}" ${blocked ? 'disabled' : ''}><span class="dot" style="background:${GROUP_COLORS[g]};width:12px;height:12px;display:inline-block;border-radius:3px"></span>${esc(BOARD[pos].name)}${S.props[pos].m ? ' (girov)' : ''}</label>`; }).join('') || '<small>Mülk yoxdur</small>'}
    </div>`;
  };
  el.innerHTML = `<div class="mbox"><h2>🤝 Mübadilə<button class="x" onclick="closeModal()">✕</button></h2>
    <label>Kimlə<select id="trTo">${others.map((i) => `<option value="${i}" ${i === target ? 'selected' : ''}>${esc(S.players[i].name)}</option>`).join('')}</select></label>
    <div class="two">${side(you, 'give')}${side(target, 'get')}</div>
    <div style="margin-top:14px"><button class="btn primary big" id="trSend">Təklif göndər</button></div></div>`;
  $('#trTo').onchange = (e) => renderTrade(el, +e.target.value);
  const read = (pre) => ({
    money: +($('#' + pre + 'M')?.value || 0), jc: +($('#' + pre + 'J')?.value || 0),
    props: [...document.querySelectorAll('input.' + pre + ':checked')].map((c) => +c.value),
  });
  $('#trSend').onclick = () => { act('trade', { to: +$('#trTo').value, give: read('give'), get: read('get') }); closeModal(); };
}
