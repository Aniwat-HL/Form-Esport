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

  // ===== 2. STATE =====
  const ADMIN_CODE = "0826940174";
  let currentStudent = null;
  let allSections = [];
  let currentSectionId = null;
  let answersBuffer = {};
  let allRegistrationsCache = [];
  let editingQuestions = [];

  // ===== 3. DOM =====
  const screens = {};
  document.querySelectorAll(".screen").forEach((s) => (screens[s.id] = s));

  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const universalId = document.getElementById("universal-id");
  const loginMsg = document.getElementById("login-msg");
  const qEditor = document.getElementById("questions-editor");
  const adminFormMsg = document.getElementById("admin-form-msg");

  function show(id) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    if (screens[id]) screens[id].classList.add("active");
  }
  function safeMsg(el, txt) {
    if (el) el.textContent = txt;
  }

  function buildPsuEmailFromStudentId(studentId) {
    if (!studentId) return "";
    return `s${studentId}@phuket.psu.ac.th`;
  }

  // ===== 4. LOGIN =====
  document.getElementById("login-btn")?.addEventListener("click", async () => {
    const code = (universalId.value || "").trim();
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
    answersBuffer = {};
    await loadUserFormSections();
    show("user-form-screen");
  });

  document.getElementById("user-logout-btn")?.addEventListener("click", () => {
    currentStudent = null;
    universalId.value = "";
    show("login-screen");
  });

  // ===== 5. USER SIDE =====
  async function loadUserFormSections() {
    dynamicForm.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_sections").orderBy("order").get();
    allSections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (allSections.length === 0) {
      dynamicForm.innerHTML = "<p>ยังไม่มีฟอร์ม</p>";
      return;
    }

    currentSectionId = allSections[0].id;
    await renderSection(currentSectionId);
  }

  // ---- render form section (พร้อมสร้าง role_limits อัตโนมัติ) ----
  async function renderSection(secId) {
    const section = allSections.find((s) => s.id === secId);
    if (!section) {
      dynamicForm.innerHTML = "<p>ไม่พบ Section นี้</p>";
      return;
    }

    dynamicForm.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = section.title || "แบบฟอร์ม";
    dynamicForm.appendChild(h);

    for (const q of section.questions || []) {
      const wrap = document.createElement("div");
      wrap.className = "dynamic-field";

      const label = document.createElement("label");
      label.textContent = q.label;
      wrap.appendChild(label);

      // auto email
      const normalized = (q.label || "").toLowerCase();
      const isEmail = normalized.includes("อีเมล") || normalized.includes("email");
      if (isEmail) {
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

      if (q.type === "select") {
        const sel = document.createElement("select");
        sel.name = q.id;
        const goToMap = {};
        const limitMap = {};

        for (const opt of q.options || []) {
          const optLabel = (opt.label || "").trim();
          const o = document.createElement("option");
          o.value = optLabel;

          if (opt.limit) {
            // ตรวจใน role_limits ถ้าไม่มีให้สร้างเลย
            const rlRef = db.collection("role_limits").doc(optLabel);
            const rlSnap = await rlRef.get();

            let current = 0;
            let max = opt.limit;

            if (!rlSnap.exists) {
              await rlRef.set({
                label: optLabel,
                current: 0,
                max: opt.limit
              });
            } else {
              const data = rlSnap.data() || {};
              current = data.current || 0;
              max = data.max || opt.limit;
            }

            o.textContent = `${optLabel} (${current}/${max})`;
            limitMap[optLabel] = { current, max };

            if (current >= max) {
              o.disabled = true;
            }
          } else {
            o.textContent = optLabel;
          }

          if (opt.goTo) {
            goToMap[optLabel] = opt.goTo;
          }

          sel.appendChild(o);
        }

        sel._goToMap = goToMap;
        sel._limitMap = limitMap;
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

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = isLastSection(secId) ? "ส่งแบบฟอร์ม" : "ถัดไป";
    btn.addEventListener("click", () => handleNext(section));
    dynamicForm.appendChild(btn);
  }

  function isLastSection(secId) {
    const idx = allSections.findIndex((s) => s.id === secId);
    return idx === allSections.length - 1;
  }

  async function handleNext(section) {
    // เก็บคำตอบปัจจุบัน
    for (const q of section.questions || []) {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      if (!el) continue;
      answersBuffer[q.id] = el.value;
    }

    // ถ้ามี goTo ให้กระโดด
    let jumpTo = null;
    for (const q of section.questions || []) {
      if (q.type !== "select") continue;
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      if (!el) continue;
      const val = el.value;
      const map = el._goToMap || {};
      if (map[val]) {
        jumpTo = map[val];
        break;
      }
    }

    if (jumpTo) {
      currentSectionId = jumpTo;
      await renderSection(jumpTo);
      return;
    }

    // ถ้ายังมี section ถัดไป
    const idx = allSections.findIndex((s) => s.id === section.id);
    if (idx >= 0 && idx < allSections.length - 1) {
      const nextId = allSections[idx + 1].id;
      currentSectionId = nextId;
      await renderSection(nextId);
    } else {
      await submitAll();
    }
  }

  // ---- submit (เช็ก limit อีกที) ----
  async function submitAll() {
    if (!currentStudent) {
      safeMsg(userFormMsg, "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    let roleToUpdate = null;

    for (const key of Object.keys(answersBuffer)) {
      const val = (answersBuffer[key] || "").trim();
      if (!val) continue;

      const rlRef = db.collection("role_limits").doc(val);
      const rlSnap = await rlRef.get();

      if (rlSnap.exists) {
        const { current = 0, max = 0 } = rlSnap.data();
        if (max && current >= max) {
          safeMsg(userFormMsg, `ตัวเลือก "${val}" เต็มแล้ว (${current}/${max})`);
          return;
        }
        roleToUpdate = { ref: rlRef, current, max, label: val };
        break;
      }
    }

    // บันทึก registration
    await db.collection("registrations").add({
      studentId: currentStudent,
      answers: answersBuffer,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // ถ้ามีตัวที่ต้องนับ → อัปเดต
    if (roleToUpdate) {
      await roleToUpdate.ref.update({
        current: (roleToUpdate.current || 0) + 1
      });
    }

    safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
    answersBuffer = {};
    await loadUserFormSections();
  }

  // ===== 6. ADMIN MENU =====
  document.getElementById("admin-logout-btn")?.addEventListener("click", () => {
    universalId.value = "";
    show("login-screen");
  });

  document.getElementById("admin-sections-btn")?.addEventListener("click", async () => {
    await loadAdminSections();
    show("admin-sections-screen");
  });

  document.getElementById("admin-view-users-btn")?.addEventListener("click", async () => {
    await loadAdminUsers();
    show("admin-users-screen");
  });

  document.getElementById("admin-manage-ids-btn")?.addEventListener("click", async () => {
    await loadAllowedStudents();
    show("admin-ids-screen");
  });

  document.getElementById("admin-role-limits-btn")?.addEventListener("click", async () => {
    await loadRoleLimits();
    show("admin-roles-screen");
  });

  document.getElementById("back-to-admin-from-sections")?.addEventListener("click", () => show("admin-menu-screen"));
  document.getElementById("back-to-admin-from-users")?.addEventListener("click", () => show("admin-menu-screen"));
  document.getElementById("back-to-admin-from-ids")?.addEventListener("click", () => show("admin-menu-screen"));
  document.getElementById("back-to-admin-from-roles")?.addEventListener("click", () => show("admin-menu-screen"));

  // ===== 7. ADMIN: SECTIONS =====
  async function loadAdminSections() {
    const list = document.getElementById("admin-sections-list");
    list.innerHTML = "กำลังโหลด...";

    const snap = await db.collection("form_sections").orderBy("order").get();

    if (snap.empty) {
      list.innerHTML = "<p>ยังไม่มี section</p>";
      document.getElementById("section-id").value = "sec_main";
      document.getElementById("section-title").value = "ข้อมูลทั่วไป";
      editingQuestions = [];
      renderQuestionEditor();
      return;
    }

    list.innerHTML = snap.docs.map((d) => {
      const data = d.data();
      return `
        <div class="box">
          <strong>${d.id}</strong> - ${data.title || ""}
          <button class="small-btn" data-edit="${d.id}">แก้ไข</button>
          <button class="small-btn" data-del="${d.id}">ลบ</button>
        </div>
      `;
    }).join("");

    // edit
    list.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.edit;
        const doc = await db.collection("form_sections").doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        document.getElementById("section-id").value = id;
        document.getElementById("section-title").value = data.title || "";
        editingQuestions = Array.isArray(data.questions) ? data.questions : [];
        renderQuestionEditor();
      };
    });

    // delete
    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.del;
        if (!confirm("ลบ section นี้เลย?")) return;
        await db.collection("form_sections").doc(id).delete();
        await loadAdminSections();
      };
    });

    // load first
    const first = snap.docs[0];
    if (first) {
      const data = first.data();
      document.getElementById("section-id").value = first.id;
      document.getElementById("section-title").value = data.title || "";
      editingQuestions = Array.isArray(data.questions) ? data.questions : [];
      renderQuestionEditor();
    }
  }

  // render question editor
  function renderQuestionEditor() {
    if (!qEditor) return;
    qEditor.innerHTML = "";

    if (!editingQuestions || editingQuestions.length === 0) {
      qEditor.innerHTML = `<p class="muted">ยังไม่มีคำถามใน section นี้ กดปุ่ม “เพิ่มคำถาม” ด้านบน</p>`;
      return;
    }

    editingQuestions.forEach((q, index) => {
      const div = document.createElement("div");
      div.className = "q-card";
      div.innerHTML = `
        <div class="q-header">
          <div class="q-title-group">
            <label>ชื่อคำถาม</label>
            <input type="text"
              class="q-input"
              value="${q.label || ""}"
              placeholder="เช่น ชื่อ - นามสกุล / อีเมล / บทบาทที่สมัคร"
              data-field="label"
              data-idx="${index}">
          </div>
          <div class="q-type-group">
            <label>ประเภทคำตอบ</label>
            <select class="q-select" data-field="type" data-idx="${index}">
              <option value="text" ${q.type === "text" ? "selected" : ""}>ข้อความสั้น</option>
              <option value="textarea" ${q.type === "textarea" ? "selected" : ""}>ย่อหน้า</option>
              <option value="select" ${q.type === "select" ? "selected" : ""}>ตัวเลือกแบบ dropdown</option>
            </select>
          </div>
          <button class="q-del" data-del="${index}">ลบ</button>
        </div>

        <div class="q-body" id="opts-${index}">
          ${
            q.type === "select"
              ? renderOptionList(q, index)
              : `<div class="q-hint">ผู้ใช้จะกรอกเป็นข้อความ</div>`
          }
        </div>
      `;
      qEditor.appendChild(div);
    });

    // bind change
    qEditor.querySelectorAll("[data-field]").forEach((el) => {
      el.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        editingQuestions[idx][field] = e.target.value;
        renderQuestionEditor();
      };
    });

    // bind delete q
    qEditor.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.del);
        editingQuestions.splice(idx, 1);
        renderQuestionEditor();
      };
    });
  }

  function renderOptionList(q, qIndex) {
    let html = "";
    (q.options || []).forEach((opt, i) => {
      html += `
        <div class="option-row">
          <input type="text" value="${opt.label || ""}" placeholder="ชื่อตัวเลือก" data-q="${qIndex}" data-opt="${i}" data-opt-field="label">
          <input type="number" value="${opt.limit || ""}" placeholder="จำกัด" data-q="${qIndex}" data-opt="${i}" data-opt-field="limit" style="max-width:90px">
          <input type="text" value="${opt.goTo || ""}" placeholder="ไป section" data-q="${qIndex}" data-opt="${i}" data-opt-field="goTo">
          <button class="small-btn" data-opt-del="${i}" data-q="${qIndex}">ลบ</button>
        </div>
      `;
    });
    html += `<button class="ghost" data-add-opt="${qIndex}">+ เพิ่มตัวเลือก</button>`;
    return html;
  }

  document.getElementById("add-question-btn")?.addEventListener("click", () => {
    if (!editingQuestions) editingQuestions = [];
    editingQuestions.push({
      id: "q" + Date.now(),
      label: "คำถามใหม่",
      type: "text"
    });
    renderQuestionEditor();
  });

  // options click
  qEditor.addEventListener("click", (e) => {
    if (e.target.dataset.addOpt !== undefined) {
      const qi = parseInt(e.target.dataset.addOpt);
      editingQuestions[qi].options = editingQuestions[qi].options || [];
      editingQuestions[qi].options.push({ label: "" });
      renderQuestionEditor();
    }
    if (e.target.dataset.optDel !== undefined) {
      const qi = parseInt(e.target.dataset.q);
      const oi = parseInt(e.target.dataset.optDel);
      editingQuestions[qi].options.splice(oi, 1);
      renderQuestionEditor();
    }
  });

  // options change
  qEditor.addEventListener("change", (e) => {
    if (e.target.dataset.optField !== undefined) {
      const qi = parseInt(e.target.dataset.q);
      const oi = parseInt(e.target.dataset.opt);
      const field = e.target.dataset.optField;
      const val = e.target.value;
      if (!editingQuestions[qi].options) editingQuestions[qi].options = [];
      editingQuestions[qi].options[oi][field] =
        field === "limit" && val !== "" ? parseInt(val) : val;
    }
  });

  // save section
  document.getElementById("save-section-btn")?.addEventListener("click", async () => {
    const idEl = document.getElementById("section-id");
    const titleEl = document.getElementById("section-title");
    const id = (idEl.value || "").trim();
    const title = (titleEl.value || "").trim();
    if (!id) {
      safeMsg(adminFormMsg, "กรุณาใส่รหัส Section");
      return;
    }
    await db.collection("form_sections").doc(id).set({
      title,
      questions: editingQuestions,
      order: Date.now()
    }, { merge: true });

    safeMsg(adminFormMsg, "บันทึก Section แล้ว ✅");
    await loadAdminSections();
  });

  // ===== 8. ADMIN: USERS =====
  async function loadAdminUsers() {
    const list = document.getElementById("admin-users-list");
    list.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    allRegistrationsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAdminUsers(allRegistrationsCache);

    document.getElementById("user-search-btn").onclick = () => {
      const q = (document.getElementById("user-search-input").value || "").trim();
      if (!q) {
        renderAdminUsers(allRegistrationsCache);
        return;
      }
      const filtered = allRegistrationsCache.filter((r) => (r.studentId || "").includes(q));
      renderAdminUsers(filtered);
    };
    document.getElementById("user-search-clear-btn").onclick = () => {
      document.getElementById("user-search-input").value = "";
      renderAdminUsers(allRegistrationsCache);
    };
  }

  function renderAdminUsers(list) {
    const box = document.getElementById("admin-users-list");
    if (!list || list.length === 0) {
      box.innerHTML = "<p>ไม่พบข้อมูล</p>";
      return;
    }
    box.innerHTML = list.map((item) => {
      const ans = item.answers || {};
      const ansHtml = Object.keys(ans).map((k) => `<div class="admin-user-answer"><strong>${k}:</strong> ${ans[k]}</div>`).join("");
      const timeStr = item.createdAt ? item.createdAt.toDate().toLocaleString("th-TH") : "";
      return `
        <div class="admin-user-card">
          <div class="admin-user-header">
            <span>รหัส: ${item.studentId}</span>
            <span class="admin-user-time">${timeStr}</span>
          </div>
          ${ansHtml}
        </div>
      `;
    }).join("");
  }

  // ===== 9. ADMIN: ALLOWED STUDENTS =====
  async function loadAllowedStudents() {
    const list = document.getElementById("admin-ids-list");
    list.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      list.innerHTML = "<p>ยังไม่มีรหัส</p>";
      return;
    }
    list.innerHTML = snap.docs.map((d) => `
      <div class="box">
        ${d.id}
        <button class="small-btn" data-del="${d.id}">ลบ</button>
      </div>
    `).join("");

    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.del;
        await db.collection("allowed_students").doc(id).delete();
        await loadAllowedStudents();
      };
    });
  }

  document.getElementById("add-student-id-btn")?.addEventListener("click", async () => {
    const inp = document.getElementById("new-student-id");
    const id = (inp.value || "").trim();
    if (!id) return;
    await db.collection("allowed_students").doc(id).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    inp.value = "";
    await loadAllowedStudents();
  });

  // ===== 10. ADMIN: ROLE LIMITS =====
  async function loadRoleLimits() {
    const list = document.getElementById("admin-role-list");
    list.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("role_limits").get();
    if (snap.empty) {
      list.innerHTML = "<p>ยังไม่มีข้อมูล</p>";
      return;
    }
    list.innerHTML = snap.docs.map((d) => {
      const x = d.data();
      return `
        <div class="box">
          <strong>${x.label}</strong>
          <div>ปัจจุบัน: ${x.current || 0} / ${x.max || 0}</div>
          <div class="inline">
            <input type="number" value="${x.current || 0}" data-cur="${d.id}">
            <input type="number" value="${x.max || 0}" data-max="${d.id}">
            <button class="update" data-id="${d.id}">อัปเดต</button>
            <button class="small-btn" data-del="${d.id}">ลบ</button>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".update").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const cur = parseInt(list.querySelector(`[data-cur="${id}"]`).value) || 0;
        const max = parseInt(list.querySelector(`[data-max="${id}"]`).value) || 0;
        await db.collection("role_limits").doc(id).set({
          label: id,
          current: cur,
          max: max
        }, { merge: true });
        await loadRoleLimits();
      };
    });

    list.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.del;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimits();
      };
    });
  }
});
