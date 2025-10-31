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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log("Firebase connected!");

// ========== ELEMENTS ==========
const MAX_PLAYER = 20;
const roleScreen = document.getElementById('role-screen');
const formScreen = document.getElementById('form-screen');
const statusEl = document.getElementById('status');
const btnPlayer = document.getElementById('btn-player');
const btnOrganizer = document.getElementById('btn-organizer');
const formTitle = document.getElementById('form-title');
const roleInput = document.getElementById('roleInput');
const regForm = document.getElementById('regForm');
const formMsg = document.getElementById('form-msg');
const backBtn = document.getElementById('backBtn');

let isPlayerFull = false;

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

// เรียกตอนเริ่มโหลดเว็บ
checkPlayerCount();

// ========== เปิดฟอร์มแต่ละบทบาท ==========
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

// ========== บันทึกข้อมูลลง Firestore ==========
regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.textContent = 'กำลังบันทึก...';

  const formData = new FormData(regForm);
  const role = formData.get('role');
  const email = formData.get('email');
  const studentId = formData.get('studentId');
  const fullname = formData.get('fullname');
  const note = formData.get('note');

  try {
    // กันรอบสุดท้ายก่อนเพิ่ม
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
      studentId,
      fullname,
      note,
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
