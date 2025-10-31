document.addEventListener("DOMContentLoaded", () => {
  // ===== 1. Firebase =====
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
  console.log("✅ Firebase ready");

  // ===== 2. State =====
  const ADMIN_CODE = "0826940174"; // รหัสแอดมิน
  let currentStudent = null;
  let editingQuestionId = null;
  let tempOptions = []; // เก็บตัวเลือกชั่วคราวตอนเพิ่มคำถาม

  // ===== 3. DOM helper =====
  const screens = {};
  document.querySelectorAll(".screen").forEach((s) => (screens[s.id] = s));
  function show(id) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[id]?.classList.add("active");
  }
  const safeMsg = (el, text) => {
    if (el) el.textContent = text;
  };

  // ----- user / login elements -----
  const loginBtn = document.getElementById("login-btn");
  const loginMsg = document.getElementById("login-msg");
  const universalId = document.getElementById("universal-id");
  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const userBackBtn = document.getElementById("user-back-btn");

  // ----- admin menu -----
  const adminEditFormBtn = document.getElementById("admin-edit-form-btn");
  const adminViewUsersBtn = document.getElementById("admin-view-users-btn");
  const adminManageIdsBtn = document.getElementById("admin-manage-ids-btn");
  const adminRoleLimitsBtn = document.getElementById("admin-role-limits-btn");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");

  // ----- admin: form editor -----
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

  // ----- admin: users -----
  const adminUsersList = document.getElementById("admin-users-list");

  // ----- admin: student ids -----
  const adminIdsList = document.getElementById("admin-ids-list");
  const newStudentIdInput = document.getElementById("new-student-id");
  const addStudentIdBtn = document.getElementById("add-student-id-btn");

  // ----- admin: role limits -----
  const adminRoleList = document.getElementById("admin-role-list");

  // ----- admin back buttons -----
  ["1", "2", "3", "4"].forEach((n) => {
    const btn = document.getElementById(`back-to-admin-menu-${n}`);
    btn?.addEventListener("click", () => show("admin-menu-screen"));
  });

  // =========================================================
  // 4. LOGIN FLOW
  // =========================================================
  loginBtn?.addEventListener("click", async () => {
    const code = (universalId?.value || "").trim();
    if (!code) {
      safeMsg(loginMsg, "กรุณากรอกรหัส");
      return;
    }

    // แอดมิน
    if (code === ADMIN_CODE) {
      show("admin-menu-screen");
      return;
    }

    // ผู้ใช้ทั่วไป → เช็ครหัสใน allowed_students
    const doc = await db.collection("allowed_students").doc(code).get();
    if (!doc.exists) {
      safeMsg(loginMsg, "รหัสนี้ยังไม่ได้รับอนุญาต");
      return;
    }

    currentStudent = code;
    await loadUserForm();
    show("user-form-screen");
  });

  userBackBtn?.addEventListener("click", () => {
    currentStudent = null;
    universalId.value = "";
    show("login-screen");
  });

  // =========================================================
  // 5. USER: LOAD FORM (ดึงทุกคำถาม + แสดงจำนวนใน dropdown)
  // =========================================================
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
          const optEl = document.createElement("option");
          optEl.value = opt.label;

          // อ่าน role_limits เพื่อนับ
          const rl = await db.collection("role_limits").doc(opt.label).get();
          if (rl.exists) {
            const { current = 0, max = 0 } = rl.data();
            optEl.textContent = `${opt.label} (${current}/${max})`;
            if (current >= max) optEl.disabled = true;
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

  // =========================================================
  // 6. USER: SUBMIT FORM (เวอร์ชันตรวจจาก role_limits เลย)
  // =========================================================
  async function submitUserForm(questions) {
    if (!currentStudent) {
      safeMsg(userFormMsg, "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    // 1) เก็บคำตอบ
    const answers = {};
    for (const q of questions) {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      answers[q.id] = el ? el.value : "";
    }

    // 2) หาว่าคำตอบข้อไหน "ไปชนกับ role_limits"
    //    เราจะเช็กทีละคำตอบเลย ไม่สนชื่อคำถาม
    let roleToUpdate = null; // {ref, current, max, label}
    for (const q of questions) {
      const val = answers[q.id];
      if (!val) continue;

      const rlRef = db.collection("role_limits").doc(val);
      const rlSnap = await rlRef.get();
      if (rlSnap.exists) {
        const { current = 0, max = 0 } = rlSnap.data();
        if (current >= max) {
          // เต็มแล้ว
          safeMsg(userFormMsg, `ตำแหน่ง "${val}" เต็มแล้ว (${current}/${max})`);
          return;
        }
        // ยังไม่เต็ม → เดี๋ยวค่อย +1 หลังบันทึกฟอร์ม
        roleToUpdate = { ref: rlRef, current, max, label: val };
        break; // เจออันเดียวพอ
      }
    }

    // 3) บันทึกคำตอบ
    await db.collection("registrations").add({
      studentId: currentStudent,
      answers,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // 4) ถ้ามี role ที่ต้องอัปเดต → อัปเดตเลย
    if (roleToUpdate) {
      await roleToUpdate.ref.update({
        current: roleToUpdate.current + 1,
      });
    }

    safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
    await loadUserForm(); // โหลดใหม่เพื่อให้ dropdown อัปเดต (1/5 → 2/5)
  }

  // =========================================================
  // 7. ADMIN MENU BUTTONS
  // =========================================================
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

  // =========================================================
  // 8. ADMIN: FORM EDITOR
  // =========================================================
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

  function renderOptionList() {
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
  }

  addQuestionBtn?.addEventListener("click", async () => {
    const label = newQuestionLabel.value.trim();
    const type = newQuestionType.value;
    if (!label) {
      safeMsg(adminFormMsg, "กรุณาใส่ชื่อคำถาม");
      return;
    }

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

    // สร้าง role_limits ให้ตัวเลือกที่มี limit
    for (const o of tempOptions) {
      if (o.limit) {
        await db.collection("role_limits").doc(o.label).set(
          {
            label: o.label,
            max: o.limit,
            current: 0,
          },
          { merge: true }
        );
      }
    }

    // reset form
    editingQuestionId = null;
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    optionEditor.style.display = "none";
    tempOptions = [];
    renderOptionList();
    await loadAdminFormList();
  });

  async function loadAdminFormList() {
    adminFormList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_questions").orderBy("order").get();
    if (snap.empty) {
      adminFormList.innerHTML = "<p>ยังไม่มีคำถาม</p>";
      return;
    }

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
          </div>
        `;
      })
      .join("");

    // bind edit
    adminFormList.querySelectorAll(".small-btn-edit").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const doc = await db.collection("form_questions").doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();
        editingQuestionId = id;
        newQuestionLabel.value = d.label;
        newQuestionType.value = d.type;
        tempOptions = Array.isArray(d.options) ? d.options.slice() : [];
        optionEditor.style.display = ["select", "radio"].includes(d.type) ? "block" : "none";
        renderOptionList();
      })
    );

    // bind delete
    adminFormList.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        if (!confirm("ลบคำถามนี้เลยไหม")) return;
        await db.collection("form_questions").doc(id).delete();
        await loadAdminFormList();
      })
    );
  }

  // =========================================================
  // 9. ADMIN: ดูผู้สมัคร
  // =========================================================
  async function loadAdminUsers() {
    adminUsersList.innerHTML = "กำลังโหลด...";
    const qSnap = await db.collection("form_questions").orderBy("order").get();
    const qMap = {};
    qSnap.forEach((d) => (qMap[d.id] = d.data()));

    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      adminUsersList.innerHTML = "<p>ยังไม่มีข้อมูล</p>";
      return;
    }

    adminUsersList.innerHTML = snap.docs
      .map((d) => {
        const data = d.data();
        const ans = data.answers || {};
        const ansHtml = Object.keys(ans)
          .map((qid) => `<div><strong>${qMap[qid]?.label || qid}:</strong> ${ans[qid]}</div>`)
          .join("");
        return `
          <div class="box">
            <div><strong>รหัส นศ.:</strong> ${data.studentId}</div>
            <div style="font-size:12px;color:#666;">${
              data.createdAt ? data.createdAt.toDate().toLocaleString("th-TH") : ""
            }</div>
            ${ansHtml}
          </div>
        `;
      })
      .join("");
  }

  // =========================================================
  // 10. ADMIN: จัดการรหัส นศ.
  // =========================================================
  async function loadAllowedStudents() {
    adminIdsList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      adminIdsList.innerHTML = "<p>ยังไม่มีรหัส</p>";
      return;
    }

    adminIdsList.innerHTML = snap.docs
      .map(
        (d) => `
        <div class="box">
          ${d.id}
          <button class="small-btn" data-del="${d.id}">ลบ</button>
        </div>
      `
      )
      .join("");

    adminIdsList.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        await db.collection("allowed_students").doc(id).delete();
        await loadAllowedStudents();
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
    await loadAllowedStudents();
  });

  // =========================================================
  // 11. ADMIN: ROLE LIMITS
  // =========================================================
  async function loadRoleLimits() {
    adminRoleList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("role_limits").get();
    if (snap.empty) {
      adminRoleList.innerHTML = "<p>ยังไม่มี role จำกัด</p>";
      return;
    }

    adminRoleList.innerHTML = snap.docs
      .map((d) => {
        const data = d.data();
        return `
        <div class="box">
          <strong>${data.label}</strong>
          <div>ปัจจุบัน: ${data.current || 0}/${data.max || 0}</div>
          <div class="inline">
            <input type="number" min="0" value="${data.current || 0}" data-cur="${d.id}" />
            <input type="number" min="0" value="${data.max || 0}" data-max="${d.id}" />
            <button class="update" data-id="${d.id}">อัปเดต</button>
            <button class="small-btn" data-del="${d.id}">ลบ</button>
          </div>
        </div>
      `;
      })
      .join("");

    // update buttons
    adminRoleList.querySelectorAll(".update").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const cur = parseInt(adminRoleList.querySelector(`[data-cur="${id}"]`).value) || 0;
        const max = parseInt(adminRoleList.querySelector(`[data-max="${id}"]`).value) || 0;
        await db.collection("role_limits").doc(id).update({ current: cur, max });
        await loadRoleLimits();
      })
    );

    // delete buttons
    adminRoleList.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimits();
      })
    );
  }

  // ===== END =====
});
