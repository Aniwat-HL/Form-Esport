// ========== CONFIG FIREBASE ==========
const firebaseConfig = {
  apiKey: "AIzaSyBqnVyK9BeJqMKuyYCqXzGOd1-07eEltEI",
  authDomain: "form-esport.firebaseapp.com",
  projectId: "form-esport",
  storageBucket: "form-esport.firebasestorage.app",
  messagingSenderId: "846451064511",
  appId: "1:846451064511:web:67cdec6e10d527396a900a",
  measurementId: "G-GQZ8RK4JTC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log("Firebase connected!");

// ========== CONST / ELEMENT ==========
const MAX_PLAYER = 20;
const ADMIN_STUDENT_ID = '0826940174';

// screens
const loginScreen = document.getElementById('login-screen');
const roleScreen = document.getElementById('role-screen');
const formScreen = document.getElementById('form-screen');
const adminScreen = document.getElementById('admin-screen');

const statusEl = document.getElementById('status');
const btnPlayer = document.getElementById('btn-player');
const btnOrganizer = document.getElementById('btn-organizer');
const backBtn = document.getElementById('backBtn');
const logoutBtn = document.getElementById('logout-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');

const formTitle = document.getElementById('form-title');
const roleInput = document.getElementById('roleInput');
const regForm = document.getElementById('regForm');
const formMsg = document.getElementById('form-msg');
const currentStudentIdInput = document.getElementById('currentStudentId');

const loginInput = document.getElementById('login-student-id');
const loginBtn = document.getElementById('login-btn');
const loginMsg = document.getElementById('login-msg');

const adminList = document.getElementById('admin-list');

let isPlayerFull = false;
let currentStudentId = null;

// ========== LOGIN FLOW ==========
loginBtn.addEventListener('click', async () => {
  const sid = (loginInput.value || '').trim();
  if (!sid) {
    loginMsg.textContent = 'กรุณากรอกรหัสนักศึกษา';
    return;
  }

  currentStudentId = sid;
  currentStudentIdInput.value = sid; // เก็บไปกับฟอร์มด้วย

  if (sid === ADMIN_STUDENT_ID) {
    // ไปหน้า admin
    loginScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    loadAdminList();
  } else {
    // ไปหน้าเลือกบทบาท
    loginScreen.classList.add('hidden');
    roleScreen.classList.remove('hidden');
    checkPlayerCount(); // เช็กจำนวนผู้แข่งด้วย
  }
});

// ออกจากระบบ (หน้าผู้ใช้)
logoutBtn.addEventListener('click', () => {
  currentStudentId = null;
  loginInput.value = '';
  roleScreen.classList.add('hidden');
  formScreen.classList.add('hidden');
  adminScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
});

// ออกจากระบบ (หน้าแอดมิน)
adminLogoutBtn.addEventListener('click', () => {
  currentStudentId = null;
  loginInput.value = '';
  adminScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
});

// ========== CHECK PLAYER COUNT ==========
async function checkPlayerCount() {
  statusEl.textContent = 'กำลังเช็กจำนวนผู้แข่ง...';
  try {
    const snap = await db.collection('registrations')
      .where('role', '==', 'player')
      .get();

    const count = snap.size;
    if (count >= MAX_PLAYER) {
      isPlayerFull = true;
      statusEl.textContent = `ผู้แข่งครบแล้ว (${count}/${MAX_PLAYER}) เลือกเป็นผู้จัดงานแทน`;
      btnPlayer.disabled = true;
    } else {
      isPlayerFull = false;
      statusEl.textContent = `ผู้แข่งยังสมัครได้ (${count}/${MAX_PLAYER})`;
      btnPlayer.disabled = false;
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'เช็กจำนวนไม่สำเร็จ ❌';
  }
}

// ========== OPEN FORM ==========
btnPlayer.addEventListener('click', () => {
  if (isPlayerFull) {
    alert('ผู้แข่งครบแล้ว เลือกเป็นผู้จัดงานแทน');
    return;
  }
  openForm('player', 'ฟอร์มสมัครเป็นผู้แข่ง');
});

btnOrganizer.addEventListener('click', () => {
  openForm('organizer', 'ฟอร์มสมัครเป็นผู้จัดงาน');
});

backBtn.addEventListener('click', () => {
  formScreen.classList.add('hidden');
  roleScreen.classList.remove('hidden');
  formMsg.textContent = '';
  regForm.reset();
});

function openForm(role, title) {
  roleInput.value = role;
  formTitle.textContent = title;
  roleScreen.classList.add('hidden');
  formScreen.classList.remove('hidden');
}

// ========== SUBMIT FORM ==========
regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.textContent = 'กำลังบันทึก...';

  const formData = new FormData(regForm);
  const role = formData.get('role');
  const email = formData.get('email');
  const fullname = formData.get('fullname');
  const note = formData.get('note');
  const studentId = currentStudentIdInput.value || currentStudentId || '';

  try {
    // กันซ้ำตอนเป็นผู้แข่ง
    if (role === 'player') {
      const snap = await db.collection('registrations')
        .where('role', '==', 'player')
        .get();
      if (snap.size >= MAX_PLAYER) {
        formMsg.textContent = 'ผู้แข่งครบแล้ว ส่งไม่ได้ ❌';
        await checkPlayerCount();
        return;
      }
    }

    await db.collection('registrations').add({
      role,
      email,
      fullname,
      note,
      studentId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    formMsg.textContent = 'ส่งข้อมูลสำเร็จ ✅';
    regForm.reset();
    await checkPlayerCount();
  } catch (err) {
    console.error(err);
    formMsg.textContent = 'บันทึกไม่สำเร็จ ❌';
  }
});

// ========== ADMIN: LOAD LIST ==========
async function loadAdminList() {
  adminList.innerHTML = 'กำลังโหลด...';
  try {
    const snap = await db.collection('registrations')
      .orderBy('createdAt', 'desc')
      .get();

    if (snap.empty) {
      adminList.innerHTML = '<p>ยังไม่มีข้อมูล</p>';
      return;
    }

    const frags = [];
    snap.forEach(doc => {
      const d = doc.data();
      const role = d.role || '-';
      const fullname = d.fullname || '-';
      const email = d.email || '-';
      const sid = d.studentId || '-';
      const time = d.createdAt ? d.createdAt.toDate().toLocaleString('th-TH') : '';

      frags.push(`
        <div class="admin-item">
          <div><strong>${fullname}</strong> (${sid})</div>
          <div>${email}</div>
          <div>
            บทบาท: ${role === 'player' ? 'ผู้แข่ง' : 'ผู้จัดงาน'}
            <span class="badge ${role === 'player' ? 'player' : 'organizer'}">
              ${role === 'player' ? 'PLAYER' : 'ORGANIZER'}
            </span>
          </div>
          <div style="font-size:12px;color:#777">${time}</div>
        </div>
      `);
    });

    adminList.innerHTML = frags.join('');
  } catch (err) {
    console.error(err);
    adminList.innerHTML = '<p>โหลดข้อมูลไม่สำเร็จ ❌</p>';
  }
}
