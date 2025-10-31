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
  let allSections = [];
  let currentSectionId = null;
  let answersBuffer = {};
  let allRegistrationsCache = [];
  let editingQuestions = []; // เก็บคำถามของ section ที่กำลังแก้

  // ===== 3. DOM =====
  const screens = {};
  document.querySelectorAll(".screen").forEach(s => screens[s.id] = s);

  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const universalId = document.getElementById("universal-id");
  const loginMsg = document.getElementById("login-msg");
  const qEditor = document.getElementById("questions-editor");
  const adminFormMsg = document.getElementById("admin-form-msg");

  function show(id) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    if (screens[id]) screens[id].classList.add("active");
  }
  function safeMsg(el, txt) { if (el) el.textContent = txt; }

  // ==== helper ====
  function buildPsuEmailFromStudentId(studentId) {
    if (!studentId) return "";
    return `s${studentId}@phuket.psu.ac.th`;
  }

  // ===== LOGIN =====
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

  // ===== USER: โหลดฟอร์มแบบหลาย section =====
  async function loadUserFormSections() {
    dynamicForm.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_sections").orderBy("order").get();
    allSections = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (allSections.length === 0) {
      dynamicForm.innerHTML = "<p>ยังไม่มีฟอร์ม</p>";
      return;
    }

    currentSectionId = allSections[0].id;
    renderSection(currentSectionId);
  }

  async function renderSection(secId) {
    const section = allSections.find(s => s.id === secId);
    if (!section) {
      dynamicForm.innerHTML = "<p>ไม่พบ Section นี้</p>";
      return;
    }

    dynamicForm.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = section.title || "แบบฟอร์ม";
    dynamicForm.appendChild(h);

    for (const q of (section.questions || [])) {
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

        for (const opt of (q.options || [])) {
          const optLabel = (opt.label || "").trim();
          const o = document.createElement("option");
          o.value = optLabel;

          // limit per option
          if (opt.limit) {
            const rlSnap = await db.collection("role_limits").doc(optLabel).get();
            const current = rlSnap.exists ? (rlSnap.data().current || 0) : 0;
            const max = opt.limit;
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

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = isLastSection(secId) ? "ส่งแบบฟอร์ม" : "ถัดไป";
    btn.addEventListener("click", () => handleNext(section));
    dynamicForm.appendChild(btn);
  }

  function isLastSection(secId) {
    const idx = allSections.findIndex(s => s.id === secId);
    return idx === allSections.length - 1;
  }

  async function handleNext(section) {
    // เก็บคำตอบของ section นี้
    for (const q of (section.questions || [])) {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      if (!el) continue;
      answersBuffer[q.id] = el.value;
    }

    // ดูว่ามี select ที่กำหนด goTo ไหม
    let jumpTo = null;
    for (const q of (section.questions || [])) {
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
      renderSection(jumpTo);
      return;
    }

    // ถ้าไม่มี goTo → ไป section ถัดไป
    const idx = allSections.findIndex(s => s.id === section.id);
    if (idx >= 0 && idx < allSections.length - 1) {
      const nextId = allSections[idx + 1].id;
      currentSectionId = nextId;
      renderSection(nextId);
    } else {
      await submitAll();
    }
  }

  async function submitAll() {
    if (!currentStudent) {
      safeMsg(userFormMsg, "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    // เช็ก limit จากคำตอบทั้งหมด
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

    await db.collection("registrations").add({
      studentId: currentStudent,
      answers: answersBuffer,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (roleToUpdate) {
      await roleToUpdate.ref.update({
        current: (roleToUpdate.current || 0) + 1
      });
    }

    safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
    answersBuffer = {};
    await loadUserFormSections();
  }

  // ===== ADMIN MENU =====
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

  document.getElementById("back-to-admin-from-sections")?.addEventListener("click", ()=>show("admin-menu-screen"));
  document.getElementById("back-to-admin-from-users")?.addEventListener("click", ()=>show("admin-menu-screen"));
  document.getElementById("back-to-admin-from-ids")?.addEventListener("click", ()=>show("admin-menu-screen"));
  document.getElementById("back-to-admin-from-roles")?.addEventListener("click", ()=>show("admin-menu-screen"));

  // ===== ADMIN: Sections =====
  async function loadAdminSections() {
    const list = document.getElementById("admin-sections-list");
    list.innerHTML = "กำลังโหลด...";

    const snap = await db.collection("form_sections").orderBy("order").get();
    if (snap.empty) {
      list.innerHTML = "<p>ยังไม่มี section</p>";
      // เตรียมช่องให้เพิ่มได้เลย
      const secIdInput = document.getElementById("section-id");
      const secTitleInput = document.getElementById("section-title");
      if (secIdInput) secIdInput.value = "sec_main";
      if (secTitleInput) secTitleInput.value = "ข้อมูลทั่วไป";
      editingQuestions = [];
      renderQuestionEditor();
      return;
    }

    list.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `
        <div class="box">
          <strong>${d.id}</strong> - ${data.title || ""}
          <button class="small-btn" data-edit="${d.id}">แก้ไข</button>
          <button class="small-btn" data-del="${d.id}">ลบ</button>
        </div>
      `;
    }).join("");

    // ผูกปุ่มแก้ไข
    list.querySelectorAll("[data-edit]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.edit;
        const doc = await db.collection("form_sections").doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        const secIdInput = document.getElementById("section-id");
        const secTitleInput = document.getElementById("section-title");
        if (secIdInput) secIdInput.value = id;
        if (secTitleInput) secTitleInput.value = data.title || "";
        editingQuestions = Array.isArray(data.questions) ? data.questions : [];
        renderQuestionEditor();
      };
    });

    // ผูกปุ่มลบ
    list.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.del;
        if (!confirm("ลบ section นี้เลย?")) return;
        await db.collection("form_sections").doc(id).delete();
        await loadAdminSections();
      };
    });
  }

  // ========== question editor (UI แบบไม่ต้องพิมพ์ JSON) ==========
  function renderQuestionEditor() {
    qEditor.innerHTML = "";
    editingQuestions.forEach((q, index) => {
      const div = document.createElement("div");
      div.className = "box";
      div.innerHTML = `
        <div class="inline">
          <input type="text" value="${q.label || ""}" placeholder="ชื่อคำถาม" data-field="label" data-idx="${index}">
          <select data-field="type" data-idx="${index}">
            <option value="text" ${q.type==="text"?"selected":""}>ข้อความ</option>
            <option value="textarea" ${q.type==="textarea"?"selected":""}>ย่อหน้า</option>
            <option value="select" ${q.type==="select"?"selected":""}>Dropdown</option>
          </select>
          <button class="small-btn" data-del="${index}">ลบ</button>
        </div>
        <div class="options-area" id="opts-${index}">
          ${q.type==="select" ? renderOptionList(q,index) : ""}
        </div>
      `;
      qEditor.appendChild(div);
    });

    // แก้ชื่อคำถาม / เปลี่ยนประเภท
    qEditor.querySelectorAll("[data-field]").forEach(el => {
      el.onchange = (e)=>{
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        editingQuestions[idx][field] = e.target.value;
        renderQuestionEditor(); // ถ้าเปลี่ยน type ให้รีเรนเดอร์
      };
    });

    // ลบคำถาม
    qEditor.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.del);
        editingQuestions.splice(idx,1);
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

  // คลิกเพิ่มคำถาม
  document.getElementById("add-question-btn")?.addEventListener("click", () => {
    editingQuestions.push({ label: "", type: "text" });
    renderQuestionEditor();
  });

  // จัดการตัวเลือกของ dropdown
  qEditor.addEventListener("click", e => {
    // เพิ่มตัวเลือก
    if (e.target.dataset.addOpt !== undefined) {
      const qi = parseInt(e.target.dataset.addOpt);
      editingQuestions[qi].options = editingQuestions[qi].options || [];
      editingQuestions[qi].options.push({ label: "" });
      renderQuestionEditor();
    }
    // ลบตัวเลือก
    if (e.target.dataset.optDel !== undefined) {
      const qi = parseInt(e.target.dataset.q);
      const oi = parseInt(e.target.dataset.optDel);
      editingQuestions[qi].options.splice(oi,1);
      renderQuestionEditor();
    }
  });

  qEditor.addEventListener("change", e => {
    if (e.target.dataset.optField !== undefined) {
      const qi = parseInt(e.target.dataset.q);
      const oi = parseInt(e.target.dataset.opt);
      const field = e.target.dataset.optField;
      const val = e.target.value;
      if (!editingQuestions[qi].options) editingQuestions[qi].options = [];
      editingQuestions[qi].options[oi][field] =
        (field === "limit" && val !== "") ? parseInt(val) : val;
    }
  });

  // ✅ ปุ่มบันทึก section (เวอร์ชันกัน null)
  document.getElementById("save-section-btn")?.addEventListener("click", async () => {
    const idEl = document.getElementById("section-id");
    const titleEl = document.getElementById("section-title");

    if (!idEl || !titleEl) {
      console.warn("section-id หรือ section-title ยังไม่อยู่ใน DOM ตอนกดบันทึก");
      return;
    }

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

  // ===== ADMIN: users =====
  async function loadAdminUsers() {
    const list = document.getElementById("admin-users-list");
    list.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("registrations").orderBy("createdAt","desc").get();
    allRegistrationsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminUsers(allRegistrationsCache);

    document.getElementById("user-search-btn").onclick = () => {
      const q = (document.getElementById("user-search-input").value || "").trim();
      if (!q) {
        renderAdminUsers(allRegistrationsCache);
        return;
      }
      const filtered = allRegistrationsCache.filter(r => (r.studentId || "").includes(q));
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
    box.innerHTML = list.map(item => {
      const ans = item.answers || {};
      const ansHtml = Object.keys(ans).map(k => `<div class="admin-user-answer"><strong>${k}:</strong> ${ans[k]}</div>`).join("");
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

  // ===== ADMIN: allowed students =====
  async function loadAllowedStudents() {
    const list = document.getElementById("admin-ids-list");
    list.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      list.innerHTML = "<p>ยังไม่มีรหัส</p>";
      return;
    }
    list.innerHTML = snap.docs.map(d => `
      <div class="box">
        ${d.id}
        <button class="small-btn" data-del="${d.id}">ลบ</button>
      </div>
    `).join("");

    list.querySelectorAll("[data-del]").forEach(btn => {
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

  // ===== ADMIN: role limits =====
  async function loadRoleLimits() {
    const list = document.getElementById("admin-role-list");
    list.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("role_limits").get();
    if (snap.empty) {
      list.innerHTML = "<p>ยังไม่มีข้อมูล</p>";
      return;
    }
    list.innerHTML = snap.docs.map(d => {
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

    list.querySelectorAll(".update").forEach(btn => {
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

    list.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.del;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimits();
      };
    });
  }

});
