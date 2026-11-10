// 하뀨하의 우당탕탕 빼빼로 공장 — 메인 로직
import { CONFIG } from './config.js';
import * as api from './api.js';
import { setAssetOverrides, charRig, peperoEl, cheerPose, CHEER_POINT, SCENE_ASPECT } from './assets.js';
import { sound } from './sound.js';
import { charEl } from './assets.js';
import { makeResultPng } from './card.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CH = CONFIG.CHARACTERS;
const peperoById = (id) => CONFIG.PEPEROS.find((p) => p.id === id) || CONFIG.PEPEROS[0];

const state = {
  settings: null,
  texts: { ...CONFIG.TEXTS },
  xLink: CONFIG.X_LINK,
  pepero: null,     // 선택한 빼빼로 id
  result: null,     // { status:'win'|'lose'|'closed', pepero, win_code, existing, demo, reason }
  busy: false,
  replay: false,
  tsToken: null,
};
const T = (k) => state.texts[k] ?? CONFIG.TEXTS[k] ?? '';

// ---------------- 공통 UI ----------------
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  window.scrollTo(0, 0);
  if (name === 'packed') preparePacked();
}
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function openModal(id) { $('#' + id).hidden = false; }
function closeModals() { document.querySelectorAll('.modal').forEach((m) => (m.hidden = true)); }

function eventPhase() {
  const s = state.settings;
  if (api.IS_DEMO) return 'demo';
  if (!s) return 'offline';
  if (!s.is_live) return 'not_live';
  const now = Date.now();
  if (s.start_at && now < Date.parse(s.start_at)) return 'not_started';
  if (s.end_at && now > Date.parse(s.end_at)) return 'ended';
  return 'live';
}
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// ---------------- 렌더링 ----------------
function renderTexts() {
  $('#tGreeting1').textContent = T('greeting1');
  $('#tGreeting2').textContent = T('greeting2');
}

function renderBanner() {
  const b = $('#modeBanner');
  const phase = eventPhase();
  const s = state.settings || {};
  const msg = {
    demo: '🧪 데모 모드 — 서버에 연결되지 않았어요. 여기서 나오는 당첨은 모두 가짜이며 실제 경품이 없어요.',
    offline: '⚠ 서버에 연결할 수 없어요. 잠시 후 새로고침해 주세요. (만들기 체험은 가능해요)',
    not_live: '🔧 이벤트 준비 중 — 지금은 추첨 없이 만들기 체험만 할 수 있어요.',
    not_started: `⏰ 추첨은 ${fmt(s.start_at)}부터 시작돼요! 지금은 만들기 체험만 가능해요.`,
    ended: '🍫 이벤트가 종료됐어요. 참여해 주셔서 고마워요!',
    live: s.sold_out ? '🎁 준비한 기프티콘이 모두 소진됐어요. 하뀨하 선물은 계속 받을 수 있어요!' : '',
  }[phase];
  b.hidden = !msg;
  b.textContent = msg || '';
  b.classList.toggle('demo', phase === 'demo');
}

function renderMainChars() {
  const box = $('#mainChars');
  box.replaceChildren(...CH.map((c, i) => {
    const cell = document.createElement('div');
    cell.className = 'char-cell';
    const img = charRig(c, 'idle');
    img.classList.add('bob');
    img.style.animationDelay = (i * 0.15) + 's';
    const name = document.createElement('span');
    name.className = 'name'; name.textContent = c.name;
    cell.append(img, name);
    return cell;
  }));
}

function renderPeperos() {
  $('#peperoList').replaceChildren(...CONFIG.PEPEROS.map((p) => {
    const card = document.createElement('div');
    card.className = 'pepero-card';
    const name = document.createElement('div');
    name.className = 'pname'; name.textContent = p.name;
    const btn = document.createElement('button');
    btn.className = 'btn small primary'; btn.textContent = '이걸로 할래!';
    btn.addEventListener('click', () => pickPepero(p.id, card));
    card.append(peperoEl(p), name, btn);
    return card;
  }));
}

