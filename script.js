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
  let tempOptions = []; // [{label, limit, targetForm}]
  let allRegistrationsCache = [];
  let adminQuestionsCache = {};
  let currentBranchFormId = null; // ฟอร์มสาขาที่แสดงอยู่ตอนนี้

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
  const branchFormContainer = document.getElementById("branch-form-container");
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
  const newOptionTarget = document.getElementById("new-option-target");
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

  // ===== helper =====
  function buildPsuEmailFromStudentId(studentId) {
    if (!studentId) return "";
    return `s${studentId}@phuket.psu.ac.th`;
  }

  // ===== LOGIN =====
  loginBtn?.addEventListener("click", async () => {
    const code = (universalId?.value || "").trim();
    if (!code) return safeMsg(loginMsg, "กรุณากรอกรหัส");

    if (code === ADMIN_CODE) {
      show("admin-menu-screen");
      return;
    }

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

  // ===== USER: LOAD MAIN FORM =====
  async function loadUserForm() {
    dynamicForm.innerHTML = "กำลังโหลด...";
    branchFormContainer.innerHTML = ""; // ล้างฟอร์มสาขา
    currentBranchFormId = null;

    const snap = await db.collection("form_questions").orderBy("order").get();
    const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    dynamicForm.innerHTML = "";

    for (const q of questions) {
      const wrap = document.createElement("div");
      wrap.className = "dynamic-field";

      const label = document.createElement("label");
      label.textContent = q.label;
      wrap.appendChild(label);

      // auto email
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

      // select (dropdown) + branch
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

          // เก็บ targetForm ไว้ใน dataset
          if (opt.targetForm) {
            o.dataset.targetForm = opt.targetForm;
          }

          sel.appendChild(o);
        }

        // เมื่อเปลี่ยนตัวเลือก → โหลดฟอร์มสาขา
        sel.addEventListener("change", async (e) => {
          const selected = e.target.selectedOptions[0];
          const targetForm = selected.dataset.targetForm;
          if (targetForm) {
            await loadBranchForm(targetForm);
          } else {
            // ถ้าเปลี่ยนไปตัวที่ไม่มี target → ล้าง
            branchFormContainer.innerHTML = "";
            currentBranchFormId = null;
          }
        });

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

    // ปุ่มส่ง (จะส่งทั้งฟอร์มหลัก + ฟอร์มสาขา)
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.textContent = "ส่งแบบฟอร์ม";
    submitBtn.addEventListener("click", () => submitUserForm(questions));
    dynamicForm.appendChild(submitBtn);
  }

  // ===== USER: LOAD BRANCH FORM =====
  async function loadBranchForm(formId) {
    branchFormContainer.innerHTML = "กำลังโหลดฟอร์มเพิ่มเติม...";
    currentBranchFormId = formId;

    const doc = await db.collection("form_pages").doc(formId).get();
    if (!doc.exists) {
      branchFormContainer.innerHTML = `<p class="msg">ไม่พบฟอร์มปลายทางชื่อ "${formId}"</p>`;
      return;
    }

    const page = doc.data();
    const qs = page.questions || [];

    const frag = document.createElement("div");
    frag.innerHTML = `<h3>${page.title || "ฟอร์มเพิ่มเติม"}</h3>`;

    qs.forEach((q) => {
      const wrap = document.createElement("div");
      wrap.className = "dynamic-field";
      const label = document.createElement("label");
      label.textContent = q.label;
      wrap.appendChild(label);

      if (q.type === "textarea") {
        const ta = document.createElement("textarea");
        ta.name = `branch_${q.id}`;
        wrap.appendChild(ta);
      } else if (q.type === "select") {
        const sel = document.createElement("select");
        sel.name = `branch_${q.id}`;
        (q.options || []).forEach((o) => {
          const op = document.createElement("option");
          op.value = o;
          op.textContent = o;
          sel.appendChild(op);
        });
        wrap.appendChild(sel);
      } else {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.name = `branch_${q.id}`;
        wrap.appendChild(inp);
      }

      frag.appendChild(wrap);
    });

    branchFormContainer.innerHTML = "";
    branchFormContainer.appendChild(frag);
  }

  // ===== USER: SUBMIT (main + branch) =====
  async function submitUserForm(mainQuestions) {
    if (!currentStudent) {
      safeMsg(userFormMsg, "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    const answers = {};

    // เก็บฟอร์มหลัก
    for (const q of mainQuestions) {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      const val = el ? el.value : "";
      answers[q.id] = typeof val === "string" ? val.trim() : val;
    }

    // เก็บฟอร์มสาขา
    let branchData = null;
    if (currentBranchFormId) {
      const doc = await db.collection("form_pages").doc(currentBranchFormId).get();
      if (doc.exists) {
        const page = doc.data();
        branchData = {
          formId: currentBranchFormId,
          title: page.title || "",
          answers: {}
        };
        (page.questions || []).forEach((q) => {
          const el = branchFormContainer.querySelector(`[name="branch_${q.id}"]`);
          const val = el ? el.value : "";
          branchData.answers[q.id] = val;
        });
      }
    }

    // ===== เช็ก role_limits จากฟอร์มหลักเหมือนเดิม =====
    let roleToUpdate = null;
    for (const q of mainQuestions) {
      const val = (answers[q.id] || "").trim();
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

    // บันทึกทั้งหมด
    await db.collection("registrations").add({
      studentId: currentStudent,
      answers,
      branch: branchData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (roleToUpdate) {
      await roleToUpdate.ref.update({
        current: (roleToUpdate.current || 0) + 1,
      });
    }

    safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
    await loadUserForm();
  }

  // ===== ADMIN MENU =====
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

  // ===== ADMIN: FORM EDITOR =====
  newQuestionType?.addEventListener("change", () => {
    const t = newQuestionType.value;
    optionEditor.style.display = ["select","radio"].includes(t) ? "block" : "none";
  });

  addOptionBtn?.addEventListener("click", () => {
    const label = (newOptionText.value || "").trim();
    const limit = (newOptionLimit.value || "").trim();
    const target = (newOptionTarget.value || "").trim();
    if (!label) return;
    const item = { label };
    if (limit) item.limit = parseInt(limit);
    if (target) item.targetForm = target;
    tempOptions.push(item);
    newOptionText.value = "";
    newOptionLimit.value = "";
    newOptionTarget.value = "";
    renderOptionList();
  });

  function renderOptionList() {
    optionList.innerHTML = "";
    tempOptions.forEach((o, i) => {
      const li = document.createElement("li");
      let txt = o.label;
      if (o.limit) txt += ` (จำกัด ${o.limit})`;
      if (o.targetForm) txt += ` → ไปฟอร์ม: ${o.targetForm}`;
      li.textContent = txt;
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

    // สร้าง role_limits ด้วย (เฉพาะที่มี limit)
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
                  .map((o) => {
                    let s = o.label;
                    if (o.limit) s += ` (${o.limit})`;
                    if (o.targetForm) s += ` → ${o.targetForm}`;
                    return s;
                  })
                  .join(", ")}</div>`
              : ""
          }
          <button class="small-btn-edit" data-id="${d.id}">แก้ไข</button>
          <button class="small-btn" data-del="${d.id}">ลบ</button>
        </div>
      `;
    }).join("");

    // แก้ไข
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

    // ลบ
    adminFormList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        if (!confirm("ลบคำถามนี้เลยไหม")) return;
        await db.collection("form_questions").doc(id).delete();
        await loadAdminFormList();
      });
    });
  }

  // ===== ADMIN: view users =====
  async function loadAdminUsers() {
    adminUsersList.innerHTML = "กำลังโหลด...";

    const qSnap = await db.collection("form_questions").orderBy("order").get();
    adminQuestionsCache = {};
    qSnap.forEach((d) => (adminQuestionsCache[d.id] = d.data()));

    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    allRegistrationsCache = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    renderAdminUsers(allRegistrationsCache);

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
    if (!adminUsersList) return;
    if (!list || list.length === 0) {
      adminUsersList.innerHTML = "<p>ไม่พบข้อมูล</p>";
      return;
    }

    adminUsersList.innerHTML = list
      .map((item) => {
        const answers = item.answers || {};
        const answersHtml = Object.keys(answers)
          .map((qid) => {
            const qLabel = adminQuestionsCache[qid]?.label || qid;
            return `<div class="admin-user-answer"><strong>${qLabel}:</strong> ${answers[qid]}</div>`;
          })
          .join("");

        let branchHtml = "";
        if (item.branch) {
          branchHtml = `<div class="admin-user-answer"><strong>ฟอร์มเพิ่มเติม (${item.branch.formId}):</strong></div>` +
            Object.keys(item.branch.answers || {}).map((k) => {
              return `<div class="admin-user-answer" style="margin-left:10px;">${k}: ${item.branch.answers[k]}</div>`;
            }).join("");
        }

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
            ${branchHtml}
          </div>
        `;
      })
      .join("");
  }

  // ===== ADMIN: allowed_students =====
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

  // ===== ADMIN: role_limits =====
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

    adminRoleList.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimits();
      });
    });
  }
});
