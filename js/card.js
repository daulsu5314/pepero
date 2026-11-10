// 결과 카드 PNG 만들기 (외부 라이브러리 없이 canvas로 직접 그림)
import { charSrcs, peperoSrcs, prizeSrcs, loadFirst, cheerPose, CHEER_POINT, SCENE_ASPECT } from './assets.js';
import { CONFIG } from './config.js';

const C = { purple: '#C8A2E8', purpleD: '#9A6FC4', ink: '#4A2F5E', cream: '#FFF4E5', pink: '#FFBBD5', white: '#FFFDF8', gold: '#FFD866', red: '#B3261E' };
const FONT = "'Galmuri11', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function box(ctx, x, y, w, h, fill, r = 24, line = 8) {
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = line; ctx.strokeStyle = C.ink; ctx.stroke();
}
function text(ctx, str, x, y, size, color = C.ink, weight = '700') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}
function wrap(ctx, str, x, y, maxW, size, lh, color = C.ink) {
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
      else line += ch;
    }
    lines.push(line);
  }
  lines.forEach((l, i) => text(ctx, l, x, y + i * lh, size, color, '400'));
  return lines.length * lh;
}
function contain(ctx, img, x, y, w, h, smooth = true) {
  const r = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.imageSmoothingEnabled = true;
}

export async function makeResultPng({ result, pepero, characters, texts }) {
  try { await document.fonts.load(`700 40px Galmuri11`); } catch {}
  const W = 1080, H = 1730;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const isWin = result.status === 'win';

  // 배경 + 격자
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#F3DFC4'; ctx.lineWidth = 3;
  for (let i = 0; i < W; i += 60) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
  for (let i = 0; i < H; i += 60) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

  // 프레임
  ctx.lineWidth = 16; ctx.strokeStyle = C.ink; ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.lineWidth = 12; ctx.strokeStyle = isWin ? C.gold : C.purple; ctx.strokeRect(26, 26, W - 52, H - 52);

  // 헤더
  box(ctx, 70, 60, W - 140, 150, C.purple, 28);
  text(ctx, '하뀨하의 우당탕탕 빼빼로 공장', W / 2, 115, 50, C.white);
  text(ctx, 'HAPPY PEPERO DAY · 2026.11.11', W / 2, 172, 32, C.ink);

  // 제목
  text(ctx, isWin ? texts.winTitle : texts.loseTitle, W / 2, 280, 46);
  wrap(ctx, isWin ? texts.winMsg : texts.loseMsg, W / 2, 345, W - 200, 32, 44);

  // 빼빼로
  box(ctx, W / 2 - 190, 400, 380, 380, C.white, 28);
  const pimg = isWin ? (await loadFirst(prizeSrcs())) || (await loadFirst(peperoSrcs(pepero.id))) : await loadFirst(peperoSrcs(pepero.id));
  if (pimg) {
    ctx.save(); rrect(ctx, W / 2 - 184, 406, 368, 368, 24); ctx.clip();
    contain(ctx, pimg, W / 2 - 184, 406, 368, 368); ctx.restore();
  } else {
    // 간단한 막대 그림
    [-70, 0, 70].forEach((dx, i) => {
      ctx.save(); ctx.translate(W / 2 + dx, 590); ctx.rotate((i - 1) * 0.2);
      box(ctx, -18, -150, 36, 230, pepero.coat || '#6B3E2E', 14, 6);
      box(ctx, -18, 60, 36, 70, '#E8C48A', 12, 6);
      ctx.restore();
    });
  }
  text(ctx, isWin ? (texts.prizeName || '🎁 빼빼로 기프티콘 당첨!') : pepero.name, W / 2, 815, 34, isWin ? '#F28DB2' : C.ink);

  // 하뀨하들이 옹기종기 모여 빼빼로 나눠 먹는 장면 (화면과 같은 배치)
  const hat = CONFIG.CHEF_HAT ? await loadFirst(['assets/ui/chef-hat.png']) : null;
  const SX = 80, SW = W - 160, SH = SW * SCENE_ASPECT, ST = 900, SB = ST + SH;
  // 돗자리
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(W / 2, SB - SH * 0.28, SW * 0.49, SH * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE3EE'; ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,187,213,.7)';
  for (let x = SX; x < SX + SW; x += 64) ctx.fillRect(x, SB - SH * 0.56, 32, SH * 0.56);
  for (let y = SB - SH * 0.56; y < SB; y += 64) ctx.fillRect(SX, y, SW, 32);
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(W / 2, SB - SH * 0.28, SW * 0.49, SH * 0.28, 0, 0, Math.PI * 2);
  ctx.lineWidth = 7; ctx.strokeStyle = C.ink; ctx.stroke();

  const coat = pepero.coat || '#6B3E2E';
  const stick = (x, y, w, h, rot) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180);
    rrect(ctx, -w / 2, -h * 0.88, w, h, w * 0.4);
    ctx.fillStyle = '#E8C48A'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = coat; ctx.fillRect(-w / 2, -h * 0.88, w, h * 0.66); ctx.restore();
    ctx.lineWidth = Math.max(3, w * 0.22); ctx.strokeStyle = '#3a1a1c';
    rrect(ctx, -w / 2, -h * 0.88, w, h, w * 0.4); ctx.stroke();
    ctx.restore();
  };
  for (const pos of CONFIG.SHARE_SCENE) {
    const c = characters.find((x) => x.id === pos.id);
    if (!c) continue;
    const w = SW * pos.s / 100, cx = SX + SW * pos.x / 100, bottom = SB - SH * pos.y / 100;
    const top = bottom - w, bx = cx - w / 2 + w * 0.11, by = top + w * 0.22, bw = w * 0.78;
    const img = await loadFirst(charSrcs(c.id, 'happy'));
    if (!img) continue;
    contain(ctx, img, bx, by, bw, bw, false);
    const r = c.rig || {};
    if (hat) {
      const [hx, hy, hw, hr] = r.hat || [50, 4, 60, 0];
      const hwpx = bw * hw / 100, hh = hwpx * hat.naturalHeight / hat.naturalWidth;
      ctx.save(); ctx.translate(bx + bw * hx / 100, by + bw * hy / 100); ctx.rotate(hr * Math.PI / 180);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(hat, -hwpx / 2, -hh * 0.78, hwpx, hh); ctx.restore();
    }
    const pose = cheerPose(c, pos);
    stick(bx + bw * pose.gx / 100, by + bw * pose.gy / 100, bw * 0.1, bw * pose.len / 100, pose.rot);
  }
  text(ctx, '다 같이 빼빼로로 짠! 🥂', W / 2, ST - 34, 30, '#F28DB2');

  // 하단: 당첨번호 or 메시지
  const by = 1530;
  if (isWin) {
    box(ctx, 110, by - 20, W - 220, 150, C.white, 24);
    text(ctx, result.demo ? '데모 당첨번호 (가짜)' : '고유 당첨번호', W / 2, by + 20, 28);
    text(ctx, result.win_code || '', W / 2, by + 80, 48);
  } else {
    wrap(ctx, texts.cardMsg, W / 2, by + 40, W - 220, 32, 44, C.purpleD);
  }

  // 데모 도장
  if (result.demo) {
    ctx.save(); ctx.translate(900, 600); ctx.rotate(0.14);
    box(ctx, -120, -55, 240, 110, C.red, 10, 7);
    text(ctx, 'DEMO', 0, -16, 40, '#fff');
    text(ctx, '실제 당첨 아님', 0, 26, 24, '#fff');
    ctx.restore();
  }

  return cv.toDataURL('image/png');
}