// 공장 라인: 윗줄 0~3 (왼→오), 아랫줄 4~7 (오→왼, 지그재그)
function renderStations() {
  ['#line0', '#line1'].forEach((sel) => {
    $(sel + ' .crew').replaceChildren();
    $(sel + ' .names').replaceChildren();
  });
  CH.forEach((c, i) => {
    const line = i < 4 ? '#line0' : '#line1';
    const st = document.createElement('div');
    st.className = 'station';
    if (i === 0 || i === 7) st.classList.add('edge-l');
    if (i === 3 || i === 4) st.classList.add('edge-r');
    st.dataset.i = i; st.dataset.act = c.act;
    const bub = document.createElement('span');
    bub.className = 'bubble'; bub.textContent = c.line;
    st.append(bub, charRig(c, 'idle', { tool: true }));
    $(line + ' .crew').appendChild(st);
    const nm = document.createElement('span');
    nm.dataset.i = i;
    nm.innerHTML = '<b></b><small></small>';
    nm.querySelector('b').textContent = c.name;
    nm.querySelector('small').textContent = c.task;
    $(line + ' .names').appendChild(nm);
  });
}
function setStationImg(st, c, s) {
  // 상태 그림이 따로 없으면 그림을 갈아 끼우지 않아요 (깜빡임 방지)
  const o = (state.settings && state.settings.assets && state.settings.assets.characters && state.settings.assets.characters[c.id]) || {};
  if (!(CONFIG.CHARACTER_STATES || ['idle']).includes(s) && !o[s]) return;
  const old = st.querySelector('.rig .body > .imgwrap');
  if (old) old.replaceWith(charEl(c, s));
}
function stationEls(i) {
  return [document.querySelector(`.station[data-i="${i}"]`), document.querySelector(`.names span[data-i="${i}"]`)];
}
// 벨트 위 빼빼로를 i번 하뀨하 앞으로 이동
function placeItem(i, instant = false) {
  const item = $('#item');
  const [st] = stationEls(Math.min(i, CH.length - 1));
  if (!st) return;
  const fr = $('#floor').getBoundingClientRect();
  const r = st.getBoundingClientRect();
  const belt = st.closest('.line').querySelector('.belt-strip').getBoundingClientRect();
  if (instant) item.style.transition = 'none';
  item.style.left = (r.left - fr.left + r.width / 2) + 'px';
  item.style.top = (belt.top - fr.top + 6) + 'px';
  if (instant) { item.offsetHeight; item.style.transition = ''; }
}

