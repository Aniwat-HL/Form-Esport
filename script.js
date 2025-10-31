// ===== CONFIG =====
const GITHUB_OWNER = 'YOUR_GITHUB_USERNAME';
const GITHUB_REPO = 'YOUR_REPO_NAME';
const MAX_PLAYER = 20;

// ⛔ สำหรับ demo เท่านั้น อย่าใส่ token แบบนี้ถ้า repo สาธารณะ
const GITHUB_TOKEN = 'ghp_xxxxxxxxxxxxxxxxxxxxx';

// API endpoints
const ISSUES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;

const statusEl = document.getElementById('status');
const btnPlayer = document.getElementById('btn-player');
const btnOrganizer = document.getElementById('btn-organizer');
const roleScreen = document.getElementById('role-screen');
const formScreen = document.getElementById('form-screen');
const formTitle = document.getElementById('form-title');
const roleInput = document.getElementById('roleInput');
const regForm = document.getElementById('regForm');
const formMsg = document.getElementById('form-msg');
const backBtn = document.getElementById('backBtn');

let isPlayerFull = false;

// ดึง issue ทั้งหมด แล้วดูว่ามีกี่ issue ที่เป็น role = ผู้แข่ง
async function loadCount() {
  statusEl.textContent = 'กำลังเช็กจำนวน...';

  const res = await fetch(ISSUES_URL + '?state=open&per_page=100', {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`
    }
  });

  const issues = await res.json();

  // เราจะเก็บ role ไว้ใน label หรือใน body ก็ได้
  const players = issues.filter(iss => iss.labels.some(l => l.name === 'player'));
  const count = players.length;

  if (count >= MAX_PLAYER) {
    isPlayerFull = true;
    statusEl.textContent = `ผู้แข่งครบแล้ว (${count}/${MAX_PLAYER})`;
    btnPlayer.disabled = true;
    btnPlayer.classList.add('disabled');
  } else {
    statusEl.textContent = `ผู้แข่งยังสมัครได้ (${count}/${MAX_PLAYER})`;
    btnPlayer.disabled = false;
  }
}

loadCount().catch(err => {
  console.error(err);
  statusEl.textContent = 'โหลดไม่ได้';
});

// เปิดฟอร์มผู้แข่ง
btnPlayer.addEventListener('click', () => {
  if (isPlayerFull) return;
  openForm('ผู้แข่ง');
});

// เปิดฟอร์มผู้จัด
btnOrganizer.addEventListener('click', () => {
  openForm('ผู้จัดงาน');
});

backBtn.addEventListener('click', () => {
  formScreen.classList.add('hidden');
  roleScreen.classList.remove('hidden');
  formMsg.textContent = '';
  regForm.reset();
});

function openForm(role) {
  roleScreen.classList.add('hidden');
  formScreen.classList.remove('hidden');
  roleInput.value = role;
  formTitle.textContent = role === 'ผู้แข่ง'
    ? 'ฟอร์มสมัครเป็นผู้แข่งขัน'
    : 'ฟอร์มสมัครเป็นผู้จัดงาน';
}

// ส่งฟอร์ม → สร้าง issue ใหม่ใน repo
regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.textContent = 'กำลังส่ง...';

  const formData = new FormData(regForm);
  const role = formData.get('role');
  const email = formData.get('email');
  const studentId = formData.get('studentId');
  const fullname = formData.get('fullname');

  // กันชน: ถ้า role = ผู้แข่ง แต่หน้าเว็บบอกว่าเต็มแล้ว → หยุด
  if (role === 'ผู้แข่ง' && isPlayerFull) {
    formMsg.textContent = 'ผู้แข่งครบแล้ว เลือกเป็นผู้จัดงานแทน';
    return;
  }

  const body = `
อีเมล: ${email}
รหัสนักศึกษา: ${studentId}
ชื่อ-นามสกุล: ${fullname}
บทบาท: ${role}
  `.trim();

  const res = await fetch(ISSUES_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `${role} - ${fullname}`,
      body: body,
      labels: [ role === 'ผู้แข่ง' ? 'player' : 'organizer' ]
    })
  });

  if (res.ok) {
    formMsg.textContent = 'ส่งเรียบร้อย ✅';
    regForm.reset();
    // โหลดจำนวนใหม่
    loadCount();
  } else {
    formMsg.textContent = 'ส่งไม่สำเร็จ ❌';
  }
});
