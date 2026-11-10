// 서버 통신 모듈 — 데모 모드 / 실제(Supabase) 모드
import { CONFIG } from './config.js';

export const IS_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

const LS = {
  pending: 'hkh_pending',
  demoMy: 'hkh_demo_my',
  demoDraws: 'hkh_demo_draws',
  demoSettings: 'hkh_demo_settings',
};
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- Supabase 클라이언트 ----------------
const clients = {};
async function client(kind = 'user') {
  if (IS_DEMO) throw new Error('demo');
  if (!clients[kind]) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    // 관리자 세션과 참여자 세션이 섞이지 않도록 저장 키를 분리
    clients[kind] = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { storageKey: kind === 'admin' ? 'hkh-admin-auth' : 'hkh-user-auth', persistSession: true, detectSessionInUrl: kind !== 'admin' },
    });
  }
  return clients[kind];
}

// ---------------- 주문 대기 상태 (로그인 리다이렉트 대비) ----------------
export const savePending = (p) => ls.set(LS.pending, { ...p, at: Date.now() });
export const readPending = () => {
  const p = ls.get(LS.pending);
  return p && Date.now() - p.at < 30 * 60 * 1000 ? p : null;
};
export const clearPending = () => ls.del(LS.pending);

// ---------------- 공개 설정 ----------------
export async function getPublicSettings() {
  if (IS_DEMO) {
    const s = demoSettings();
    return { demo: true, is_live: false, auth_mode: 'demo', x_link: s.x_link, texts: s.texts, assets: {}, sold_out: demoWinners() >= s.total_coupons };
  }
  const c = await client();
  const { data, error } = await c.rpc('get_public_settings');
  if (error) throw error;
  return data;
}

// ---------------- 참여자 인증 ----------------
export async function getSession() {
  if (IS_DEMO) return null;
  const c = await client();
  const { data } = await c.auth.getSession();
  return data.session;
}
export async function loginX() {
  const c = await client();
  const { error } = await c.auth.signInWithOAuth({
    provider: CONFIG.X_PROVIDER,
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}
export async function loginAnon() {
  const c = await client();
  const { error } = await c.auth.signInAnonymously();
  if (error) throw error;
}
export async function logout() {
  if (IS_DEMO) return;
  const c = await client();
  await c.auth.signOut();
}

// ---------------- 내 추첨 결과 ----------------
export async function getMyDraw() {
  if (IS_DEMO) return ls.get(LS.demoMy);
  const c = await client();
  const { data: { session } } = await c.auth.getSession();
  if (!session) return null;
  let { data, error } = await c.from('draws')
    .select('pepero,is_winner,win_code,status,created_at,claim_x')
    .eq('user_id', session.user.id).maybeSingle();
  if (error) { // update_claim.sql 실행 전이면 claim_x 칸이 없을 수 있어요
    ({ data, error } = await c.from('draws')
      .select('pepero,is_winner,win_code,status,created_at')
      .eq('user_id', session.user.id).maybeSingle());
  }
  if (error) throw error;
  return data;
}

// 당첨자가 기프티콘 받을 X 아이디 보내기
export async function submitClaim(handle) {
  const h = String(handle || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return { ok: false, error: 'bad_handle' };
  if (IS_DEMO) {
    const mine = ls.get(LS.demoMy);
    if (!mine || !mine.is_winner) return { ok: false, error: 'not_allowed' };
    const upd = { ...mine, claim_x: h, status: mine.status === 'paid' ? 'paid' : 'pending' };
    ls.set(LS.demoMy, upd);
    ls.set(LS.demoDraws, demoDraws().map((d) => (d.id === mine.id ? upd : d)));
    return { ok: true, claim_x: h };
  }
  const c = await client();
  const { data, error } = await c.rpc('submit_claim', { p_handle: h });
  if (error) return { ok: false, error: error.message };
  return data;
}

// ---------------- 실제 추첨 (서버) ----------------
// 서버 함수는 같은 사용자에게 항상 같은 결과를 돌려주므로(멱등),
// 네트워크가 끊겨도 안전하게 재시도할 수 있어요.
export async function liveDraw(pepero, turnstileToken) {
  const c = await client();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: { session } } = await c.auth.getSession();
    if (!session) return { status: 'login_required' };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/${CONFIG.DRAW_FUNCTION || 'draw'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ pepero, turnstileToken }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status >= 500) throw new Error('server ' + res.status);
      return await res.json();
    } catch (e) {
      // 응답만 유실됐을 수 있으니 저장된 결과부터 확인
      const mine = await getMyDraw().catch(() => null);
      if (mine) return { status: mine.is_winner ? 'win' : 'lose', existing: true, draw: mine };
      await sleep(800 * (attempt + 1));
    }
  }
  return { status: 'error', message: 'network' };
}

// =====================================================================
//  데모 모드 (서버 없이 흐름 테스트용 — 실제 경품과 무관)
// =====================================================================
const DEMO_DEFAULT = {
  is_live: false, auth_mode: 'x', start_at: null, end_at: null,
  total_coupons: 5, win_probability: 0.3, x_link: CONFIG.X_LINK, texts: {}, assets: {},
};
export function demoSettings() { return { ...DEMO_DEFAULT, ...(ls.get(LS.demoSettings) || {}) }; }
const demoDraws = () => ls.get(LS.demoDraws) || [];
const demoWinners = () => demoDraws().filter((d) => d.is_winner).length;
const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