function renderInfo() {
  const s = state.settings || {};
  const phase = eventPhase();
  let auth = '';
  if (phase === 'demo') {
    auth = `<p class="warn">🧪 <b>지금은 데모 모드</b>예요. 서버가 연결되지 않아 실제 경품 추첨이 이루어지지 않으며, 화면에 나오는 당첨은 테스트용 가짜 결과예요. 데모 당첨번호로 DM을 보내지 마세요.</p>`;
  } else if (s.auth_mode === 'anonymous') {
    auth = `<p class="warn">이번 이벤트는 <b>로그인 없이</b> 참여해요. 브라우저(기기)를 기준으로 1회 참여를 확인하기 때문에, 다른 브라우저·기기·시크릿 모드를 쓰면 반복 참여를 <b>완전히 막을 수는 없어요</b>. 공정한 이벤트를 위해 1인 1회만 참여해 주세요. 부정 참여가 확인되면 지급이 취소될 수 있어요.</p>`;
  } else {
    auth = `<p class="warn"><b>X 계정 1개당 1회</b> 참여할 수 있어요. 한 사람이 여러 X 계정을 쓰는 것까지는 완전히 막을 수 없지만, 부정 참여가 확인되면 지급이 취소될 수 있어요. 당첨 시 <b>참여에 사용한 X 계정</b>으로 DM을 보내야 본인 확인이 돼요.</p>`;
  }
  const period = s.start_at || s.end_at ? `<p>📅 추첨 기간: ${fmt(s.start_at) || '오픈 시'} ~ ${fmt(s.end_at) || '수량 소진 시'}</p>` : '';
  $('#infoBody').innerHTML = `
    <p>하뀨하 8마리가 직접 빼빼로를 만들어 선물해 드려요! 🍫</p>
    <ul>
      <li>원하는 빼빼로를 고르면 하뀨하들이 제작·포장해 줘요.</li>
      <li>선물상자를 열면 즉석 추첨이 진행돼요.</li>
      <li>일부 분께는 <b>편의점 빼빼로 기프티콘</b>이 당첨돼요! 당첨 여부는 서버에서 정해지고, 새로고침해도 결과는 바뀌지 않아요.</li>
      <li>준비한 기프티콘이 모두 소진되면 추가 당첨은 없어요. 그래도 하뀨하 선물은 모두에게 드려요 💜</li>
      <li>기프티콘은 운영자 X 계정 DM으로 보내 드려요. DM에는 <b>당첨번호만</b> 보내 주세요. 이름·전화번호 등 개인정보는 요구하지 않아요.</li>
    </ul>
    ${period}${auth}`;
}

// ---------------- 흐름 ----------------
function pickPepero(id, card) {
  if (state.busy) return;
  sound.click();
  state.pepero = id;
  state.replay = false;
  document.querySelectorAll('.pepero-card').forEach((c) => c.classList.remove('picked'));
  card.classList.add('picked');
  setTimeout(startMaking, 350);
}

let makingTimer = null, makingDone = true;
function startMaking() {
  clearTimeout(makingTimer);
  makingDone = false;
  const p = peperoById(state.pepero);
  $('#ticketImg').replaceChildren(peperoEl(p));
  $('#ticketName').textContent = p.name;
  const item = $('#item');
  item.style.setProperty('--coat', p.coat || '#6B3E2E');
  item.style.setProperty('--dots', p.dots || 'transparent');
  item.dataset.stage = 0;
  $('#itemFx').textContent = '';
  renderStations();
  setProgress(0);
  show('making');
  requestAnimationFrame(() => placeItem(0, true));
  let i = 0;
  const step = () => {
    if (makingDone) return;
    if (i > 0) {
      const [prev, prevName] = stationEls(i - 1);
      prev.classList.remove('active'); prev.classList.add('done');
      prevName.classList.remove('active'); prevName.classList.add('done');
      setStationImg(prev, CH[i - 1], 'done');
    }
    if (i >= CH.length) return finishMaking();
    const c = CH[i], idx = i;
    placeItem(idx);
    $('#workLabel').textContent = `${c.name} · ${c.task}`;
    // 빼빼로가 도착하면 작업 시작
    makingTimer = setTimeout(() => {
      if (makingDone) return;
      const [cur, curName] = stationEls(idx);
      cur.classList.add('active'); curName.classList.add('active');
      setStationImg(cur, c, 'work');
      $('#item').dataset.stage = idx;
      $('#itemFx').textContent = c.fx;
      sound.step(idx);
      setProgress((idx + 1) / CH.length);
      i++;
      makingTimer = setTimeout(step, Math.max(600, CONFIG.MAKING_STEP_MS - 450));
    }, idx === 0 ? 150 : 450);
  };
  step();
}
function finishMaking() {
  if (makingDone) return;
  makingDone = true;
  clearTimeout(makingTimer);
  document.querySelectorAll('.station').forEach((st) => {
    const i = +st.dataset.i;
    st.classList.remove('active'); st.classList.add('done');
    setStationImg(st, CH[i], 'happy');
  });
  document.querySelectorAll('.names span').forEach((n) => { n.classList.remove('active'); n.classList.add('done'); });
  placeItem(CH.length - 1);
  $('#item').dataset.stage = 8;
  $('#itemFx').textContent = '🎁';
  $('#workLabel').textContent = '포장 완료! 하뀨하들 수고했어요!';
  setProgress(1);
  sound.pop();
  setTimeout(() => {
    if (state.replay && state.result) { state.replay = false; showResult(); }
    else show('packed');
  }, 1200);
}
function setProgress(r) {
  const pct = Math.round(r * 100);
  $('#progressBar').style.width = pct + '%';
  $('#progressText').textContent = pct + '%';
}

