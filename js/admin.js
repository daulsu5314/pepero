// 관리자 페이지
// ※ 이 HTML 파일 자체는 누구나 열 수 있지만, 데이터는 서버(RLS)가
//   admins 테이블에 등록된 계정에게만 보여 주고 수정을 허락해요.
import { CONFIG } from './config.js';
import * as api from './api.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { pending: '지급 대기', paid: '지급 완료', check: '확인 필요', none: '-' };
const TEXT_LABELS = {
  greeting1: '메인 문구 1', greeting2: '메인 문구 2',
  loseTitle: '일반 선물 제목', loseMsg: '일반 선물 메시지',
  winTitle: '당첨 제목', winMsg: '당첨 메시지',
  howToClaim: '기프티콘 수령 방법', cardMsg: '결과 이미지 하단 문구', prizeName: '당첨 상품 이름',
};
let settings = null;

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function view(name) {
  $('#loginView').classList.toggle('active', name === 'login');
  $('#adminView').classList.toggle('active', name === 'admin');
  $('#btnLogout').hidden = name !== 'admin' || api.IS_DEMO;
}
const pad = (n) => String(n).padStart(2, '0');
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
const peperoName = (id) => (CONFIG.PEPEROS.find((p) => p.id === id) || {}).name || id;

// ---------------- 대시보드 ----------------
async function loadStats() {
  try {
    const s = await api.adminStats();
    $('#sParticipants').textContent = s.participants;
    $('#sWinners').textContent = s.winners;
    $('#sRemain').textContent = Math.max(0, s.total - s.winners);
    $('#sPaid').textContent = s.paid;
    $('#sUnpaid').textContent = s.unpaid;
  } catch (e) { console.error(e); toast('통계를 불러오지 못했어요'); }
}

