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
  console.log("Firebase connected!");

  // ===== 2. DOM refs =====
  const ADMIN_CODE = "0826940174";  // เปลี่ยนได้

  // screens
  const loginScreen = document.getElementById("login-screen");
  const userFormScreen = document.getElementById("user-form-screen");
  const adminMenuScreen = document.getElementById("admin-menu-screen");
  const adminFormEditorScreen = document.getElementById("admin-form-editor-screen");
  const adminUsersScreen = document.getElementById("admin-users-screen");
  const adminIdsScreen = document.getElementById("admin-ids-screen");

  // login
  const loginInput = document.getElementById("universal-id");
  const loginBtn = document.getElementById("login-btn");
  const loginMsg = document.getElementById("login-msg");
  const loginInputGroup = document.getElementById("login-input-group");

  // user form
  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const userBackBtn = document.getElementById("user-back-btn");

  // admin menu buttons
  const adminLogoutBtn = document.getElementById("admin-logout-btn");
  const adminEditFormBtn = document.getElementById("admin-edit-form-btn");
  const adminViewUsersBtn = document.getElementById("admin-view-users-btn");
  const adminManageIdsBtn = document.getElementById("admin-manage-ids-btn");

  // admin form editor
  const adminFormList = document.getElementById("admin-form-list");
  const formEditorTitle = document.getElementById("form-editor-title");
  const newQuestionLabel = document.getElementById("new-question-label");
  const newQuestionType = document.getElementById("new-question-type");
  const newQuestionOptions = document.getElementById("new-question-options");
  const addQuestionBtn = document.getElementById("add-question-btn");
  const adminFormMsg = document.getElementById("admin-form-msg");
  const backToAdminMenu1 = document.getElementById("back-to-admin-menu-1");

  // admin users
  const adminUsersList = document.getElementById("admin-users-list");
  const adminUsersMsg = document.getElementById("admin-users-msg");
  const backToAdminMenu2 = document.getElementById("back-to-admin-menu-2");

  // admin ids
  const adminIdsList = document.getElementById("admin-ids-list");
  const newStudentIdInput = document.getElementById("new-student-id");
  const addStudentIdBtn = document.getElementById("add-student-id-btn");
  const adminIdsMsg = document.getElementById("admin-ids-msg");
  const backToAdminMenu3 = document.getElementById("back-to-admin-menu-3");

  // state
  let currentStudentId = null;
  let currentQuestions = [];
  let editingQuestionId = null;

  // helper show/hide
  const showScreen = (el) => {
    [loginScreen, userFormScreen, adminMenuScreen, adminFormEditorScreen, adminUsersScreen, adminIdsScreen]
      .forEach(s => s.classList.add('hidden'));
    el.classList.remove('hidden');
    el.classList.add('active');
  };

  // ===== 3. Login flow (ช่องเดียว) =====
  async function handleLogin() {
    const code = (loginInput.value || "").trim();
    if (!code) {
      loginMsg.textContent = "กรุณากรอกรหัสก่อน";
      loginInputGroup.classList.add("error");
      return;
    }
    loginInputGroup.classList.remove("error");
    loginMsg.textContent = "";

    // 3.1 ถ้าเป็นแอดมิน
    if (code === ADMIN_CODE) {
      currentStudentId = null;
      showScreen(adminMenuScreen);
      return;
    }

    // 3.2 ถ้าเป็นผู้ใช้ → ต้องมีใน allowed_students
    try {
      const doc = await db.collection("allowed_students").doc(code).get();
      if (!doc.exists) {
        loginMsg.textContent = "รหัสนี้ยังไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแลระบบ";
        loginInputGroup.classList.add("error");
        return;
      }
      currentStudentId = code;
      await loadFormForUser();
      showScreen(userFormScreen);
    } catch (err) {
      console.error(err);
      loginMsg.textContent = "เชื่อมต่อฐานข้อมูลไม่ได้ ❌";
    }
  }

  loginBtn.addEventListener("click", handleLogin);
  loginInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  // ===== 4. User form =====
  async function loadFormForUser() {
    dynamicForm.innerHTML = "กำลังโหลดแบบฟอร์ม...";
    try {
      const snap = await db.collection("form_questions").orderBy("order").get();
      currentQuestions = [];
      const frag = document.createDocumentFragment();

      snap.forEach((doc) => {
        const q = doc.data();
        q.id = doc.id;
        currentQuestions.push(q);
        frag.appendChild(createUserField(q));
      });

      dynamicForm.innerHTML = "";
      dynamicForm.appendChild(frag);

      // ปุ่มส่ง
      const submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.textContent = "ส่งแบบฟอร์ม";
      submitBtn.className = "btn primary";
      submitBtn.style.marginTop = "6px";
      submitBtn.addEventListener("click", submitUserForm);
      dynamicForm.appendChild(submitBtn);
    } catch (err) {
      console.error(err);
      dynamicForm.innerHTML = "โหลดแบบฟอร์มไม่สำเร็จ ❌";
    }
  }

  function createUserField(q) {
    const wrap = document.createElement("div");
    wrap.className = "dynamic-field";

    const label = document.createElement("label");
    label.textContent = q.label || "(ไม่มีชื่อคำถาม)";
    wrap.appendChild(label);

    switch (q.type) {
      case "textarea": {
        const ta = document.createElement("textarea");
        ta.name = q.id;
        wrap.appendChild(ta);
        break;
      }
      case "number": {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.name = q.id;
        wrap.appendChild(inp);
        break;
      }
      case "date": {
        const inp = document.createElement("input");
        inp.type = "date";
        inp.name = q.id;
        wrap.appendChild(inp);
        break;
      }
      case "select": {
        const sel = document.createElement("select");
        sel.name = q.id;
        (q.options || []).forEach((op) => {
          const opt = document.createElement("option");
          opt.value = op;
          opt.textContent = op;
          sel.appendChild(opt);
        });
        wrap.appendChild(sel);
        break;
      }
      case "radio": {
        (q.options || []).forEach((op, i) => {
          const row = document.createElement("div");
          const r = document.createElement("input");
          r.type = "radio";
          r.name = q.id;
          r.value = op;
          r.id = q.id + "_" + i;

          const la = document.createElement("label");
          la.htmlFor = r.id;
          la.textContent = op;

          row.appendChild(r);
          row.appendChild(la);
          wrap.appendChild(row);
        });
        break;
      }
      default: {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.name = q.id;
        wrap.appendChild(inp);
      }
    }

    return wrap;
  }

  async function submitUserForm() {
    if (!currentStudentId) {
      userFormMsg.textContent = "กรุณาเข้าสู่ระบบก่อน";
      return;
    }
    const answers = {};
    currentQuestions.forEach((q) => {
      if (q.type === "radio") {
        const checked = dynamicForm.querySelector(`input[name="${q.id}"]:checked`);
        answers[q.id] = checked ? checked.value : "";
      } else {
        const el = dynamicForm.querySelector(`[name="${q.id}"]`);
        answers[q.id] = el ? el.value : "";
      }
    });

    try {
      await db.collection("registrations").add({
        studentId: currentStudentId,
        answers,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      userFormMsg.textContent = "ส่งแบบฟอร์มเรียบร้อย ✅";
    } catch (err) {
      console.error(err);
      userFormMsg.textContent = "ส่งแบบฟอร์มไม่สำเร็จ ❌";
    }
  }

  userBackBtn.addEventListener("click", () => {
    currentStudentId = null;
    loginInput.value = "";
    userFormMsg.textContent = "";
    showScreen(loginScreen);
  });

  // ===== 5. Admin menu =====
  adminLogoutBtn.addEventListener("click", () => {
    loginInput.value = "";
    editingQuestionId = null;
    showScreen(loginScreen);
  });

  adminEditFormBtn.addEventListener("click", async () => {
    editingQuestionId = null;
    formEditorTitle.textContent = "เพิ่มคำถามใหม่";
    addQuestionBtn.textContent = "บันทึก";
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    newQuestionOptions.value = "";
    await loadAdminFormList();
    showScreen(adminFormEditorScreen);
  });

  adminViewUsersBtn.addEventListener("click", async () => {
    await loadAdminUsers();
    showScreen(adminUsersScreen);
  });

  adminManageIdsBtn.addEventListener("click", async () => {
    await loadAllowedStudents();
    showScreen(adminIdsScreen);
  });

  backToAdminMenu1.addEventListener("click", () => showScreen(adminMenuScreen));
  backToAdminMenu2.addEventListener("click", () => showScreen(adminMenuScreen));
  backToAdminMenu3.addEventListener("click", () => showScreen(adminMenuScreen));

  // ===== 6. Admin: form list =====
  async function loadAdminFormList() {
    adminFormList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_questions").orderBy("order").get();
    const items = [];
    snap.forEach((doc) => {
      const d = doc.data();
      const id = doc.id;
      items.push(`
        <div class="admin-item" data-id="${id}">
          <div>
            <strong>${d.label || "(ไม่มีชื่อ)"}</strong>
            <span class="badge ${d.type}">${d.type}</span>
            ${d.options && d.options.length ? `<div>ตัวเลือก: ${d.options.join(", ")}</div>` : ""}
          </div>
          <div class="action-btns">
            <button class="btn-edit" data-id="${id}">แก้ไข</button>
            <button class="btn-del" data-id="${id}">ลบ</button>
          </div>
        </div>
      `);
    });
    adminFormList.innerHTML = items.join("") || "<p>ยังไม่มีคำถาม</p>";

    // bind edit
    adminFormList.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        const doc = await db.collection("form_questions").doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();

        editingQuestionId = id;
        formEditorTitle.textContent = "แก้ไขคำถาม";
        addQuestionBtn.textContent = "บันทึกการแก้";
        newQuestionLabel.value = d.label || "";
        newQuestionType.value = d.type || "text";
        newQuestionOptions.value = (d.options || []).join(", ");
      });
    });

    // bind delete
    adminFormList.querySelectorAll(".btn-del").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        if (!confirm("ลบคำถามนี้เลยไหม")) return;
        await db.collection("form_questions").doc(id).delete();
        await loadAdminFormList();
      });
    });
  }

  // เพิ่ม/แก้คำถาม
  addQuestionBtn.addEventListener("click", async () => {
    const label = (newQuestionLabel.value || "").trim();
    const type = newQuestionType.value;
    const optionsRaw = (newQuestionOptions.value || "").trim();

    if (!label) {
      adminFormMsg.textContent = "กรุณาใส่ชื่อคำถาม";
      return;
    }

    const data = { label, type };

    if (type === "select" || type === "radio") {
      data.options = optionsRaw
        ? optionsRaw.split(",").map(s => s.trim()).filter(Boolean)
        : [];
    } else {
      data.options = [];
    }

    if (editingQuestionId) {
      await db.collection("form_questions").doc(editingQuestionId).update(data);
      adminFormMsg.textContent = "อัปเดตคำถามสำเร็จ ✅";
    } else {
      const last = await db.collection("form_questions").orderBy("order","desc").limit(1).get();
      let nextOrder = 1;
      last.forEach((doc) => {
        const d = doc.data();
        nextOrder = (d.order || 0) + 1;
      });
      data.order = nextOrder;
      await db.collection("form_questions").add(data);
      adminFormMsg.textContent = "เพิ่มคำถามสำเร็จ ✅";
    }

    editingQuestionId = null;
    formEditorTitle.textContent = "เพิ่มคำถามใหม่";
    addQuestionBtn.textContent = "บันทึก";
    newQuestionLabel.value = "";
    newQuestionOptions.value = "";
    newQuestionType.value = "text";

    await loadAdminFormList();
  });

  // ===== 7. Admin: users =====
  async function loadAdminUsers() {
    adminUsersList.innerHTML = "กำลังโหลด...";
    const qSnap = await db.collection("form_questions").orderBy("order").get();
    const qMap = {};
    qSnap.forEach((doc) => qMap[doc.id] = doc.data());

    const snap = await db.collection("registrations").orderBy("createdAt","desc").get();
    if (snap.empty) {
      adminUsersList.innerHTML = "<p>ยังไม่มีคนส่งแบบฟอร์ม</p>";
      return;
    }

    const items = [];
    snap.forEach((doc) => {
      const d = doc.data();
      const time = d.createdAt ? d.createdAt.toDate().toLocaleString("th-TH") : "";
      const ans = d.answers || {};
      const ansHtml = Object.keys(ans).map((qid) => {
        const q = qMap[qid];
        const label = q ? q.label : qid;
        return `<div><strong>${label}</strong>: ${ans[qid]}</div>`;
      }).join("");
      items.push(`
        <div class="admin-item">
          <div><strong>รหัส นศ.:</strong> ${d.studentId || "-"}</div>
          <div style="font-size:0.68rem;color:#6b7280">${time}</div>
          <div style="margin-top:4px">${ansHtml}</div>
        </div>
      `);
    });

    adminUsersList.innerHTML = items.join("");
  }

  // ===== 8. Admin: allowed students =====
  async function loadAllowedStudents() {
    adminIdsList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      adminIdsList.innerHTML = "<p>ยังไม่มีรหัสที่อนุญาต</p>";
      return;
    }

    const items = [];
    snap.forEach((doc) => {
      const sid = doc.id;
      items.push(`
        <div class="admin-item">
          <div><strong>${sid}</strong></div>
          <button class="btn-del" data-sid="${sid}">ลบ</button>
        </div>
      `);
    });
    adminIdsList.innerHTML = items.join("");

    // bind delete
    adminIdsList.querySelectorAll(".btn-del").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const sid = e.target.getAttribute("data-sid");
        await db.collection("allowed_students").doc(sid).delete();
        await loadAllowedStudents();
      });
    });
  }

  addStudentIdBtn.addEventListener("click", async () => {
    const sid = (newStudentIdInput.value || "").trim();
    if (!sid) {
      adminIdsMsg.textContent = "กรุณากรอกรหัส";
      return;
    }
    await db.collection("allowed_students").doc(sid).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    adminIdsMsg.textContent = "เพิ่มรหัสสำเร็จ ✅";
    newStudentIdInput.value = "";
    await loadAllowedStudents();
  });

});