// ---------------- 선물상자 ----------------
let tsWidget = null;
const SAY = ['받아줘!', '선물~', '쏙!', '빼빼로!', '헤헤', '두근두근', '짠!', '사랑해💜'];
function renderPackCrew() {
  $('#packCrew').classList.remove('cheer');
  $('#packCrew').replaceChildren(...CH.map((c, i) => {
    const cell = document.createElement('div');
    cell.className = 'pc';
    const say = document.createElement('span');
    say.className = 'say'; say.textContent = SAY[i % SAY.length];
    const rig = charRig(c, 'idle');
    rig.classList.add('bob'); rig.style.animationDelay = i * 0.13 + 's';
    cell.append(say, rig);
    return cell;
  }));
}
// 선물상자 열기: 하뀨하들이 바깥쪽부터 차례로 점프하며 빼빼로를 상자에 쏙쏙 넣어요
function deliverAnim() {
  const stage = document.querySelector('.gift-stage');
  const sr = stage.getBoundingClientRect();
  const gr = $('#giftBox').getBoundingClientRect();
  const tx = gr.left + gr.width / 2 - sr.left, ty = gr.top + gr.height * 0.4 - sr.top;
  const p = peperoById(state.pepero || (state.result && state.result.pepero));
  const crew = $('#packCrew');
  crew.classList.add('cheer');
  const cells = [...crew.querySelectorAll('.pc')];
  let last = 0;
  cells.forEach((cell, i) => {
    const delay = (3 - Math.min(i, 7 - i)) * 160 + (i < 4 ? 0 : 60);
    last = Math.max(last, delay);
    const rig = cell.querySelector('.rig');
    if (rig.animate) {
      rig.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }],
        { duration: 600, delay, easing: 'ease-out' });
    }
    const r = cell.getBoundingClientRect();
    const sx = r.left + r.width / 2 - sr.left, sy = r.top + r.height * 0.35 - sr.top;
    const st = document.createElement('i');
    st.className = 'fly-stick';
    st.style.setProperty('--coat', p.coat || '#6B3E2E');
    st.style.left = sx + 'px'; st.style.top = sy + 'px'; st.style.opacity = '0';
    stage.appendChild(st);
    const dx = tx - sx, dy = ty - sy;
    if (!st.animate) { st.remove(); return; }
    const anim = st.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - 60}px)) rotate(${i < 4 ? 200 : -200}deg) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${i < 4 ? 380 : -380}deg) scale(.5)`, opacity: 0 },
    ], { duration: 650, delay: delay + 180, easing: 'ease-in-out', fill: 'both' });
    anim.finished.then(() => { st.remove(); sound.step(i); }).catch(() => st.remove());
  });
  return last + 180 + 650;
}

function preparePacked() {
  renderPackCrew();
  const box = $('#giftBox');
  box.classList.remove('opening', 'opened');
  $('#btnOpen').disabled = false;
  $('#openStatus').textContent = '';
  if (CONFIG.TURNSTILE_SITE_KEY && eventPhase() === 'live') loadTurnstile();
}
function loadTurnstile() {
  const render = () => {
    if (tsWidget !== null) { try { window.turnstile.reset(tsWidget); } catch {} return; }
    tsWidget = window.turnstile.render('#turnstileBox', {
      sitekey: CONFIG.TURNSTILE_SITE_KEY,
      callback: (t) => (state.tsToken = t),
      'expired-callback': () => (state.tsToken = null),
    });
  };
  if (window.turnstile) return render();
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.onload = render;
  document.head.appendChild(s);
}

async function openGift() {
  if (state.busy) return; // 연타 방지
  state.busy = true;
  const btn = $('#btnOpen');
  btn.disabled = true;
  sound.click();
  $('#openStatus').textContent = '하뀨하들이 빼빼로를 상자에 쏙쏙 넣는 중!';
  const box = $('#giftBox');
  box.classList.add('opening');
  const minWait = wait(Math.max(1400, deliverAnim() + 150));

  let res;
  try { res = await decide(); }
  catch (e) { console.error(e); res = { status: 'error' }; }
  await minWait;

  if (res.status === 'win' || res.status === 'lose' || res.status === 'closed') {
    box.classList.remove('opening'); box.classList.add('opened');
    sound.pop();
    await wait(700);
    state.result = res;
    api.clearPending();
    state.busy = false;
    showResult();
    return;
  }

  // 실패/로그인 필요 → 상자 다시 닫기
  box.classList.remove('opening');
  $('#packCrew').classList.remove('cheer');
  btn.disabled = false;
  state.busy = false;
  $('#openStatus').textContent = '';
  if (res.status === 'login') openModal('loginModal');
  else if (res.status === 'rate_limited') toast('요청이 너무 많아요. 1분 뒤에 다시 눌러 주세요!');
  else if (res.status === 'captcha_required' || res.status === 'captcha_failed') {
    toast('보안 확인을 완료한 뒤 다시 눌러 주세요!');
    state.tsToken = null;
    if (tsWidget !== null) try { window.turnstile.reset(tsWidget); } catch {}
  } else toast('네트워크가 불안정해요. 다시 눌러도 결과는 딱 한 번만 정해지니 안심하세요!', 3600);
}

function closedResult(reason) {
  return { status: 'closed', reason, pepero: state.pepero };
}
function fromDraw(r, demo = false) {
  const d = r.draw || {};
  return {
    status: d.is_winner ? 'win' : 'lose',
    pepero: d.pepero || state.pepero,
    win_code: d.win_code || null,
    existing: !!r.existing,
    demo,
  };
}

// 실제 추첨 결정: 반드시 서버에서!
async function decide() {
  const phase = eventPhase();
  if (phase === 'demo') return fromDraw(api.demoDraw(state.pepero), true);
  if (phase !== 'live') return closedResult(phase);

  const s = state.settings;
  let session = await api.getSession();
  if (!session) {
    api.savePending({ pepero: state.pepero });
    if (s.auth_mode === 'anonymous') {
      await api.loginAnon();
    } else {
      return { status: 'login' };
    }
  }
  if (CONFIG.TURNSTILE_SITE_KEY && !state.tsToken) {
    // 이미 참여한 사람은 토큰 없이도 기존 결과를 받을 수 있게 먼저 확인
    const mine = await api.getMyDraw().catch(() => null);
    if (mine) return fromDraw({ draw: mine, existing: true });
    return { status: 'captcha_required' };
  }
  api.savePending({ pepero: state.pepero });
  const r = await api.liveDraw(state.pepero, state.tsToken);
  state.tsToken = null;
  switch (r.status) {
    case 'win': case 'lose': return fromDraw(r);
    case 'login_required':
      await api.logout().catch(() => {}); // 익명 세션 등 정리
      return { status: 'login' };
    case 'not_live': case 'not_started': case 'ended': return closedResult(r.status);
    default: return r; // rate_limited, captcha_failed, error
  }
}

// ---------------- 결과 화면 ----------------
// 하뀨하들이 옹기종기 모여 빼빼로 나눠 먹는 장면 (정지 화면)
function shareScene(p) {
  const sc = document.createElement('div');
  sc.className = 'share-scene';
  sc.style.setProperty('--coat', p.coat || '#6B3E2E');
  sc.innerHTML = '<div class="mat"></div>';
  CONFIG.SHARE_SCENE.forEach((pos, i) => {
    const c = CH.find((x) => x.id === pos.id);
    if (!c) return;
    const w = document.createElement('div');
    w.className = 'who';
    w.style.left = pos.x + '%';
    w.style.bottom = pos.y + '%';
    w.style.width = pos.s + '%';
    w.style.zIndex = 10 + i;
    w.appendChild(charRig(c, 'happy', { tool: 'give', pose: cheerPose(c, pos) }));
    sc.appendChild(w);
  });
  return sc;
}

function showResult() {
  const r = state.result;
  const p = peperoById(r.pepero);
  const card = $('#resultCard');
  card.className = 'result-card ' + (r.status === 'win' ? 'win' : 'lose');
  card.innerHTML = '';

  const add = (html) => { card.insertAdjacentHTML('beforeend', html); return card.lastElementChild; };
  if (r.demo) add(`<div class="demo-stamp">🧪 DEMO · 실제 당첨 아님 (테스트 결과)</div>`);
  if (r.existing) add(`<span class="existing-tag">이미 받은 선물이에요</span>`);

  const isWin = r.status === 'win';
  const h = add('<h2></h2>'); h.textContent = isWin ? T('winTitle') : T('loseTitle');
  const m = add('<p class="msg"></p>'); m.textContent = isWin ? T('winMsg') : T('loseMsg');
  if (isWin && r.demo) m.textContent = '(데모) 실제 서버 연결 후에는 이렇게 보여요. 이 번호로는 경품을 받을 수 없어요.';

  const pw = peperoEl(p); pw.classList.add('r-pepero'); card.appendChild(pw);
  const pn = add('<div class="r-pname"></div>'); pn.textContent = p.name;

  add('<p class="give-title">다 같이 빼빼로로 짠! 🥂</p>');
  card.appendChild(shareScene(p));
  const g = add('<p class="greet"></p>'); g.textContent = 'HAPPY PEPERO DAY · 2026.11.11';

  if (isWin) {
    const box = add(`<div class="code-box">
        <div class="label">${r.demo ? '데모 당첨번호 (가짜)' : '고유 당첨번호'}</div>
        <span class="code"></span>
        <button class="btn small pink" id="btnCopy">당첨번호 복사</button>
      </div>`);
    box.querySelector('.code').textContent = r.win_code;
    const claim = add('<div class="claim"></div>');
    let howto = T('howToClaim');
    if (state.settings && state.settings.auth_mode === 'anonymous') {
      howto += '\n※ 로그인 없이 참여했으므로, 이 화면을 저장한 이미지도 함께 보내 주세요.';
    }
    claim.textContent = howto;
    const x = add(`<a class="btn x" target="_blank" rel="noopener">𝕏 운영자에게 DM 보내러 가기</a>`);
    if (r.demo) { x.removeAttribute('href'); x.textContent = '(데모) DM 보내기 비활성화'; x.style.opacity = .5; }
    else x.href = state.xLink;
    box.querySelector('#btnCopy').addEventListener('click', () => copyText(r.win_code));
    sound.fanfare();
    confetti();
  } else {
    sound.gentle();
  }

  if (r.status === 'closed') {
    const n = add('<div class="closed-note"></div>');
    n.textContent = {
      not_live: '지금은 이벤트 준비 중이라 기프티콘 추첨 없이 하뀨하 선물만 드렸어요.',
      not_started: '아직 추첨 시작 전이라 기프티콘 추첨 없이 하뀨하 선물만 드렸어요. 시작 후에 다시 와 주세요!',
      ended: '이벤트가 종료되어 기프티콘 추첨은 진행되지 않았어요. 참여해 줘서 고마워요!',
      offline: '서버에 연결할 수 없어 추첨 없이 하뀨하 선물만 드렸어요.',
    }[r.reason] || '';
  }

  $('#btnDemoReset').hidden = !api.IS_DEMO;
  $('#myGiftNotice').hidden = r.status === 'closed';
  show('result');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast('당첨번호를 복사했어요! 📋');
}

function confetti() {
  const box = $('#confetti');
  const colors = ['#C8A2E8', '#FFBBD5', '#FFD866', '#FFF4E5', '#9A6FC4'];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    c.style.animationDelay = Math.random() * 0.6 + 's';
    box.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

async function saveImage() {
  const btn = $('#btnSave');
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const url = await makeResultPng({
      result: state.result,
      pepero: peperoById(state.result.pepero),
      characters: CH,
      texts: state.texts,
    });
    $('#savedImg').src = url;
    $('#savedLink').href = url;
    openModal('imageModal');
  } catch (e) {
    console.error(e);
    toast('이미지를 만들지 못했어요. 화면 캡처로 저장해 주세요!');
  } finally { btn.disabled = false; }
}

// ---------------- 시작 ----------------
function bindUI() {
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { sound.click(); if (go.dataset.go === 'main') clearTimeout(makingTimer); show(go.dataset.go); }
    if (e.target.closest('[data-close]') || e.target.classList.contains('modal')) closeModals();
  });
  $('#btnOrder').addEventListener('click', () => { sound.click(); show('select'); });
  $('#btnInfo').addEventListener('click', () => { sound.click(); renderInfo(); openModal('infoModal'); });
  $('#btnSkip').addEventListener('click', () => { sound.click(); finishMaking(); });
  $('#btnOpen').addEventListener('click', openGift);
  $('#btnMyGift').addEventListener('click', () => { if (state.result) showResult(); });
  $('#btnReplay').addEventListener('click', () => {
    if (!state.result) return;
    state.replay = true; state.pepero = state.result.pepero; startMaking();
  });
  $('#btnSave').addEventListener('click', saveImage);
  $('#btnDemoReset').addEventListener('click', () => {
    api.demoResetMe(); state.result = null;
    $('#myGiftNotice').hidden = true;
    toast('데모 참여 기록을 지웠어요. 새 참여자로 다시 해 볼 수 있어요!');
    show('main');
  });
  $('#btnLoginX').addEventListener('click', async () => {
    try {
      api.savePending({ pepero: state.pepero });
      await api.loginX();
    } catch (e) { console.error(e); toast('X 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  });
  $('#bgmBtn').addEventListener('click', async () => {
    const on = await sound.toggleBgm();
    $('#bgmBtn').textContent = on ? '♪ ON' : '♪ OFF';
  });
}

async function init() {
  bindUI();
  renderMainChars();
  renderPeperos();
  renderTexts();

  try { state.settings = await api.getPublicSettings(); }
  catch (e) { console.warn('settings', e); state.settings = null; }
  const s = state.settings || {};
  state.texts = { ...CONFIG.TEXTS, ...(s.texts || {}) };
  if (s.x_link) state.xLink = s.x_link;
  setAssetOverrides(s.assets);
  renderTexts();
  renderMainChars();
  renderPeperos();
  renderBanner();

  // 재접속 시 기존 결과 복원
  let my = null;
  try { my = await api.getMyDraw(); } catch (e) { console.warn('my draw', e); }
  if (my) {
    state.result = fromDraw({ draw: my, existing: true }, api.IS_DEMO);
    $('#myGiftNotice').hidden = false;
  }

  // X 로그인에서 돌아온 경우 → 선물상자 자동 열기
  const pending = api.readPending();
  if (pending && pending.pepero) {
    state.pepero = pending.pepero;
    if (my) { api.clearPending(); showResult(); return; }
    show('packed');
    if (!api.IS_DEMO && (await api.getSession())) setTimeout(openGift, 500);
  }
}

init();