let searchTimer;
async function loadWinners() {
  const rows = $('#winnerRows');
  try {
    const list = await api.adminListWinners($('#q').value, $('#statusFilter').value);
    if (!list.length) { rows.innerHTML = '<tr><td colspan="5">해당하는 당첨자가 없어요.</td></tr>'; return; }
    rows.innerHTML = list.map((d) => `
      <tr data-id="${esc(d.id)}">
        <td><span class="code">${esc(d.win_code)}</span><br>
            ${d.claim_x
              ? `<b>받을 X: <a href="https://x.com/${esc(d.claim_x)}" target="_blank" rel="noopener">@${esc(d.claim_x)}</a></b>`
              : '<small style="color:#B3261E">아직 X 아이디 미제출</small>'}
            ${d.x_username ? `<br><small>로그인 𝕏 @${esc(d.x_username)}</small>` : ''}
            ${d.admin_memo ? `<br><small>📝 ${esc(d.admin_memo)}</small>` : ''}</td>
        <td>${fmt(d.created_at)}${d.paid_at ? `<br><small>지급 ${fmt(d.paid_at)}</small>` : ''}</td>
        <td>${esc(peperoName(d.pepero))}</td>
        <td><span class="tag ${esc(d.status)}">${STATUS[d.status] || esc(d.status)}</span></td>
        <td class="btns">
          <button data-set="paid">지급 완료</button>
          <button data-set="pending">지급 대기</button>
          <button data-set="check">확인 필요</button>
          <button data-memo>메모</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    console.error(e);
    rows.innerHTML = '<tr><td colspan="5">불러오지 못했어요. 관리자 권한을 확인해 주세요.</td></tr>';
  }
}

$('#winnerRows').addEventListener('click', async (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const id = tr.dataset.id;
  const code = tr.querySelector('.code').textContent;
  try {
    if (e.target.dataset.set) {
      const st = e.target.dataset.set;
      if (st === 'paid' && !confirm(`${code}\n기프티콘을 실제로 전달했나요? 지급 완료로 바꿀게요.`)) return;
      await api.adminSetStatus(id, st);
      toast(`${STATUS[st]}(으)로 변경했어요`);
    } else if (e.target.hasAttribute('data-memo')) {
      const memo = prompt('메모 (예: DM 계정 불일치, 재확인 요청함)');
      if (memo === null) return;
      const cur = tr.querySelector('.tag').classList[1];
      await api.adminSetStatus(id, cur, memo);
    } else return;
    await Promise.all([loadWinners(), loadStats()]);
  } catch (err) { console.error(err); toast('변경하지 못했어요: ' + (err.message || '')); }
});
$('#q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadWinners, 300); });
$('#statusFilter').addEventListener('change', loadWinners);
$('#btnRefresh').addEventListener('click', () => { loadStats(); loadWinners(); });

// ---------------- 설정 ----------------
function renderTextFields(texts) {
  $('#textFields').innerHTML = Object.keys(CONFIG.TEXTS).map((k) => `
    <label class="f" for="t_${k}">${esc(TEXT_LABELS[k] || k)}</label>
    <textarea id="t_${k}" data-text="${k}" placeholder="${esc(CONFIG.TEXTS[k])}">${esc(texts[k] ?? '')}</textarea>`).join('')
    + '<p class="f-help">비워 두면 기본 문구(회색 글씨)가 나와요.</p>';
}
async function loadSettings() {
  try {
    settings = await api.adminGetSettings();
    $('#isLive').checked = !!settings.is_live;
    $('#authMode').value = settings.auth_mode;
    $('#startAt').value = toLocalInput(settings.start_at);
    $('#endAt').value = toLocalInput(settings.end_at);
    $('#total').value = settings.total_coupons;
    $('#prob').value = +(Number(settings.win_probability) * 100).toFixed(4);
    $('#xLink').value = settings.x_link || '';
    renderTextFields(settings.texts || {});
  } catch (e) { console.error(e); toast('설정을 불러오지 못했어요'); }
}

$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const total = parseInt($('#total').value, 10);
  const prob = parseFloat($('#prob').value);
  if (!(total >= 0)) return toast('기프티콘 수량을 확인해 주세요');
  if (!(prob >= 0 && prob <= 100)) return toast('확률은 0~100 사이로 입력해 주세요');
  const winners = parseInt($('#sWinners').textContent, 10) || 0;
  if (total < winners) return toast(`이미 당첨자가 ${winners}명이에요. 수량을 그보다 적게 할 수 없어요.`);
  const startAt = fromLocalInput($('#startAt').value), endAt = fromLocalInput($('#endAt').value);
  if (startAt && endAt && startAt >= endAt) return toast('종료 시간이 시작 시간보다 늦어야 해요');

  const isLive = $('#isLive').checked;
  if (isLive && !settings.is_live) {
    if (api.IS_DEMO) { toast('데모 모드에서는 실제 추첨을 켤 수 없어요'); $('#isLive').checked = false; return; }
    const ok = confirm(
      '실제 경품 추첨을 시작할까요?\n\n'
      + `· 기프티콘 ${total}개 / 확률 ${prob}%\n`
      + `· 인증: ${$('#authMode').value === 'x' ? 'X 로그인 필수' : '로그인 없음(중복 참여 위험)'}\n`
      + '· X 로그인·Edge Function 테스트를 마쳤나요?\n\n'
      + '켜는 순간부터 실제 당첨자가 생겨요.');
    if (!ok) return;
  }
  if ($('#authMode').value === 'anonymous' && settings.auth_mode !== 'anonymous'
      && !confirm('로그인 없이 참여하면 같은 사람이 다른 브라우저로 여러 번 참여하는 것을 완전히 막을 수 없어요. 그래도 바꿀까요?')) return;

  const texts = {};
  document.querySelectorAll('[data-text]').forEach((t) => { if (t.value.trim()) texts[t.dataset.text] = t.value.trim(); });
  try {
    await api.adminSaveSettings({
      is_live: isLive, auth_mode: $('#authMode').value,
      start_at: startAt, end_at: endAt,
      total_coupons: total, win_probability: prob / 100,
      x_link: $('#xLink').value.trim() || 'https://x.com/',
      texts,
    });
    toast('저장했어요! ✨');
    await loadSettings(); await loadStats();
  } catch (err) { console.error(err); toast('저장하지 못했어요: ' + (err.message || '')); }
});

// ---------------- 이미지 ----------------
function fillImgTargets() {
  $('#imgTarget').innerHTML =
    '<optgroup label="캐릭터">' + CONFIG.CHARACTERS.map((c) => `<option value="characters:${c.id}">${esc(c.name)}</option>`).join('') + '</optgroup>'
    + '<optgroup label="빼빼로 사진">' + CONFIG.PEPEROS.map((p) => `<option value="pepero:${p.id}">${esc(p.name)}</option>`).join('') + '</optgroup>'
    + '<optgroup label="당첨 상품"><option value="prize:main">당첨 상품 사진</option></optgroup>';
  const sync = () => { $('#imgState').disabled = !$('#imgTarget').value.startsWith('characters:'); };
  $('#imgTarget').addEventListener('change', sync); sync();
}
function setAssetUrl(kind, id, st, url) {
  const assets = JSON.parse(JSON.stringify(settings.assets || {}));
  assets[kind] = assets[kind] || {};
  if (kind === 'characters') {
    assets[kind][id] = assets[kind][id] || {};
    if (url) assets[kind][id][st] = url; else delete assets[kind][id][st];
  } else if (url) assets[kind][id] = url; else delete assets[kind][id];
  return assets;
}
$('#btnUpload').addEventListener('click', async () => {
  const file = $('#imgFile').files[0];
  if (!file) return toast('파일을 선택해 주세요');
  if (file.size > 3 * 1024 * 1024) return toast('3MB 이하 이미지로 올려 주세요');
  const [kind, id] = $('#imgTarget').value.split(':');
  const st = $('#imgState').value;
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = kind === 'characters' ? `characters/${id}/${st}.${ext}` : kind === 'prize' ? `ui/prize.${ext}` : `pepero/${id}.${ext}`;
  $('#imgMsg').textContent = '업로드 중…';
  try {
    const url = await api.adminUpload(path, file);
    await api.adminSaveSettings({ assets: setAssetUrl(kind, id, st, url) });
    await loadSettings();
    $('#imgMsg').textContent = '적용 완료! 사이트를 새로고침하면 보여요.';
  } catch (e) { console.error(e); $('#imgMsg').textContent = '실패: ' + (e.message || e); }
});
$('#btnResetImg').addEventListener('click', async () => {
  const [kind, id] = $('#imgTarget').value.split(':');
  try {
    await api.adminSaveSettings({ assets: setAssetUrl(kind, id, $('#imgState').value, null) });
    await loadSettings();
    $('#imgMsg').textContent = '업로드 이미지를 해제했어요. 기본 파일이 사용돼요.';
  } catch (e) { $('#imgMsg').textContent = '실패: ' + (e.message || e); }
});

// ---------------- 로그인 ----------------
async function enterAdmin() {
  view('admin');
  fillImgTargets();
  await loadSettings();
  await Promise.all([loadStats(), loadWinners()]);
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (api.IS_DEMO) { $('#loginMsg').textContent = '데모 모드예요. 아래 데모 관리자 버튼을 눌러 주세요.'; return; }
  $('#loginMsg').textContent = '확인 중…';
  try {
    await api.adminLogin($('#email').value.trim(), $('#pw').value);
    if (await api.adminCheck()) { $('#loginMsg').textContent = ''; enterAdmin(); }
    else { await api.adminLogout(); $('#loginMsg').textContent = '관리자로 등록되지 않은 계정이에요.'; }
  } catch (err) { $('#loginMsg').textContent = '로그인 실패: 이메일/비밀번호를 확인해 주세요.'; }
});
$('#btnLogout').addEventListener('click', async () => { await api.adminLogout(); view('login'); });

// 데모 도구
$('#btnDemoAdmin').addEventListener('click', enterAdmin);
$('#btnSim').addEventListener('click', async () => { api.demoSimulate(10); await loadStats(); await loadWinners(); toast('가상 참여자 10명이 추첨했어요'); });
$('#btnDemoClear').addEventListener('click', async () => {
  if (!confirm('이 브라우저의 데모 기록과 데모 설정을 모두 지울까요?')) return;
  api.demoClearAll(); await loadSettings(); await loadStats(); await loadWinners();
});

(async function init() {
  if (api.IS_DEMO) {
    const b = $('#modeBanner');
    b.hidden = false; b.classList.add('demo');
    b.textContent = '🧪 데모 모드 — 서버 미연결. 이 페이지의 기록은 이 브라우저에만 저장된 가짜 데이터예요.';
    $('#demoEnter').hidden = false;
    $('#demoTools').hidden = false;
    return;
  }
  try { if (await api.adminCheck()) enterAdmin(); } catch (e) { console.warn(e); }
})();
