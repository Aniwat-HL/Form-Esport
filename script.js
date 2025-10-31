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
  const ADMIN_CODE = "0826940174";
  let currentStudent = null;
  let editingQuestionId = null;
  let tempOptions = [];       // [{label, limit}]
  let allRegistrationsCache = [];  // สำหรับหน้าแอดมินค้นหา
  let adminQuestionsCache = {};    // เก็บ label ของคำถามไว้ใช้ตอนแสดง

  // ===== 3. DOM =====
  const screens = {};
  document.querySelectorAll(".screen").forEach((s) => (screens[s.id] = s));
  function show(id) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[id]?.classList.add("active");
  }
  const safeMsg = (el, txt) => el && (el.textContent = txt);

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
  const userSearchInput = document.getElementById("user-search-input");
  const userSearchBtn = document.getElementById("user-search-btn");
  const userSearchClearBtn = document.getElementById("user-search-clear-btn");

  const adminIdsList = document.getElementById("admin-ids-list");
  const newStudentIdInput = document.getElementById("new-student-id");
  const addStudentIdBtn = document.getElementById("add-student-id-btn");

  const adminRoleList = document.getElementById("admin-role-list");

  ["1","2","3","4"].forEach(n => {
    document.getElementById(`back-to-admin-menu-${n}`)?.addEventListener("click", () => show("admin-menu-screen"));
  });

  // ===== helper: build email =====
  function buildPsuEmailFromStudentId(studentId) {
    if (!studentStudentIdIsValid(studentId)) return "";
    return `s${studentId}@phuket.psu.ac.th`;
  }
  function studentStudentIdIsValid(sid) {
    return !!sid; // จะเพิ่มเงื่อนไขก็ได้ เช่น /^\d{10}$/ ...
  }

  // ===== 4. LOGIN =====
  loginBtn?.addEventListener("click", async () => {
    const code = (universalId?.value || "").trim();
    if (!code) return safeMsg(loginMsg, "กรุณากรอกรหัส");

    // admin
    if (code === ADMIN_CODE) {
      show("admin-menu-screen");
      return;
    }

    // user
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
    if (universalId) universalId.value = "";
    show("login-screen");
  });

  // ===== 5. USER: LOAD FORM =====
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

      // ✅ อีเมล auto (แค่มีคำว่า "อีเมล")
      const normalized = (q.label || "").trim();
      const isEmailQuestion =
        normalized === "อีเมล" ||
        normalized.toLowerCase().includes("อีเมล") ||
        normalized.toLowerCase().includes("email");

      if (isEmailQuestion) {
        const inp = document.createElement("input");
        inp.type = "email";
        inp.name = q.id;
        inp.value = buildPsuEmailFromStudentId(currentStudent);
        inp.readOnly = true;
        inp.style.background = "#f5f5f5";
        wrap.appendChild(inp);
        dynamicForm.appendChild(wrap);
        continue;
      }

      // dropdown จำกัดจำนวน
      if (q.type === "select") {
        const sel = document.createElement("select");
        sel.name = q.id;

        for (const opt of q.options || []) {
          const optLabel = (opt.label || "").trim();
          const o = document.createElement("option");
          o.value = optLabel;

          const rl = await db.collection("role_limits").doc(optLabel).get();
          if (rl.exists) {
            const { current = 0, max = 0 } = rl.data();
            o.textContent = `${optLabel} (${current}/${max})`;
            if (max && current >= max) o.disabled = true;
          } else {
            o.textContent = optLabel;
          }

          sel.appendChild(o);
        }

        wrap.appendChild(sel);
      }
      else if (q.type === "textarea") {
        const ta = document.createElement("textarea");
        ta.name = q.id;
        wrap.appendChild(ta);
      }
      else {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.name = q.id;
        wrap.appendChild(inp);
      }

      dynamicForm.appendChild(wrap);
    }

    // ปุ่มส่ง
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.textContent = "ส่งแบบฟอร์ม";
    submitBtn.addEventListener("click", () => submitUserForm(questions));
    dynamicForm.appendChild(submitBtn);
  }

  // ===== 6. USER: SUBMIT =====
  async function submitUserForm(questions) {
    if (!currentStudent) {
      safeMsg(userFormMsg, "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    const answers = {};
    for (const q of questions) {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      const val = el ? el.value : "";
      answers[q.id] = typeof val === "string" ? val.trim() : val;
    }

    // เช็กว่าเลือก role ที่จำกัดไหม
    let roleToUpdate = null;
    for (const q of questions) {
      const rawVal = answers[q.id];
      const val = typeof rawVal === "string" ? rawVal.trim() : rawVal;
      if (!val) continue;

      const rlRef = db.collection("role_limits").doc(val);
      const rlSnap = await rlRef.get();
      if (rlSnap.exists) {
        const { current = 0, max = 0 } = rlSnap.data();
        if (max && current >= max) {
          safeMsg(userFormMsg, `ตำแหน่ง "${val}" เต็มแล้ว (${current}/${max})`);
          return;
        }
        roleToUpdate = { ref: rlRef, current, max, label: val };
        break;
      }
    }

    // บันทึกลง registrations
    await db.collection("registrations").add({
      studentId: currentStudent,
      answers,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // อัปเดตตัวนับบทบาท
    if (roleToUpdate) {
      await roleToUpdate.ref.update({
        current: (roleToUpdate.current || 0) + 1,
      });
    }

    safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
    await loadUserForm();
  }

  // ===== 7. ADMIN MENU =====
  adminLogoutBtn?.addEventListener("click", () => {
    if (universalId) universalId.value = "";
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

  // ===== 8. ADMIN: FORM EDITOR =====
  newQuestionType?.addEventListener("change", () => {
    const t = newQuestionType.value;
    optionEditor.style.display = ["select","radio"].includes(t) ? "block" : "none";
  });

  addOptionBtn?.addEventListener("click", () => {
    const label = (newOptionText.value || "").trim();
    const limit = (newOptionLimit.value || "").trim();
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
    const label = (newQuestionLabel.value || "").trim();
    const type = newQuestionType.value;
    if (!label) return safeMsg(adminFormMsg, "กรุณาใส่ชื่อคำถาม");

    const data = {
      label,
      type,
      options: ["select","radio"].includes(type) ? tempOptions : [],
      order: Date.now(),
    };

    if (editingQuestionId) {
      await db.collection("form_questions").doc(editingQuestionId).set(data, { merge: true });
      safeMsg(adminFormMsg, "อัปเดตคำถามแล้ว ✅");
    } else {
      await db.collection("form_questions").add(data);
      safeMsg(adminFormMsg, "เพิ่มคำถามแล้ว ✅");
    }

    // สร้าง role_limits จากตัวเลือกที่มี limit
    for (const o of tempOptions) {
      const optLabel = (o.label || "").trim();
      if (o.limit) {
        await db.collection("role_limits").doc(optLabel).set(
          {
            label: optLabel,
            max: o.limit,
            current: 0,
          },
          { merge: true }
        );
      }
    }

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

    adminFormList.innerHTML = snap.docs.map((d) => {
      const x = d.data();
      return `
        <div class="box">
          <strong>${x.label}</strong> <small>(${x.type})</small>
          ${
            x.options?.length
              ? `<div>ตัวเลือก: ${x.options
                  .map((o) => (o.limit ? `${o.label} (${o.limit})` : o.label))
                  .join(", ")}</div>`
              : ""
          }
          <button class="small-btn-edit" data-id="${d.id}">แก้ไข</button>
          <button class="small-btn" data-del="${d.id}">ลบ</button>
        </div>
      `;
    }).join("");

    // edit
    adminFormList.querySelectorAll(".small-btn-edit").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const doc = await db.collection("form_questions").doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();
        editingQuestionId = id;
        newQuestionLabel.value = d.label;
        newQuestionType.value = d.type;
        tempOptions = Array.isArray(d.options) ? d.options.slice() : [];
        optionEditor.style.display = ["select","radio"].includes(d.type) ? "block" : "none";
        renderOptionList();
      });
    });

    // delete
    adminFormList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        if (!confirm("ลบคำถามนี้เลยไหม")) return;
        await db.collection("form_questions").doc(id).delete();
        await loadAdminFormList();
      });
    });
  }

  // ===== 9. ADMIN: view users (with search) =====
  async function loadAdminUsers() {
    adminUsersList.innerHTML = "กำลังโหลด...";

    // โหลดคำถามไว้แปลง id -> label
    const qSnap = await db.collection("form_questions").orderBy("order").get();
    adminQuestionsCache = {};
    qSnap.forEach((d) => (adminQuestionsCache[d.id] = d.data()));

    // โหลดผู้สมัครทั้งหมด
    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    allRegistrationsCache = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    renderAdminUsers(allRegistrationsCache);

    // bind search
    if (userSearchBtn) {
      userSearchBtn.onclick = () => {
        const q = (userSearchInput.value || "").trim();
        if (!q) {
          renderAdminUsers(allRegistrationsCache);
          return;
        }
        const filtered = allRegistrationsCache.filter((item) =>
          (item.studentId || "").toString().includes(q)
        );
        renderAdminUsers(filtered);
      };
    }

    if (userSearchClearBtn) {
      userSearchClearBtn.onclick = () => {
        userSearchInput.value = "";
        renderAdminUsers(allRegistrationsCache);
      };
    }

    if (userSearchInput) {
      userSearchInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          userSearchBtn?.click();
        }
      };
    }
  }

  function renderAdminUsers(list) {
    const box = document.getElementById("admin-users-list");
    if (!box) return;

    if (!list || list.length === 0) {
      box.innerHTML = "<p>ไม่พบข้อมูล</p>";
      return;
    }

    box.innerHTML = list
      .map((item) => {
        const answers = item.answers || {};
        const answersHtml = Object.keys(answers)
          .map((qid) => {
            const qLabel = adminQuestionsCache[qid]?.label || qid;
            return `<div class="admin-user-answer"><strong>${qLabel}:</strong> ${answers[qid]}</div>`;
          })
          .join("");

        const timeStr = item.createdAt
          ? item.createdAt.toDate().toLocaleString("th-TH")
          : "";

        return `
          <div class="admin-user-card">
            <div class="admin-user-header">
              <span>รหัส: ${item.studentId || "-"}</span>
              <span class="admin-user-time">${timeStr}</span>
            </div>
            ${answersHtml}
          </div>
        `;
      })
      .join("");
  }

  // ===== 10. ADMIN: allowed_students =====
  async function loadAllowedStudents() {
    adminIdsList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      adminIdsList.innerHTML = "<p>ยังไม่มีรหัส</p>";
      return;
    }

    adminIdsList.innerHTML = snap.docs
      .map((d) => {
        return `
          <div class="box">
            ${d.id}
            <button class="small-btn" data-del="${d.id}">ลบ</button>
          </div>
        `;
      })
      .join("");

    adminIdsList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        await db.collection("allowed_students").doc(id).delete();
        await loadAllowedStudents();
      });
    });
  }

  addStudentIdBtn?.addEventListener("click", async () => {
    const id = (newStudentIdInput.value || "").trim();
    if (!id) return;
    await db.collection("allowed_students").doc(id).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    newStudentIdInput.value = "";
    await loadAllowedStudents();
  });

  // ===== 11. ADMIN: role_limits =====
  async function loadRoleLimits() {
    adminRoleList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("role_limits").get();
    if (snap.empty) {
      adminRoleList.innerHTML = "<p>ยังไม่มี role จำกัด</p>";
      return;
    }

    adminRoleList.innerHTML = snap.docs
      .map((d) => {
        const x = d.data();
        return `
          <div class="box">
            <strong>${x.label}</strong>
            <div>ปัจจุบัน: ${x.current || 0}/${x.max || 0}</div>
            <div class="inline">
              <input type="number" value="${x.current || 0}" data-cur="${d.id}" />
              <input type="number" value="${x.max || 0}" data-max="${d.id}" />
              <button class="update" data-id="${d.id}">อัปเดต</button>
              <button class="small-btn" data-del="${d.id}">ลบ</button>
            </div>
          </div>
        `;
      })
      .join("");

    // update
    adminRoleList.querySelectorAll(".update").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const cur = parseInt(adminRoleList.querySelector(`[data-cur="${id}"]`).value) || 0;
        const max = parseInt(adminRoleList.querySelector(`[data-max="${id}"]`).value) || 0;
        await db.collection("role_limits").doc(id).update({
          current: cur,
          max: max,
        });
        await loadRoleLimits();
      });
    });

    // delete
    adminRoleList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimits();
      });
    });
  }
});
