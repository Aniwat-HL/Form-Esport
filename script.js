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

console.log('Firebase connected!');

const btnOrganizer = document.getElementById('btn-organizer');
const roleScreen = document.getElementById('role-screen');
const formScreen = document.getElementById('form-screen');
const formTitle = document.getElementById('form-title');
const roleInput = document.getElementById('roleInput');
const regForm = document.getElementById('regForm');
const formMsg = document.getElementById('form-msg');
const backBtn = document.getElementById('backBtn');

btnPlayer.addEventListener('click', () => {
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

regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.textContent = 'กำลังบันทึก...';

  const formData = new FormData(regForm);
  const role = formData.get('role');
  const email = formData.get('email');
  const studentId = formData.get('studentId');
  const fullname = formData.get('fullname');

  // กันชนรอบสุดท้าย
  if (role === 'player') {
    const snap = await db.collection('registrations')
      .where('role', '==', 'player')
      .get();
    if (snap.size >= MAX_PLAYER) {
      formMsg.textContent = 'ผู้แข่งครบแล้ว ส่งไม่ได้';
      await checkPlayerCount();
      return;
    }
  }

  await db.collection('registrations').add({
    role,
    email,
    studentId,
    fullname,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  formMsg.textContent = 'ส่งเรียบร้อย ✅';
  regForm.reset();
  // อัปเดตหน้าแรกเผื่อคนอื่นจะสมัครต่อ
  await checkPlayerCount();
});