function demoCreateDraw(pepero, who) {
  const s = demoSettings();
  // ⚠ 데모 전용 브라우저 난수. 실제 이벤트에서는 서버(Postgres)가 결정해요.
  const win = demoWinners() < s.total_coupons && Math.random() < s.win_probability;
  const d = {
    id: hex(8), pepero, is_winner: win,
    win_code: win ? `DEMO-${hex(2)}-${hex(2)}` : null,
    status: win ? 'pending' : 'none',
    created_at: new Date().toISOString(), paid_at: null, x_username: who,
  };
  ls.set(LS.demoDraws, [d, ...demoDraws()]);
  return d;
}
export function demoDraw(pepero) {
  const mine = ls.get(LS.demoMy);
  if (mine) return { status: mine.is_winner ? 'win' : 'lose', existing: true, draw: mine };
  const d = demoCreateDraw(pepero, 'demo_me');
  ls.set(LS.demoMy, d);
  return { status: d.is_winner ? 'win' : 'lose', existing: false, draw: d };
}
export function demoResetMe() { ls.del(LS.demoMy); clearPending(); }

// =====================================================================
//  관리자 기능
// =====================================================================
export async function adminLogin(email, password) {
  const c = await client('admin');
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function adminLogout() {
  if (IS_DEMO) return;
  const c = await client('admin');
  await c.auth.signOut();
}
export async function adminCheck() {
  if (IS_DEMO) return false;
  const c = await client('admin');
  const { data: { session } } = await c.auth.getSession();
  if (!session) return false;
  const { data, error } = await c.rpc('is_admin');
  return !error && data === true;
}

export async function adminStats() {
  if (IS_DEMO) {
    const ds = demoDraws(), s = demoSettings();
    return {
      participants: ds.length,
      winners: ds.filter((d) => d.is_winner).length,
      paid: ds.filter((d) => d.status === 'paid').length,
      unpaid: ds.filter((d) => d.is_winner && d.status !== 'paid').length,
      total: s.total_coupons,
    };
  }
  const c = await client('admin');
  const { data, error } = await c.rpc('admin_stats');
  if (error) throw error;
  return data;
}

export async function adminListWinners(q = '', status = '') {
  if (IS_DEMO) {
    const qq = q.trim().toUpperCase();
    return demoDraws().filter((d) => d.is_winner
      && (!qq || (d.win_code || '').includes(qq) || (d.x_username || '').toUpperCase().includes(qq) || (d.claim_x || '').toUpperCase().includes(qq))
      && (!status || d.status === status));
  }
  const c = await client('admin');
  const safe = q.trim().replace(/[^A-Za-z0-9_\-]/g, '');
  const run = (withClaim) => {
    let query = c.from('draws')
      .select('id,win_code,created_at,pepero,status,paid_at,x_username,auth_provider,admin_memo' + (withClaim ? ',claim_x,claimed_at' : ''))
      .eq('is_winner', true).order('created_at', { ascending: false }).limit(1000);
    if (safe) query = query.or(`win_code.ilike.%${safe}%,x_username.ilike.%${safe}%` + (withClaim ? `,claim_x.ilike.%${safe}%` : ''));
    if (status) query = query.eq('status', status);
    return query;
  };
  let { data, error } = await run(true);
  if (error) ({ data, error } = await run(false));
  if (error) throw error;
  return data;
}

export async function adminSetStatus(id, status, memo) {
  const patch = { status, paid_at: status === 'paid' ? new Date().toISOString() : null };
  if (memo !== undefined) patch.admin_memo = memo;
  if (IS_DEMO) {
    ls.set(LS.demoDraws, demoDraws().map((d) => (d.id === id ? { ...d, ...patch } : d)));
    const mine = ls.get(LS.demoMy);
    if (mine && mine.id === id) ls.set(LS.demoMy, { ...mine, ...patch });
    return;
  }
  const c = await client('admin');
  const { error } = await c.from('draws').update(patch).eq('id', id);
  if (error) throw error;
}

export async function adminGetSettings() {
  if (IS_DEMO) return demoSettings();
  const c = await client('admin');
  const { data, error } = await c.from('event_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data;
}

export async function adminSaveSettings(patch) {
  if (IS_DEMO) { ls.set(LS.demoSettings, { ...demoSettings(), ...patch }); return; }
  const c = await client('admin');
  const { error } = await c.from('event_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw error;
}

export async function adminUpload(path, file) {
  if (IS_DEMO) throw new Error('데모 모드에서는 업로드할 수 없어요. assets 폴더의 파일을 직접 교체해 주세요.');
  const c = await client('admin');
  const { error } = await c.storage.from('assets').upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = c.storage.from('assets').getPublicUrl(path);
  return data.publicUrl + '?v=' + Date.now();
}

// 데모: 가상 참여자 추가 (수량 제한 테스트용)
export function demoSimulate(n = 10) {
  const ids = CONFIG.PEPEROS.map((p) => p.id);
  for (let i = 0; i < n; i++) demoCreateDraw(ids[i % ids.length], 'demo_user_' + hex(2));
}
export function demoClearAll() { ls.del(LS.demoDraws); ls.del(LS.demoMy); ls.del(LS.demoSettings); }
