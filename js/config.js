// =====================================================================
//  하뀨하의 우당탕탕 빼빼로 공장 — 설정 파일
//  ★ 이 파일만 고치면 대부분의 설정을 바꿀 수 있어요.
// =====================================================================

export const CONFIG = {
  // ---------------------------------------------------------------
  // 1) Supabase 연결 정보 (README 3단계 참고)
  //    두 값이 비어 있으면 자동으로 "데모 모드"로 동작해요.
  //    (데모 모드 = 서버 없음, 실제 경품 없음, 화면에 DEMO 표시)
  // ---------------------------------------------------------------
  SUPABASE_URL: 'https://wfqdxscrnodezylyngnx.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_cKlicAOMpUYSvY69lBeisg_U92vpo6H',
                           // (공개용 키예요. service_role / secret 키는 절대 넣지 마세요!)

  // 추첨 서버(Edge Function) 이름 — Supabase에 배포한 함수 이름과 같아야 해요
  DRAW_FUNCTION: 'bright-endpoint',

  // X 로그인 제공자 이름. Supabase 대시보드에서 켠 제공자에 맞춰 주세요.
  //  - "Twitter (Deprecated)" 를 켰다면 'twitter'
  //  - "X / Twitter (OAuth 2.0)" 를 켰다면 'x'
  X_PROVIDER: 'x',

  // (선택) Cloudflare Turnstile 사이트 키. 비워 두면 사용 안 함.
  TURNSTILE_SITE_KEY: '',

  // 운영자 X 계정 (관리자 페이지에서 바꾸면 그 값이 우선)
  X_LINK: 'https://x.com/',

  // 제작 연출 한 단계 길이(ms). 8단계 × 1500ms = 약 12초
  MAKING_STEP_MS: 1500,

  // 하뀨하들에게 요리사 모자 씌우기 (false 로 하면 모자 없음)
  CHEF_HAT: true,

  // 실제로 넣어 둔 캐릭터 상태 이미지 목록
  //   work.png / happy.png / done.png 를 추가했다면 여기에도 적어 주세요. 예: ['idle', 'work', 'happy']
  //   (목록에 없는 상태는 그림을 바꾸지 않아서 깜빡임이 없어요)
  CHARACTER_STATES: ['idle'],

  // 캐릭터 이미지 확장자 (assets/characters/<id>/<상태>.png)
  IMAGE_EXT: 'png',

  // ---------------------------------------------------------------
  // 2) 캐릭터 8마리 — 순서 = 제작 순서
  //    이미지: assets/characters/<id>/idle.png  (기본)
  //                                  work.png  (작업 중, 없으면 idle 사용)
  //                                  happy.png (기쁨,   없으면 idle 사용)
  //                                  done.png  (완료,   없으면 idle 사용)
  // ---------------------------------------------------------------
  // rig: 요리사 모자·손 위치 (캐릭터 그림 기준 %)
  //   hat: [가로 중심, 위치(위쪽), 너비, 기울기(도)]
  //   arm: [손 가로 위치, 세로 위치]  (제작 화면에서 도구 든 손)
  //   hand: [그림 속 손 가로, 세로, 빼빼로 기울기]  (결과 화면에서 빼빼로를 쥐는 위치)
  //   paw: 손 색
  //   (쭈일리언은 머리 위 하늘이에게 모자를 씌웠어요)
  CHARACTERS: [
    { id: 'juilien',        name: '쭈일리언', task: '초콜릿 녹이기', line: '휘휘~',                 act: 'stir',     fx: '🍫', paw: '#dda6dd', rig: { hat: [49, 3, 34, 0],   arm: [84, 62], hand: [86, 64, 12] } },
    { id: 'jjujebi',        name: '쮸제비',   task: '빼빼로 담그기', line: '어어?! 흘렸다!',        act: 'drip',     fx: '💧', paw: '#ffffff', rig: { hat: [44, 6, 54, -6],  arm: [76, 66], hand: [64, 74, 32] } },
    { id: 'bingping',       name: '빙핑',     task: '토핑 뿌리기',   line: '토핑 팡팡!',            act: 'sprinkle', fx: '✨', paw: '#fbf2be', rig: { hat: [50, 24, 58, 0],  arm: [84, 60], hand: [70, 80, 14] } },
    { id: 'toramwi',        name: '토라뮈',   task: '굳히기',        line: '조금만 기다려~',        act: 'wait',     fx: '❄️', paw: '#ffffff', rig: { hat: [50, 36, 50, 0],  arm: [80, 70], hand: [78, 82, 12] } },
    { id: 'stelnyang',      name: '스텔냥',   task: '품질 검사',     line: '검사 완료!',            act: 'inspect',  fx: '🔍', paw: '#ffffff', rig: { hat: [50, 6, 52, 8],   arm: [80, 66], hand: [74, 84, 16] } },
    { id: 'nosungi',        name: '노숭이',   task: '상자 담기',     line: '차곡차곡!',             act: 'stack',    fx: '📦', paw: '#fadcb6', rig: { hat: [50, 6, 56, 0],   arm: [84, 66], hand: [66, 76, 26] } },
    { id: 'jungddangkong',  name: '정땅콩',   task: '포장 꾸미기',   line: '이렇게 꾸미면 되겠다!', act: 'sticker',  fx: '⭐', paw: '#fde3c0', rig: { hat: [48, 4, 46, -4],  arm: [80, 56], hand: [67, 58, 34] } },
    { id: 'alssonghamsong', name: '알쏭햄쏭', task: '리본 묶기',     line: '완성!',                 act: 'ribbon',   fx: '🎀', paw: '#ffee76', rig: { hat: [50, 4, 58, 0],   arm: [86, 62], hand: [80, 74, 14] } },
  ],

  // 결과 화면: 하뀨하들이 빼빼로를 들고 다 같이 치얼스(짠!) 하는 장면
  //   (빼빼로 각도는 자동으로 가운데 '짠!' 지점을 향해요)
  //   x: 가로 중심(%), y: 바닥에서 높이(%), s: 크기(%), 뒷줄이 먼저
  //   hand: (선택) 이 장면에서만 쓸 손 위치
  SHARE_SCENE: [
    { id: 'toramwi',        x: 15, y: 44, s: 26 },
    { id: 'stelnyang',      x: 38, y: 47, s: 26 },
    { id: 'jjujebi',        x: 62, y: 47, s: 26 },
    { id: 'alssonghamsong', x: 85, y: 44, s: 26 },
    { id: 'juilien',        x: 15, y: 3,  s: 28 },
    { id: 'bingping',       x: 38, y: 0,  s: 28 },
    { id: 'nosungi',        x: 62, y: 0,  s: 28, hand: [26, 78] },
    { id: 'jungddangkong',  x: 85, y: 3,  s: 28 },
  ],

  // ---------------------------------------------------------------
  // 3) 빼빼로 종류 — 사진: assets/pepero/<id>.png (또는 .jpg / .webp)
  //    사진이 없으면 그림 플레이스홀더가 나와요.
  //    id는 영문 소문자/숫자/-/_ 만 사용하세요.
  // ---------------------------------------------------------------
  PEPEROS: [
    { id: 'original',    name: '오리지널 초코 빼빼로', coat: '#6B3E2E', dots: '' },
    { id: 'almond',      name: '아몬드 빼빼로',        coat: '#7A4A33', dots: '#E9C79A' },
    { id: 'whitecookie', name: '화이트 쿠키 빼빼로',   coat: '#FFFDF8', dots: '#3B2A25' },
    { id: 'strawberry',  name: '딸기 빼빼로',          coat: '#FFB3C8', dots: '#FF7FA6' },
  ],

  // ---------------------------------------------------------------
  // 4) 기본 문구 (관리자 페이지에서 수정하면 그 값이 우선)
  // ---------------------------------------------------------------
  TEXTS: {
    greeting1: '어서 와! 하뀨하 빼빼로 공장에!',
    greeting2: '오늘은 하뀨하들이 특별한 선물을 준비했대!',
    loseTitle: '하뀨하의 달콤한 선물이 도착했어요!',
    loseMsg: '실제 빼빼로는 아니지만, 하뀨하들의 마음을 받아줘! 💜',
    winTitle: '🎉 축하합니다!',
    winMsg: '하뀨하가 준비한 진짜 빼빼로에 당첨됐어요!',
    prizeName: '🎁 빼빼로 기프티콘 당첨!',
    howToClaim: '아래 칸에 기프티콘을 받을 X 아이디를 적어 보내 주세요.\n운영자 계정에서 그 아이디로 DM을 보내 드려요.\n※ DM을 받을 수 있게 열어 두거나 운영자 계정을 팔로우해 주세요.\n※ X 아이디 말고 다른 개인정보는 받지 않아요.',
    cardMsg: 'HAPPY PEPERO DAY! 하뀨하들이 마음을 담아 만들었어요 💜',
  },
};
