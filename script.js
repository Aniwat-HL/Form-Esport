document.addEventListener("DOMContentLoaded", () => {
  // ========== 1. FIREBASE INITIALIZE ==========
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
  console.log("✅ Firebase connected!");

  // ========== 2. GLOBAL STATE ==========
  const ADMIN_CODE = "0826940174";
  const LIMIT_QUESTION_LABEL = "ตำแหน่งที่อยากเป็น";

  let currentStudent = null;
  let editingQuestionId = null;
  let tempOptions = [];

  // ========== 3. DOM CACHE ==========
  const screens = {};
  document.querySelectorAll(".screen").forEach((s) => (screens[s.id] = s));
  const show = (id) => {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[id]?.classList.add("active");
  };
  const safeMsg = (el, txt) => el && (el.textContent = txt);

  // Elements
  const loginBtn = document.getElementById("login-btn");
  const loginMsg = document.getElementById("login-msg");
  const universalId = document.getElementById("universal-id");

  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const userBackBtn = document.getElementById("user-back-btn");

  const adminEditFormBtn = document.getElementById("admin-edit-form-btn");
  const adminViewUsersBtn = document.getElementById("admin-view-users-btn");
  const adminManageIdsBtn = document.getElementById("admin-manage-ids-btn");
  const adminRoleLimitsBtn = document.getElementById("admin-role-limits-btn");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");

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

  const adminUsersList = document.getElementById("admin-users-list");
  const adminIdsList = document.getElementById("admin-ids-list");
  const newStudentIdInput = document.getElementById("new-student-id");
  const addStudentIdBtn = document.getElementById("add-student-id-btn");
  const adminRoleList = document.getElementById("admin-role-list");

  // Back buttons
  ["1", "2", "3", "4"].forEach((n) => {
    document
      .getElementById(`back-to-admin-menu-${n}`)
      ?.addEventListener("click", () => show("admin-menu-screen"));
  });

  // ========== 4. LOGIN ==========
  loginBtn?.addEventListener("click", async () => {
    const code = (universalId?.value || "").trim();
    if (!code) return safeMsg(loginMsg, "กรุณากรอกรหัส");

    if (code === ADMIN_CODE) {
      show("admin-menu-screen");
      return;
    }

    const doc = await db.collection("allowed_students").doc(code).get();
    if (!doc.exists) return safeMsg(loginMsg, "รหัสนี้ยังไม่ได้รับอนุญาต");

    currentStudent = code;
    await loadUserForm();
    show("user-form-screen");
  });

  userBackBtn?.addEventListener("click", () => {
    currentStudent = null;
    universalId.value = "";
    show("login-screen");
  });

  // ========== 5. USER FORM ==========
  async function loadUserForm() {
    dynamicForm.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_questions").orderBy("order").get();
    const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
          const o = document.createElement("option");
          o.value = opt.label;

          const rl = await db.collection("role_limits").doc(opt.label).get();
          if (rl.exists) {
            const { current = 0, max = 0 } = rl.data();
            o.textContent = `${opt.label} (${current}/${max})`;
            if (current >= max) o.disabled = true;
          } else {
            o.textContent = opt.label;
          }
          sel.appendChild(o);
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

    const submit = document.createElement("button");
    submit.textContent = "ส่งแบบฟอร์ม";
    submit.type = "button";
    submit.addEventListener("click", () => submitUserForm(questions));
    dynamicForm.appendChild(submit);
  }

  async function submitUserForm(questions) {
    if (!currentStudent) return safeMsg(userFormMsg, "กรุณาเข้าสู่ระบบ");

    const answers = {};
    questions.forEach((q) => {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      answers[q.id] = el ? el.value : "";
    });

    const limitQ = questions.find((q) => q.label === LIMIT_QUESTION_LABEL);
    const picked = limitQ ? answers[limitQ.id] : null;

    if (picked) {
      const ref = db.collection("role_limits").doc(picked);
      const snap = await ref.get();
      if (snap.exists) {
        const { current = 0, max = 0 } = snap.data();
        if (current >= max)
          return safeMsg(userFormMsg, `ตำแหน่ง "${picked}" เต็มแล้ว (${current}/${max})`);

        await db.collection("registrations").add({
          studentId: currentStudent,
          answers,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await ref.update({ current: current + 1 });
        safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
        return loadUserForm();
      }
    }

    await db.collection("registrations").add({
      studentId: currentStudent,
      answers,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
    loadUserForm();
  }

  // ========== 6. ADMIN MENU ==========
  adminLogoutBtn?.addEventListener("click", () => {
    universalId.value = "";
    show("login-screen");
  });

  adminEditFormBtn?.addEventListener("click", async () => {
    editingQuestionId = null;
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    optionEditor.style.display = "none";
    tempOptions = [];
    renderOptionList();
    await loadAdminFormList();
    show("admin-form-editor-screen");
  });

  adminViewUsersBtn?.addEventListener("click", async () => {
    await loadAdminUsers();
    show("admin-users-screen");
  });

  adminManageIdsBtn?.addEventListener("click", async () => {
    await loadAllowedStudents();
    show("admin-ids-screen");
  });

  adminRoleLimitsBtn?.addEventListener("click", async () => {
    await loadRoleLimits();
    show("admin-roles-screen");
  });

  // ========== 7. FORM BUILDER ==========
  newQuestionType?.addEventListener("change", () => {
    const t = newQuestionType.value;
    optionEditor.style.display = ["select", "radio"].includes(t) ? "block" : "none";
  });

  addOptionBtn?.addEventListener("click", () => {
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

  const renderOptionList = () => {
    optionList.innerHTML = "";
    tempOptions.forEach((o, i) => {
      const li = document.createElement("li");
      li.textContent = o.limit ? `${o.label} (จำกัด ${o.limit})` : o.label;
      const del = document.createElement("button");
      del.textContent = "ลบ";
      del.className = "small-btn";
      del.onclick = () => {
        tempOptions.splice(i, 1);
        renderOptionList();
      };
      li.appendChild(del);
      optionList.appendChild(li);
    });
  };

  addQuestionBtn?.addEventListener("click", async () => {
    const label = newQuestionLabel.value.trim();
    const type = newQuestionType.value;
    if (!label) return safeMsg(adminFormMsg, "กรุณาใส่ชื่อคำถาม");

    const data = {
      label,
      type,
      options: ["select", "radio"].includes(type) ? tempOptions : [],
      order: Date.now(),
    };

    if (editingQuestionId) {
      await db.collection("form_questions").doc(editingQuestionId).set(data, { merge: true });
      safeMsg(adminFormMsg, "อัปเดตคำถามแล้ว ✅");
    } else {
      await db.collection("form_questions").add(data);
      safeMsg(adminFormMsg, "เพิ่มคำถามแล้ว ✅");
    }

    // อัปเดต role_limits
    for (const o of tempOptions) {
      if (o.limit)
        await db.collection("role_limits").doc(o.label).set(
          { label: o.label, max: o.limit, current: 0 },
          { merge: true }
        );
    }

    editingQuestionId = null;
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    optionEditor.style.display = "none";
    tempOptions = [];
    renderOptionList();
    loadAdminFormList();
  });

  async function loadAdminFormList() {
    adminFormList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_questions").orderBy("order").get();
    if (snap.empty) return (adminFormList.innerHTML = "<p>ยังไม่มีคำถาม</p>");

    adminFormList.innerHTML = snap.docs
      .map((d) => {
        const data = d.data();
        return `
      <div class="box">
        <strong>${data.label}</strong> <small>(${data.type})</small>
        ${
          data.options?.length
            ? `<div>ตัวเลือก: ${data.options
                .map((o) => (o.limit ? `${o.label} (${o.limit})` : o.label))
                .join(", ")}</div>`
            : ""
        }
        <button class="small-btn-edit" data-id="${d.id}">แก้ไข</button>
        <button class="small-btn" data-del="${d.id}">ลบ</button>
      </div>`;
      })
      .join("");

    adminFormList.querySelectorAll("[data-id]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const doc = await db.collection("form_questions").doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();
        editingQuestionId = id;
        newQuestionLabel.value = d.label;
        newQuestionType.value = d.type;
        tempOptions = d.options || [];
        optionEditor.style.display = ["select", "radio"].includes(d.type) ? "block" : "none";
        renderOptionList();
      })
    );

    adminFormList.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        if (!confirm("ลบคำถามนี้ไหม")) return;
        await db.collection("form_questions").doc(e.target.dataset.del).delete();
        loadAdminFormList();
      })
    );
  }

  // ========== 8. ADMIN VIEW USERS ==========
  async function loadAdminUsers() {
    adminUsersList.innerHTML = "กำลังโหลด...";
    const qSnap = await db.collection("form_questions").get();
    const qMap = {};
    qSnap.forEach((d) => (qMap[d.id] = d.data()));

    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    if (snap.empty) return (adminUsersList.innerHTML = "<p>ยังไม่มีข้อมูล</p>");

    adminUsersList.innerHTML = snap.docs
      .map((d) => {
        const data = d.data();
        const ans = Object.entries(data.answers || {})
          .map(([k, v]) => `<div><strong>${qMap[k]?.label || k}:</strong> ${v}</div>`)
          .join("");
        return `
      <div class="box">
        <div><strong>รหัส:</strong> ${data.studentId}</div>
        <div>${data.createdAt ? data.createdAt.toDate().toLocaleString("th-TH") : ""}</div>
        ${ans}
      </div>`;
      })
      .join("");
  }

  // ========== 9. ALLOWED STUDENTS ==========
  async function loadAllowedStudents() {
    adminIdsList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) return (adminIdsList.innerHTML = "<p>ยังไม่มีรหัส</p>");

    adminIdsList.innerHTML = snap.docs
      .map(
        (d) => `<div class="box">${d.id}
        <button class="small-btn" data-del="${d.id}">ลบ</button></div>`
      )
      .join("");

    adminIdsList.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        await db.collection("allowed_students").doc(e.target.dataset.del).delete();
        loadAllowedStudents();
      })
    );
  }

  addStudentIdBtn?.addEventListener("click", async () => {
    const id = newStudentIdInput.value.trim();
    if (!id) return;
    await db.collection("allowed_students").doc(id).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    newStudentIdInput.value = "";
    loadAllowedStudents();
  });

  // ========== 10. ROLE LIMITS ==========
  async function loadRoleLimits() {
    adminRoleList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("role_limits").get();
    if (snap.empty) return (adminRoleList.innerHTML = "<p>ยังไม่มี role</p>");

    adminRoleList.innerHTML = snap.docs
      .map((d) => {
        const data = d.data();
        return `
        <div class="box">
          <strong>${data.label}</strong>
          <div>ปัจจุบัน: ${data.current || 0}/${data.max || 0}</div>
          <div class="inline">
            <input type="number" value="${data.current || 0}" data-cur="${d.id}">
            <input type="number" value="${data.max || 0}" data-max="${d.id}">
            <button class="update" data-id="${d.id}">อัปเดต</button>
            <button class="small-btn" data-del="${d.id}">ลบ</button>
          </div>
        </div>`;
      })
      .join("");

    adminRoleList.querySelectorAll(".update").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const cur = parseInt(adminRoleList.querySelector(`[data-cur="${id}"]`).value) || 0;
        const max = parseInt(adminRoleList.querySelector(`[data-max="${id}"]`).value) || 0;
        await db.collection("role_limits").doc(id).update({ current: cur, max });
        loadRoleLimits();
      })
    );

    adminRoleList.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        await db.collection("role_limits").doc(e.target.dataset.del).delete();
        loadRoleLimits();
      })
    );
  }
});
