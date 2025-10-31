document.addEventListener('DOMContentLoaded', () => {
  // 1) Firebase init
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

  // 2) เอา element ตามที่มีใน HTML นี้
  const ADMIN_CODE = '0826940174';

  // user
  const userLoginScreen = document.getElementById('user-login-screen');
  const userFormScreen = document.getElementById('user-form-screen');
  const userLoginInput = document.getElementById('user-student-id');
  const userLoginBtn = document.getElementById('user-login-btn');
  const userLoginMsg = document.getElementById('user-login-msg');
  const dynamicForm = document.getElementById('dynamic-form');
  const userFormMsg = document.getElementById('user-form-msg');
  const userLogoutBtn = document.getElementById('user-logout-btn');

  // admin
  const adminLoginScreen = document.getElementById('admin-login-screen');
  const adminMenuScreen = document.getElementById('admin-menu-screen');
  const adminFormEditorScreen = document.getElementById('admin-form-editor-screen');
  const adminUsersScreen = document.getElementById('admin-users-screen');

  const goAdminLoginBtn = document.getElementById('go-admin-login');
  const backToUserBtn = document.getElementById('back-to-user');

  const adminCodeInput = document.getElementById('admin-code');
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminLoginMsg = document.getElementById('admin-login-msg');

  const adminEditFormBtn = document.getElementById('admin-edit-form-btn');
  const adminViewUsersBtn = document.getElementById('admin-view-users-btn');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');

  const adminFormList = document.getElementById('admin-form-list');
  const newQuestionLabel = document.getElementById('new-question-label');
  const newQuestionType = document.getElementById('new-question-type');
  const newQuestionOptions = document.getElementById('new-question-options');
  const addQuestionBtn = document.getElementById('add-question-btn');
  const adminFormMsg = document.getElementById('admin-form-msg');

  const adminUsersList = document.getElementById('admin-users-list');
  const adminUsersMsg = document.getElementById('admin-users-msg');

  const backToAdminMenu1 = document.getElementById('back-to-admin-menu-1');
  const backToAdminMenu2 = document.getElementById('back-to-admin-menu-2');

  // state
  let currentStudentId = null;
  let currentQuestions = [];

  // helpers
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // ===============================
  // USER FLOW
  // ===============================

  // ผู้ใช้กดเข้าสู่แบบฟอร์ม
  if (userLoginBtn) {
    userLoginBtn.addEventListener('click', async () => {
      const sid = (userLoginInput.value || '').trim();
      if (!sid) {
        userLoginMsg.textContent = 'กรุณากรอกรหัสนักศึกษา';
        return;
      }
      currentStudentId = sid;
      userLoginMsg.textContent = '';

      hide(userLoginScreen);
      show(userFormScreen);

      await loadFormForUser();
    });
  }

  // ผู้ใช้ออกจากระบบ
  if (userLogoutBtn) {
    userLogoutBtn.addEventListener('click', () => {
      currentStudentId = null;
      userLoginInput.value = '';
      hide(userFormScreen);
      show(userLoginScreen);
    });
  }

  // โหลดคำถามจาก Firestore แล้วสร้างฟอร์ม
  async function loadFormForUser() {
    if (!dynamicForm) return;
    dynamicForm.innerHTML = 'กำลังโหลดแบบฟอร์ม...';

    const snap = await db.collection('form_questions').orderBy('order').get();
    currentQuestions = [];
    const frag = document.createDocumentFragment();

    snap.forEach(doc => {
      const q = doc.data();
      q.id = doc.id;
      currentQuestions.push(q);

      const wrap = document.createElement('div');
      wrap.className = 'dynamic-field';

      const label = document.createElement('label');
      label.textContent = q.label || '(ไม่มีชื่อคำถาม)';
      wrap.appendChild(label);

      if (q.type === 'select') {
        const sel = document.createElement('select');
        sel.name = q.id;
        (q.options || []).forEach(op => {
          const opt = document.createElement('option');
          opt.value = op;
          opt.textContent = op;
          sel.appendChild(opt);
        });
        wrap.appendChild(sel);
      } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.name = q.id;
        wrap.appendChild(inp);
      }

      frag.appendChild(wrap);
    });

    dynamicForm.innerHTML = '';
    dynamicForm.appendChild(frag);

    // ปุ่ม submit
    let submitBtn = document.getElementById('user-submit-form');
    if (!submitBtn) {
      submitBtn = document.createElement('button');
      submitBtn.id = 'user-submit-form';
      submitBtn.textContent = 'ส่งแบบฟอร์ม';
      submitBtn.className = 'primary';
      dynamicForm.appendChild(submitBtn);
    }

    submitBtn.onclick = submitUserForm;
  }

  async function submitUserForm(e) {
    e.preventDefault?.();
    if (!currentStudentId) {
      userFormMsg.textContent = 'กรุณาเข้าสู่ระบบก่อน';
      return;
    }

    const answers = {};
    currentQuestions.forEach(q => {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      answers[q.id] = el ? el.value : '';
    });

    try {
      await db.collection('registrations').add({
        studentId: currentStudentId,
        answers,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      userFormMsg.textContent = 'ส่งแบบฟอร์มเรียบร้อย ✅';
    } catch (err) {
      console.error(err);
      userFormMsg.textContent = 'ส่งแบบฟอร์มไม่สำเร็จ ❌';
    }
  }

  // ===============================
  // ADMIN FLOW
  // ===============================

  // ไปหน้าแอดมินจากหน้าผู้ใช้
  if (goAdminLoginBtn) {
    goAdminLoginBtn.addEventListener('click', () => {
      hide(userLoginScreen);
      show(adminLoginScreen);
    });
  }

  // กลับไปผู้ใช้จากหน้าแอดมิน
  if (backToUserBtn) {
    backToUserBtn.addEventListener('click', () => {
      hide(adminLoginScreen);
      show(userLoginScreen);
    });
  }

  // แอดมิน login
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => {
      const code = (adminCodeInput.value || '').trim();
      if (code === ADMIN_CODE) {
        adminLoginMsg.textContent = '';
        hide(adminLoginScreen);
        show(adminMenuScreen);
      } else {
        adminLoginMsg.textContent = 'รหัสไม่ถูกต้อง';
      }
    });
  }

  // แอดมินออก
  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', () => {
      adminCodeInput.value = '';
      hide(adminMenuScreen);
      hide(adminFormEditorScreen);
      hide(adminUsersScreen);
      show(userLoginScreen);
    });
  }

  // ไปหน้าแก้ฟอร์ม
  if (adminEditFormBtn) {
    adminEditFormBtn.addEventListener('click', async () => {
      hide(adminMenuScreen);
      show(adminFormEditorScreen);
      await loadAdminFormList();
    });
  }

  // ไปหน้าดูผู้ใช้
  if (adminViewUsersBtn) {
    adminViewUsersBtn.addEventListener('click', async () => {
      hide(adminMenuScreen);
      show(adminUsersScreen);
      await loadAdminUsers();
    });
  }

  // ย้อนจากแก้ฟอร์ม
  if (backToAdminMenu1) {
    backToAdminMenu1.addEventListener('click', () => {
      hide(adminFormEditorScreen);
      show(adminMenuScreen);
    });
  }

  // ย้อนจากดูผู้ใช้
  if (backToAdminMenu2) {
    backToAdminMenu2.addEventListener('click', () => {
      hide(adminUsersScreen);
      show(adminMenuScreen);
    });
  }

  // โหลดรายการคำถามให้แอดมินดู
  async function loadAdminFormList() {
    if (!adminFormList) return;
    adminFormList.innerHTML = 'กำลังโหลด...';
    const snap = await db.collection('form_questions').orderBy('order').get();
    const items = [];
    snap.forEach(doc => {
      const d = doc.data();
      items.push(`
        <div class="admin-item">
          <strong>${d.label || '(ไม่มีชื่อ)'}</strong>
          <span class="badge">${d.type}</span>
          ${d.options && d.options.length ? `<div>ตัวเลือก: ${d.options.join(', ')}</div>` : ''}
        </div>
      `);
    });
    adminFormList.innerHTML = items.join('') || '<p>ยังไม่มีคำถาม</p>';
  }

  // แอดมินเพิ่มคำถาม
  if (addQuestionBtn) {
    addQuestionBtn.addEventListener('click', async () => {
      const label = (newQuestionLabel.value || '').trim();
      const type = newQuestionType.value;
      const optionsRaw = (newQuestionOptions.value || '').trim();

      if (!label) {
        adminFormMsg.textContent = 'กรุณาใส่ชื่อคำถาม';
        return;
      }

      // หา order ล่าสุด
      const lastSnap = await db.collection('form_questions').orderBy('order', 'desc').limit(1).get();
      let nextOrder = 1;
      lastSnap.forEach(doc => {
        const d = doc.data();
        nextOrder = (d.order || 0) + 1;
      });

      const data = {
        label,
        type,
        order: nextOrder
      };

      if (type === 'select' && optionsRaw) {
        data.options = optionsRaw.split(',').map(s => s.trim()).filter(Boolean);
      }

      await db.collection('form_questions').add(data);
      adminFormMsg.textContent = 'เพิ่มคำถามสำเร็จ ✅';

      newQuestionLabel.value = '';
      newQuestionOptions.value = '';

      await loadAdminFormList();
    });
  }

  // โหลดข้อมูลผู้สมัคร
  async function loadAdminUsers() {
    if (!adminUsersList) return;
    adminUsersList.innerHTML = 'กำลังโหลด...';

    // โหลดคำถามทั้งหมดมาก่อน เพื่อแปลง id -> label
    const qSnap = await db.collection('form_questions').orderBy('order').get();
    const questionsMap = {};
    qSnap.forEach(doc => {
      questionsMap[doc.id] = doc.data();
    });

    const snap = await db.collection('registrations').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      adminUsersList.innerHTML = '<p>ยังไม่มีคนส่งแบบฟอร์ม</p>';
      return;
    }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data();
      const ans = d.answers || {};
      const sid = d.studentId || '-';
      const time = d.createdAt ? d.createdAt.toDate().toLocaleString('th-TH') : '';

      const ansHtml = Object.keys(ans).map(qid => {
        const q = questionsMap[qid];
        const label = q ? q.label : qid;
        return `<div><strong>${label}</strong>: ${ans[qid]}</div>`;
      }).join('');

      rows.push(`
        <div class="admin-item">
          <div><strong>รหัส นศ.:</strong> ${sid}</div>
          <div style="font-size:12px;color:#777">${time}</div>
          <div>${ansHtml}</div>
        </div>
      `);
    });

    adminUsersList.innerHTML = rows.join('');
  }
});
