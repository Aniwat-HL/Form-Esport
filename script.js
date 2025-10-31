document.addEventListener("DOMContentLoaded", () => {
  // ---- 1. Firebase init ----
  const firebaseConfig = {
    apiKey: "AIzaSyBqnVyK9BeJqMKuyYCqXzGOd1-07eEltEI",
    authDomain: "form-esport.firebaseapp.com",
    projectId: "form-esport",
    storageBucket: "form-esport.firebasestorage.app",
    messagingSenderId: "846451064511",
    appId: "1:846451064511:web:67cdec6e10d527396a900a"
  };
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  console.log("Firebase ready");

  // ---- 2. Const & state ----
  const ADMIN_CODE = "0826940174";
  // ชื่อคำถามที่ต้องใช้ limit จาก role_limits
  const LIMIT_QUESTION_LABEL = "ตำแหน่งที่อยากเป็น";

  let currentStudent = null;
  let editingQuestionId = null;
  let tempOptions = []; // [{label, limit}]

  // ---- 3. DOM ----
  const screens = {};
  document.querySelectorAll(".screen").forEach(s => screens[s.id] = s);
  function show(id) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[id].classList.add("active");
  }

  // login
  const loginBtn = document.getElementById("login-btn");
  const loginMsg = document.getElementById("login-msg");
  const universalId = document.getElementById("universal-id");

  // user form
  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const userBackBtn = document.getElementById("user-back-btn");

  // admin menu
  const adminEditFormBtn = document.getElementById("admin-edit-form-btn");
  const adminViewUsersBtn = document.getElementById("admin-view-users-btn");
  const adminManageIdsBtn = document.getElementById("admin-manage-ids-btn");
  const adminRoleLimitsBtn = document.getElementById("admin-role-limits-btn");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");

  // admin form editor
  const adminFormList = document.getElementById("admin-form-list");
  const newQuestionLabel = document.getElementById("new-question-label");
  const newQuestionType = document.getElementById("new-question-type");
  const optionEditor = document.getElementById("option-editor");
  const optionList = document.getElementById("option-list");
  const newOptionText = document.getElementById("new-option-text");
  const newOptionLimit = document.getElementById("new-option-limit");
  const addOptionBtn = document.getElementById("add-option-btn");
  const addQuestionBtn = document.getElementById("add-question-btn");
  const adminFormMsg = document.getElementById("admin-form-msg");
  const backToAdminMenu1 = document.getElementById("back-to-admin-menu-1");

  // admin users
  const adminUsersList = document.getElementById("admin-users-list");
  const backToAdminMenu2 = document.getElementById("back-to-admin-menu-2");

  // admin ids
  const adminIdsList = document.getElementById("admin-ids-list");
  const newStudentIdInput = document.getElementById("new-student-id");
  const addStudentIdBtn = document.getElementById("add-student-id-btn");
  const backToAdminMenu3 = document.getElementById("back-to-admin-menu-3");

  // admin role limits
  const adminRoleList = document.getElementById("admin-role-list");
  const backToAdminMenu4 = document.getElementById("back-to-admin-menu-4");

  // ---- 4. Login flow ----
  loginBtn.addEventListener("click", async () => {
    const code = universalId.value.trim();
    if (!code) {
      loginMsg.textContent = "กรุณากรอกรหัส";
      return;
    }

    if (code === ADMIN_CODE) {
      show("admin-menu-screen");
      return;
    }

    // check allowed_students
    const doc = await db.collection("allowed_students").doc(code).get();
    if (!doc.exists) {
      loginMsg.textContent = "รหัสนี้ยังไม่ได้รับอนุญาต";
      return;
    }
    currentStudent = code;
    await loadUserForm();
    show("user-form-screen");
  });

  userBackBtn.addEventListener("click", () => {
    currentStudent = null;
    universalId.value = "";
    show("login-screen");
  });

  // ---- 5. Load user form (with limit shown) ----
  async function loadUserForm() {
    const snap = await db.collection("form_questions").orderBy("order").get();
    const questions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    dynamicForm.innerHTML = "";

    for (const q of questions) {
      const wrap = document.createElement("div");
      wrap.className = "dynamic-field";
      const label = document.createElement("label");
      label.textContent = q.label;
      wrap.appendChild(label);

      if (q.type === "select") {
        const sel = document.createElement("select");
        sel.name = q.id;

        for (const opt of q.options || []) {
          const optEl = document.createElement("option");
          optEl.value = opt.label;

          // ตรวจจำนวนจาก role_limits
          const rl = await db.collection("role_limits").doc(opt.label).get();
          if (rl.exists) {
            const { current = 0, max = 0 } = rl.data();
            optEl.textContent = `${opt.label} (${current}/${max})`;
            if (current >= max) {
              optEl.disabled = true;
            }
          } else {
            optEl.textContent = opt.label;
          }
          sel.appendChild(optEl);
        }
        wrap.appendChild(sel);
      } else if (q.type === "textarea") {
        const ta = document.createElement("textarea");
        ta.name = q.id;
        wrap.appendChild(ta);
      } else {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.name = q.id;
        wrap.appendChild(inp);
      }

      dynamicForm.appendChild(wrap);
    }

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.textContent = "ส่งแบบฟอร์ม";
    submitBtn.addEventListener("click", () => submitUserForm(questions));
    dynamicForm.appendChild(submitBtn);
  }

  // ---- 5.1 Submit user form + check limit ----
  async function submitUserForm(questions) {
    if (!currentStudent) {
      userFormMsg.textContent = "กรุณาเข้าสู่ระบบก่อน";
      return;
    }

    const answers = {};
    questions.forEach(q => {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      answers[q.id] = el ? el.value : "";
    });

    // หาบทบาทที่ต้องจำกัด
    const limitQ = questions.find(q => q.label === LIMIT_QUESTION_LABEL);
    const pickedRole = limitQ ? answers[limitQ.id] : null;

    // ถ้ามีบทบาทต้องจำกัด → เช็กก่อน
    if (pickedRole) {
      const roleRef = db.collection("role_limits").doc(pickedRole);
      const roleSnap = await roleRef.get();
      if (roleSnap.exists) {
        const { current = 0, max = 0 } = roleSnap.data();
        if (current >= max) {
          userFormMsg.textContent = `ตำแหน่ง "${pickedRole}" เต็มแล้ว (${current}/${max})`;
          return;
        }
        // ยังไม่เต็ม → บันทึกฟอร์ม
        await db.collection("registrations").add({
          studentId: currentStudent,
          answers,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // อัปเดตจำนวน
        await roleRef.update({ current: current + 1 });
        userFormMsg.textContent = "ส่งแบบฟอร์มเรียบร้อย ✅";
        await loadUserForm();
        return;
      }
    }

    // กรณีไม่มีบทบาทจำกัด → ส่งปกติ
    await db.collection("registrations").add({
      studentId: currentStudent,
      answers,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    userFormMsg.textContent = "ส่งแบบฟอร์มเรียบร้อย ✅";
    await loadUserForm();
  }

  // ---- 6. Admin menu buttons ----
  adminLogoutBtn.addEventListener("click", () => {
    universalId.value = "";
    show("login-screen");
  });

  adminEditFormBtn.addEventListener("click", async () => {
    editingQuestionId = null;
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    optionEditor.style.display = "none";
    tempOptions = [];
    renderOptionList();
    await loadAdminFormList();
    show("admin-form-editor-screen");
  });

  adminViewUsersBtn.addEventListener("click", async () => {
    await loadAdminUsers();
    show("admin-users-screen");
  });

  adminManageIdsBtn.addEventListener("click", async () => {
    await loadAllowedStudents();
    show("admin-ids-screen");
  });

  adminRoleLimitsBtn.addEventListener("click", async () => {
    await loadRoleLimits();
    show("admin-roles-screen");
  });

  backToAdminMenu1.addEventListener("click", () => show("admin-menu-screen"));
  backToAdminMenu2.addEventListener("click", () => show("admin-menu-screen"));
  backToAdminMenu3.addEventListener("click", () => show("admin-menu-screen"));
  backToAdminMenu4.addEventListener("click", () => show("admin-menu-screen"));

  // ---- 7. Admin: load form list (แก้/ลบ) ----
  async function loadAdminFormList() {
    adminFormList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_questions").orderBy("order").get();
    const arr = [];
    snap.forEach(doc => {
      const d = doc.data();
      const id = doc.id;
      arr.push(`
        <div class="box">
          <strong>${d.label}</strong> <small>(${d.type})</small>
          ${d.options && d.options.length ? `<div>ตัวเลือก: ${d.options.map(o => o.limit ? `${o.label} (${o.limit})` : o.label).join(", ")}</div>` : ""}
          <div style="margin-top:6px;">
            <button class="small-btn-edit" data-id="${id}">แก้ไข</button>
            <button class="small-btn" data-del="${id}">ลบ</button>
          </div>
        </div>
      `);
    });
    adminFormList.innerHTML = arr.join("") || "<p>ยังไม่มีคำถาม</p>";

    // bind edit
    adminFormList.querySelectorAll(".small-btn-edit").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const doc = await db.collection("form_questions").doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();
        editingQuestionId = id;
        newQuestionLabel.value = d.label || "";
        newQuestionType.value = d.type || "text";
        tempOptions = Array.isArray(d.options) ? d.options.slice() : [];
        if (d.type === "select" || d.type === "radio") {
          optionEditor.style.display = "block";
        } else {
          optionEditor.style.display = "none";
        }
        renderOptionList();
      });
    });

    // bind delete
    adminFormList.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        if (!confirm("ลบคำถามนี้เลยไหม")) return;
        await db.collection("form_questions").doc(id).delete();
        await loadAdminFormList();
      });
    });
  }

  // ---- 8. Admin: option editor ----
  newQuestionType.addEventListener("change", () => {
    const t = newQuestionType.value;
    if (t === "select" || t === "radio") {
      optionEditor.style.display = "block";
    } else {
      optionEditor.style.display = "none";
      tempOptions = [];
      renderOptionList();
    }
  });

  addOptionBtn.addEventListener("click", () => {
    const label = newOptionText.value.trim();
    const limit = newOptionLimit.value.trim();
    if (!label) return;
    const item = { label };
    if (limit) item.limit = parseInt(limit);
    tempOptions.push(item);
    newOptionText.value = "";
    newOptionLimit.value = "";
    renderOptionList();
  });

  function renderOptionList() {
    optionList.innerHTML = "";
    tempOptions.forEach((o, idx) => {
      const li = document.createElement("li");
      li.textContent = o.limit ? `${o.label} (จำกัด ${o.limit})` : o.label;
      const del = document.createElement("button");
      del.textContent = "ลบ";
      del.className = "small-btn";
      del.addEventListener("click", () => {
        tempOptions.splice(idx, 1);
        renderOptionList();
      });
      li.appendChild(del);
      optionList.appendChild(li);
    });
  }

  addQuestionBtn.addEventListener("click", async () => {
    const label = newQuestionLabel.value.trim();
    const type = newQuestionType.value;
    if (!label) {
      adminFormMsg.textContent = "กรุณาใส่ชื่อคำถาม";
      return;
    }

    const data = {
      label,
      type,
      options: (type === "select" || type === "radio") ? tempOptions : [],
      order: Date.now(),
    };

    if (editingQuestionId) {
      await db.collection("form_questions").doc(editingQuestionId).set(data, { merge: true });
      adminFormMsg.textContent = "อัปเดตคำถามแล้ว ✅";
    } else {
      await db.collection("form_questions").add(data);
      adminFormMsg.textContent = "เพิ่มคำถามแล้ว ✅";
    }

    // สร้าง/อัปเดต role_limits ตาม option
    for (const o of tempOptions) {
      if (o.limit) {
        await db.collection("role_limits").doc(o.label).set({
          label: o.label,
          max: o.limit,
          current: 0
        }, { merge: true });
      }
    }

    // reset
    editingQuestionId = null;
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    optionEditor.style.display = "none";
    tempOptions = [];
    renderOptionList();
    await loadAdminFormList();
  });

  // ---- 9. Admin: view users ----
  async function loadAdminUsers() {
    adminUsersList.innerHTML = "กำลังโหลด...";
    // map คำถาม -> label
    const qSnap = await db.collection("form_questions").orderBy("order").get();
    const qMap = {};
    qSnap.forEach(doc => qMap[doc.id] = doc.data());

    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      adminUsersList.innerHTML = "<p>ยังไม่มีข้อมูล</p>";
      return;
    }
    const arr = [];
    snap.forEach(doc => {
      const d = doc.data();
      const ans = d.answers || {};
      let ansHtml = "";
      Object.keys(ans).forEach(qid => {
        const q = qMap[qid];
        const label = q ? q.label : qid;
        ansHtml += `<div><strong>${label}:</strong> ${ans[qid]}</div>`;
      });
      arr.push(`
        <div class="box">
          <div><strong>รหัส นศ.:</strong> ${d.studentId || "-"}</div>
          <div style="font-size:12px; color:#666;">${d.createdAt ? d.createdAt.toDate().toLocaleString("th-TH") : ""}</div>
          ${ansHtml}
        </div>
      `);
    });
    adminUsersList.innerHTML = arr.join("");
  }

  // ---- 10. Admin: allowed students ----
  async function loadAllowedStudents() {
    adminIdsList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      adminIdsList.innerHTML = "<p>ยังไม่มีรหัส</p>";
      return;
    }
    const arr = [];
    snap.forEach(doc => {
      const id = doc.id;
      arr.push(`
        <div class="box">
          ${id}
          <button class="small-btn" data-del-id="${id}">ลบ</button>
        </div>
      `);
    });
    adminIdsList.innerHTML = arr.join("");

    // bind del
    adminIdsList.querySelectorAll("[data-del-id]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.delId;
        await db.collection("allowed_students").doc(id).delete();
        await loadAllowedStudents();
      });
    });
  }

  addStudentIdBtn.addEventListener("click", async () => {
    const v = newStudentIdInput.value.trim();
    if (!v) return;
    await db.collection("allowed_students").doc(v).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    newStudentIdInput.value = "";
    await loadAllowedStudents();
  });

  // ---- 11. Admin: role limits screen (แก้ current / max) ----
  async function loadRoleLimits() {
    adminRoleList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("role_limits").get();
    if (snap.empty) {
      adminRoleList.innerHTML = "<p>ยังไม่มี role ที่จำกัด</p>";
      return;
    }
    const arr = [];
    snap.forEach(doc => {
      const d = doc.data();
      arr.push(`
        <div class="box">
          <strong>${d.label}</strong>
          <div>ปัจจุบัน: ${d.current || 0}/${d.max || 0}</div>
          <div class="inline">
            <input type="number" value="${d.current || 0}" min="0" data-cur="${doc.id}" />
            <input type="number" value="${d.max || 0}" min="0" data-max="${doc.id}" />
            <button class="update-role" data-id="${doc.id}">อัปเดต</button>
            <button class="small-btn" data-del-role="${doc.id}">ลบ</button>
          </div>
        </div>
      `);
    });
    adminRoleList.innerHTML = arr.join("");

    // bind update
    adminRoleList.querySelectorAll(".update-role").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const curEl = adminRoleList.querySelector(`[data-cur="${id}"]`);
        const maxEl = adminRoleList.querySelector(`[data-max="${id}"]`);
        const newCur = parseInt(curEl.value) || 0;
        const newMax = parseInt(maxEl.value) || 0;
        await db.collection("role_limits").doc(id).update({
          current: newCur,
          max: newMax
        });
        await loadRoleLimits();
      });
    });

    // bind delete
    adminRoleList.querySelectorAll("[data-del-role]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.delRole;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimits();
      });
    });
  }

  // ---- 12. Firestore rules (ใส่ใน console) ----
  // rules_version = '2';
  // service cloud.firestore {
  //   match /databases/{database}/documents {
  //     match /form_questions/{doc} { allow read, write: if true; }
  //     match /registrations/{doc} { allow read, write: if true; }
  //     match /allowed_students/{doc} { allow read, write: if true; }
  //     match /role_limits/{doc} { allow read, write: if true; }
  //   }
  // }

});
