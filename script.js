document.addEventListener('DOMContentLoaded', () => {
  // ===== 1. Firebase init =====
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

  // ===== 2. Const & elements =====
  const ADMIN_CODE = '0826940174';

  // user screens
  const userLoginScreen = document.getElementById('user-login-screen');
  const userFormScreen = document.getElementById('user-form-screen');
  const userLoginInput = document.getElementById('user-student-id');
  const userLoginBtn = document.getElementById('user-login-btn');
  const userLoginMsg = document.getElementById('user-login-msg');
  const dynamicForm = document.getElementById('dynamic-form');
  const userFormMsg = document.getElementById('user-form-msg');
  const userLogoutBtn = document.getElementById('user-logout-btn');

  // admin screens
  const adminLoginScreen = document.getElementById('admin-login-screen');
  const adminMenuScreen = document.getElementById('admin-menu-screen');
  const adminFormEditorScreen = document.getElementById('admin-form-editor-screen');
  const adminUsersScreen = document.getElementById('admin-users-screen');

  // buttons (อันนี้บางอันอาจไม่มี → ต้องเช็กก่อน)
  const goAdminLoginBtn = document.getElementById('go-admin-login');
  const backToUserBtn = document.getElementById('back-to-user');

  const adminCodeInput = document.getElementById('admin-code');
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminLoginMsg = document.getElementById('admin-login-msg');

  const adminEditFormBtn = document.getElementById('admin-edit-form-btn');
  const adminViewUsersBtn = document.getElementById('admin-view-users-btn');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');

  // admin form editor elems
  const adminFormList = document.getElementById('admin-form-list');
  const newQuestionLabel = document.getElementById('new-question-label');
  const newQuestionType = document.getElementById('new-question-type');
  const newQuestionOptions = document.getElementById('new-question-options');
  const addQuestionBtn = document.getElementById('add-question-btn');
  const adminFormMsg = document.getElementById('admin-form-msg');

  // admin users elems
  const adminUsersList = document.getElementById('admin-users-list');
  const adminUsersMsg = document.getElementById('admin-users-msg');

  // back buttons
  const backToAdminMenu1 = document.getElementById('back-to-admin-menu-1');
  const backToAdminMenu2 = document.getElementById('back-to-admin-menu-2');

  // state
  let currentStudentId = null;
  let currentQuestions = [];

  // helpers
  const show = el => el && el.classList.remove('hidden');
  const hide = el => el && el.classList.add('hidden');

  // =========================
  // 4. USER FLOW
  // =========================
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

  if (userLogoutBtn) {
    userLogoutBtn.addEventListener('click', () => {
      currentStudentId = null;
      if (userLoginInput) userLoginInput.value = '';
      hide(userFormScreen);
      show(userLoginScreen);
    });
  }

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

      const field = document.createElement('div');
      field.className = 'dynamic-field';

      const label = document.createElement('label');
      label.textContent = q.label || '(ไม่มีชื่อคำถาม)';
      field.appendChild(label);

      if (q.type === 'select') {
        const select = document.createElement('select');
        select.name = q.id;
        (q.options || []).forEach(opt => {
          const op = document.createElement('option');
          op.value = opt;
          op.textContent = opt;
          select.appendChild(op);
        });
        field.appendChild(select);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.name = q.id;
        field.appendChild(input);
      }

      frag.appendChild(field);
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
      if (userFormMsg) userFormMsg.textContent = 'กรุณาเข้าสู่ระบบก่อน';
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

      if (userFormMsg) userFormMsg.textContent = 'ส่งแบบฟอร์มเรียบร้อย ✅';
    } catch (err) {
      console.error(err);
      if (userFormMsg) userFormMsg.textContent = 'ส่งแบบฟอร์มไม่สำเร็จ ❌';
    }
  }

  // =========================
  // 5. ADMIN FLOW
  // =========================

  // ไปหน้าแอดมินจากหน้า user
  if (goAdminLoginBtn) {
    goAdminLoginBtn.addEventListener('click', () => {
      hide(userLoginScreen);
      show(adminLoginScreen);
    });
  }

  // กลับไป user จากหน้าแอดมิน login
  if (backToUserBtn) {
    backToUserBtn.addEventListener('click', () => {
      hide(adminLoginScreen);
      show(userLoginScreen);
    });
  }

  // แอดมินกด login
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => {
      const code = (adminCodeInput.value || '').trim();
      if (code === ADMIN_CODE) {
        if (adminLoginMsg) adminLoginMsg.textContent = '';
        hide(adminLoginScreen);
        show(adminMenuScreen);
      } else {
        if (adminLoginMsg) adminLoginMsg.textContent = 'รหัสไม่ถูกต้อง';
      }
    });
  }

  // ออกจากระบบแอดมิน
  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', () => {
      if (adminCodeInput) adminCodeInput.value = '';
      hide(adminMenuScreen);
      hide(adminFormEditorScreen);
      hide(adminUsersScreen);
      show(userLoginScreen);
    });
  }

  // ไปหน้าแก้ไขฟอร์ม
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

  // ย้อนกลับจากหน้าแก้ฟอร์ม
  if (backToAdminMenu1) {
    backToAdminMenu1.addEventListener('click', () => {
      hide(adminFormEditorScreen);
      show(adminMenuScreen);
    });
  }

  // ย้อนกลับจากหน้าผู้ใช้
  if (backToAdminMenu2) {
    backToAdminMenu2.addEventListener('click', () => {
      hide(adminUsersScreen);
      show(adminMenuScreen);
    });
  }

  // โหลดรายการคำถามให้แอดมิน
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

  // แอดมินเพิ่มคำถามใหม่
  if (addQuestionBtn) {
    addQuestionBtn.addEventListener('click', async () => {
      const label = (newQuestionLabel.value || '').trim();
      const type = newQuestionType.value;
      const optionsRaw = (newQuestionOptions.value || '').trim();

      if (!label) {
        if (adminFormMsg) adminFormMsg.textContent = 'กรุณาใส่ชื่อคำถาม';
        return;
      }

      // หา order ล่าสุด
      const last = await db.collection('form_questions').orderBy('order', 'desc').limit(1).get();
      let nextOrder = 1;
      last.forEach(doc => {
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

      if (adminFormMsg) adminFormMsg.textContent = 'เพิ่มคำถามสำเร็จ ✅';

      newQuestionLabel.value = '';
      newQuestionOptions.value = '';

      await loadAdminFormList();
    });
  }

  // โหลดผู้ใช้ทั้งหมด
  async function loadAdminUsers() {
    if (!adminUsersList) return;
    adminUsersList.innerHTML = 'กำลังโหลด...';

    // ดึงคำถามมาก่อนเพื่อ map id -> label
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
      const studentId = d.studentId || '-';
      const time = d.createdAt ? d.createdAt.toDate().toLocaleString('th-TH') : '';

      const ansLines = Object.keys(ans).map(qid => {
        const q = questionsMap[qid];
        const label = q ? q.label : qid;
        return `<div><strong>${label}</strong>: ${ans[qid]}</div>`;
      }).join('');

      rows.push(`
        <div class="admin-item">
          <div><strong>รหัส นศ.:</strong> ${studentId}</div>
          <div style="font-size:12px;color:#777">${time}</div>
          <div>${ansLines}</div>
        </div>
      `);
    });

    adminUsersList.innerHTML = rows.join('');
  }
});
