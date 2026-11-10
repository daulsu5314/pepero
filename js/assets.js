// 이미지 경로 결정 + 이미지가 없을 때 플레이스홀더 표시
import { CONFIG } from './config.js';

let overrides = {}; // 관리자 페이지에서 업로드한 이미지 URL (settings.assets)
export function setAssetOverrides(a) { overrides = a || {}; }

const ext = CONFIG.IMAGE_EXT || 'png';

export function charSrcs(id, st = 'idle') {
  const o = (overrides.characters && overrides.characters[id]) || {};
  const states = CONFIG.CHARACTER_STATES || ['idle'];
  if (!states.includes(st) && !o[st]) st = 'idle'; // 없는 상태 그림은 요청하지 않기
  return [...new Set([
    o[st], `assets/characters/${id}/${st}.${ext}`,
    o.idle, `assets/characters/${id}/idle.${ext}`,
  ].filter(Boolean))];
}

// 실제 당첨 상품 사진 (assets/ui/prize.png 또는 관리자 업로드)
export function prizeSrcs() {
  return [overrides.prize && overrides.prize.main, 'assets/ui/prize.png'].filter(Boolean);
}

export function peperoSrcs(id) {
  const o = overrides.pepero && overrides.pepero[id];
  return [o, `assets/pepero/${id}.png`, `assets/pepero/${id}.jpg`, `assets/pepero/${id}.webp`].filter(Boolean);
}

// srcs를 차례대로 시도하고, 모두 실패하면 placeholder()로 교체
export function fallbackImg(srcs, placeholder, alt = '', cls = '') {
  const wrap = document.createElement('span');
  wrap.className = 'imgwrap ' + cls;
  if (!srcs.length) { wrap.appendChild(placeholder()); return wrap; }
  const img = new Image();
  img.alt = alt; img.draggable = false; img.decoding = 'async';
  let i = 0;
  img.onerror = () => {
    i++;
    if (i < srcs.length) img.src = srcs[i];
    else wrap.replaceChildren(placeholder());
  };
  img.src = srcs[0];
  wrap.appendChild(img);
  return wrap;
}

export function charPlaceholder(c) {
  const d = document.createElement('div');
  d.className = 'ph ph-char';
  d.innerHTML = `<b>${c.name}</b><small>이미지<br>준비중</small>`;
  return d;
}

export function peperoPlaceholder(p) {
  const d = document.createElement('div');
  d.className = 'ph ph-pepero';
  d.style.setProperty('--coat', p.coat || '#6B3E2E');
  d.style.setProperty('--dots', p.dots || 'transparent');
  d.innerHTML = '<i></i><i></i><i></i>';
  return d;
}

export function charEl(c, st = 'idle') {
  return fallbackImg(charSrcs(c.id, st), () => charPlaceholder(c), c.name, 'char-img');
}
// 캐릭터 + 요리사 모자 + (선택) 도구를 든 손
// 원본 캐릭터 이미지는 그대로 두고, 모자·손·도구는 위에 겹쳐 그리는 별도 레이어예요.
// 위치는 config.js 의 CHARACTERS[].rig 로 조절해요.
// 치얼스 장면: 각자 손에서 가운데 '짠!' 지점을 향해 빼빼로를 뻗는 각도·길이 계산
// (화면과 PNG 저장 둘 다 같은 계산을 사용)
export const SCENE_ASPECT = 0.66;          // 장면 높이 / 너비
export const CHEER_POINT = [0.5, 0.56];    // 짠! 하는 지점 (가로 비율, 세로 비율)
export function cheerPose(c, pos) {
  const r = c.rig || {};
  let [gx, gy] = pos.hand || r.hand || [75, 75];
  if (!pos.hand && pos.x > 50) gx = 100 - gx; // 가운데 쪽 손으로 쥐기
  const w = pos.s / 100;                         // 리그 크기 (장면 너비 기준)
  const H = SCENE_ASPECT;
  const left = pos.x / 100 - w / 2, top = H * (1 - pos.y / 100) - w;
  const bx = left + w * 0.11, by = top + w * 0.22, bw = w * 0.78;
  const hx = bx + bw * gx / 100, hy = by + bw * gy / 100;
  const cx = CHEER_POINT[0], cy = H * CHEER_POINT[1];
  const dx = cx - hx, dy = cy - hy;
  // 위쪽이 0도. 다 같이 가운데 위로 들어 올리는 각도 (±62도 안에서)
  const rot = Math.max(-62, Math.min(62, Math.atan2(dx, -dy) * 180 / Math.PI));
  const len = 50; // 몸 크기 대비 %
  return { gx, gy, rot, len };
}

export function charRig(c, st = 'idle', { hat = CONFIG.CHEF_HAT, tool = false, mirrorHand = false, pose = null } = {}) {
  const r = c.rig || {};
  const [hx, hy, hw, hr] = r.hat || [50, 4, 60, 0];
  const [ax, ay, flip] = r.arm || [80, 52, 0];
  const rig = document.createElement('span');
  rig.className = 'rig';
  rig.style.cssText = `--hx:${hx}%;--hy:${hy}%;--hw:${hw}%;--hr:${hr}deg;--ax:${ax}%;--ay:${ay}%;--paw:${c.paw || '#fff'}`;
  const body = document.createElement('span');
  body.className = 'body';
  body.appendChild(charEl(c, st));
  if (hat) {
    const h = new Image();
    h.className = 'hat'; h.alt = ''; h.draggable = false;
    h.onerror = () => h.remove();
    h.src = 'assets/ui/chef-hat.png';
    body.appendChild(h);
  }
  if (tool === 'give') {
    // 결과 화면: 그림 속 캐릭터 손 위치에 빼빼로를 그냥 쥐고 있기 (손 추가 없음)
    let [gx, gy, rot = 12] = r.hand || [75, 75];
    let len = 40;
    if (mirrorHand) { gx = 100 - gx; rot = -rot; } // 반대쪽 손으로 (가운데를 향하게)
    if (pose) ({ gx, gy, rot, len } = pose);
    const h = document.createElement('i');
    h.className = 'hold-stick';
    h.style.left = gx + '%'; h.style.top = gy + '%';
    h.style.height = len + '%';
    h.style.width = '10%';
    h.style.transform = `translate(-50%, -88%) rotate(${rot}deg)`;
    h.style.transformOrigin = '50% 88%';
    body.appendChild(h);
  } else if (tool) {
    const a = document.createElement('span');
    a.className = 'arm' + (flip ? ' flip' : '');
    a.dataset.act = c.act;
    a.innerHTML = `<span class="arm-in"><img class="tool" src="assets/ui/tools/${c.act}.png" alt="" draggable="false"><i class="paw"></i><i class="fx"></i></span>`;
    body.appendChild(a);
  }
  rig.appendChild(body);
  return rig;
}

export function peperoEl(p) {
  return fallbackImg(peperoSrcs(p.id), () => peperoPlaceholder(p), p.name, 'pepero-img');
}

// 캔버스용: 첫 번째로 로딩되는 이미지 반환 (없으면 null)
export function loadFirst(srcs) {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= srcs.length) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => { i++; tryNext(); };
      img.src = srcs[i];
    };
    tryNext();
  });
}
