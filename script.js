document.addEventListener("DOMContentLoaded", () => {
  // ===== FIREBASE =====
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
  console.log("🔥 Firebase ready");

  // ===== STATE =====
  const ADMIN_CODE = "0826940174";
  let currentStudentId = null;
  let currentQuestions = [];     // from form_questions
  let registrationsCache = [];
  let roleLimitsCache = [];

  // ===== DOM HELPERS =====
  const screens = {};
  document.querySelectorAll(".screen").forEach(s => screens[s.id] = s);
  const show = (id) => {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[id]?.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loginInput = document.getElementById("universal-id");
  const loginMsg = document.getElementById("login-msg");

  // ===== LOGIN =====
  document.getElementById("login-btn").addEventListener("click", async () => {
    const code = (loginInput.value || "").trim();
    if (!code) {
      loginMsg.textContent = "กรุณากรอกรหัส";
      return;
    }

    // Admin
    if (code === ADMIN_CODE) {
      await loadFormQuestions();
      await loadUsersForAdmin();
      await loadRoleLimitsForAdmin();
      show("admin-menu-screen");
      return;
    }

    // Student: check allowed
    const allow = await db.collection("allowed_students").doc(code).get();
    if (!allow.exists) {
      loginMsg.textContent = "ยังไม่ได้รับอนุญาตให้ลงทะเบียน";
      return;
    }

    currentStudentId = code;
    await loadFormQuestions();   // for user too
    await renderUserForm();
    show("user-form-screen");
  });

  // ===== USER LOGOUT =====
  document.getElementById("user-logout-btn").addEventListener("click", () => {
    currentStudentId = null;
    loginInput.value = "";
    show("login-screen");
  });
  document.getElementById("success-logout-btn").addEventListener("click", () => {
    currentStudentId = null;
    loginInput.value = "";
    show("login-screen");
  });

  // ===== LOAD FORM QUESTIONS =====
  async function loadFormQuestions() {
    const snap = await db.collection("form_questions").orderBy("order").get();
    if (snap.empty) {
      // ถ้ายังไม่มีเลย ให้สร้าง default 3 คำถามตอนแรก
      const defaults = [
        { label: "ชื่อ - นามสกุล", type: "text" },
        { label: "อีเมล (ใช้อีเมลมหาวิทยาลัยเท่านั้น)", type: "text", autoEmail: true },
        { label: "บทบาทที่สมัคร", type: "select", options: [
          { label: "ผู้จัดงาน", limit: true },
          { label: "ผู้แข่งขัน", limit: true },
          { label: "สตาฟ", limit: true },
        ]}
      ];
      let order = 1;
      for (const q of defaults) {
        await db.collection("form_questions").add({
          label: q.label,
          type: q.type,
          options: q.options || [],
          autoEmail: q.autoEmail || false,
          order: order++
        });
      }
      return loadFormQuestions();
    } else {
      currentQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  }

  // ===== RENDER USER FORM =====
  async function renderUserForm() {
    const wrap = document.getElementById("dynamic-user-form");
    wrap.innerHTML = "";

    // โหลด role limits มาก่อน เพื่อโชว์ (current/max)
    const rlSnap = await db.collection("role_limits").get();
    roleLimitsCache = rlSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const q of currentQuestions) {
      const f = document.createElement("div");
      f.className = "form-field";
      const label = document.createElement("label");
      label.textContent = q.label;
      f.appendChild(label);

      // auto email จาก studentId
      if (q.autoEmail && currentStudentId) {
        const inp = document.createElement("input");
        inp.type = "email";
        inp.name = q.id;
        inp.value = `s${currentStudentId}@phuket.psu.ac.th`;
        inp.readOnly = true;
        f.appendChild(inp);
        wrap.appendChild(f);
        continue;
      }

      if (q.type === "text") {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.name = q.id;
        f.appendChild(inp);
      } else if (q.type === "textarea") {
        const ta = document.createElement("textarea");
        ta.name = q.id;
        ta.rows = 3;
        f.appendChild(ta);
      } else if (q.type === "select") {
        const sel = document.createElement("select");
        sel.name = q.id;

        (q.options || []).forEach(opt => {
          const o = document.createElement("option");
          o.value = opt.label;
          if (opt.limit) {
            // ถ้าตัวนี้ติด limit → หาใน role_limits
            const m = roleLimitsCache.find(r => r.label === opt.label);
            const cur = m ? (m.current || 0) : 0;
            const max = m ? (m.max || 0) : (opt.max || 0);
            o.textContent = `${opt.label} (${cur}/${max || 0})`;
            if (max && cur >= max) {
              o.disabled = true;
            }
          } else {
            o.textContent = opt.label;
          }
          sel.appendChild(o);
        });

        f.appendChild(sel);
      }

      wrap.appendChild(f);
    }

    // ปุ่มส่ง
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "submit-form-btn";
    btn.textContent = "ส่งแบบฟอร์ม";
    btn.className = "btn primary mt-1";
    wrap.appendChild(btn);

    const msg = document.createElement("p");
    msg.id = "user-form-msg";
    msg.className = "msg";
    wrap.appendChild(msg);

    // bind
    btn.addEventListener("click", submitUserForm);
  }

  // ===== SUBMIT USER FORM (with role limit) =====
  async function submitUserForm() {
    const msg = document.getElementById("user-form-msg");
    msg.textContent = "";

    if (!currentStudentId) {
      msg.textContent = "กรุณาเข้าสู่ระบบก่อน";
      return;
    }

    // ดึงค่าทุก input
    const formEl = document.getElementById("dynamic-user-form");
    const answers = {};
    let limitedRole = null;   // ชื่อตัวเลือกที่เป็น limit

    for (const q of currentQuestions) {
      const el = formEl.querySelector(`[name="${q.id}"]`);
      if (!el) continue;
      const val = el.value;
      answers[q.label] = val;

      // ถ้าเป็น select และเป็นตัวที่มี limit
      if (q.type === "select") {
        const optConf = (q.options || []).find(o => o.label === val);
        if (optConf && optConf.limit) {
          limitedRole = val;
        }
      }
    }

    // ถ้าเลือกบทบาทที่จำกัด → เช็กด้วย transaction
    if (limitedRole) {
      const roleRef = db.collection("role_limits").doc(limitedRole);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(roleRef);
          if (!snap.exists) {
            // ถ้าแอดมินเพิ่งตั้งในฟอร์มครั้งแรก
            tx.set(roleRef, { label: limitedRole, current: 1, max: 1 });
          } else {
            const data = snap.data();
            const cur = data.current || 0;
            const max = data.max || 0;
            if (max && cur >= max) {
              throw new Error(`บทบาท "${limitedRole}" เต็มแล้ว`);
            }
            tx.update(roleRef, { current: cur + 1 });
          }

          tx.set(db.collection("registrations").doc(), {
            studentId: currentStudentId,
            answers,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        show("user-success-screen");
      } catch (err) {
        msg.textContent = err.message || "ส่งไม่สำเร็จ";
        // refresh ฟอร์มให้เห็นว่าเต็มแล้ว
        await renderUserForm();
      }
    } else {
      // ไม่มี limit → บันทึกตรงๆ
      await db.collection("registrations").add({
        studentId: currentStudentId,
        answers,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      show("user-success-screen");
    }
  }

  // ===== ADMIN LOGOUT =====
  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    loginInput.value = "";
    show("login-screen");
  });

  // ===== ADMIN: FORM BUILDER =====
  document.getElementById("admin-form-builder-btn").addEventListener("click", async () => {
    await loadFormQuestions();
    renderAdminFormBuilder();
    show("admin-form-screen");
  });
  document.getElementById("back-to-admin-from-form").addEventListener("click", () => {
    show("admin-menu-screen");
  });

  function renderAdminFormBuilder() {
    const box = document.getElementById("admin-form-list");
    box.innerHTML = "";
    if (currentQuestions.length === 0) {
      box.innerHTML = "<p class='muted'>ยังไม่มีคำถาม</p>";
      return;
    }

    currentQuestions.forEach((q, idx) => {
      const card = document.createElement("div");
      card.className = "q-card";

      const head = document.createElement("div");
      head.className = "q-card-header";
      head.innerHTML = `
        <input type="text" value="${q.label || ""}" data-id="${q.id}" data-field="label" />
        <select data-id="${q.id}" data-field="type">
          <option value="text" ${q.type === "text" ? "selected" : ""}>ข้อความสั้น</option>
          <option value="textarea" ${q.type === "textarea" ? "selected" : ""}>ย่อหน้า</option>
          <option value="select" ${q.type === "select" ? "selected" : ""}>ตัวเลือก (dropdown)</option>
        </select>
        <button class="q-del" data-del="${q.id}">ลบ</button>
      `;
      card.appendChild(head);

      // options part
      const body = document.createElement("div");
      body.className = "q-options";
      if (q.type === "select") {
        (q.options || []).forEach((opt, oi) => {
          const row = document.createElement("div");
          row.className = "option-row";
          row.innerHTML = `
            <input type="text" value="${opt.label || ""}" placeholder="ชื่อตัวเลือก"
              data-id="${q.id}" data-opt="${oi}" data-opt-field="label" />
            <input type="number" value="${opt.max || ""}" placeholder="max"
              data-id="${q.id}" data-opt="${oi}" data-opt-field="max" />
            <label>
              <input type="checkbox" ${opt.limit ? "checked" : ""} data-id="${q.id}" data-opt="${oi}" data-opt-field="limit" />
              จำกัด
            </label>
            <button class="opt-del" data-id="${q.id}" data-opt-del="${oi}">ลบ</button>
          `;
          body.appendChild(row);
        });

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "add-option-btn";
        addBtn.textContent = "+ เพิ่มตัวเลือก";
        addBtn.dataset.addOpt = q.id;
        body.appendChild(addBtn);
      } else {
        body.innerHTML = `<p class="tiny muted">ผู้ใช้จะกรอกเป็นข้อความ</p>`;
      }

      card.appendChild(body);
      box.appendChild(card);
    });
  }

  // change on builder
  document.getElementById("admin-form-list").addEventListener("change", async (e) => {
    const id = e.target.dataset.id;
    const field = e.target.dataset.field;
    const optField = e.target.dataset.optField;

    // change label/type
    if (id && field) {
      const val = field === "type" ? e.target.value : e.target.value;
      await db.collection("form_questions").doc(id).update({ [field]: val });
      await loadFormQuestions();
      renderAdminFormBuilder();
      return;
    }

    // change option
    if (id && optField) {
      const qDoc = await db.collection("form_questions").doc(id).get();
      const data = qDoc.data();
      const opts = data.options || [];
      const oi = parseInt(e.target.dataset.opt, 10);
      if (!opts[oi]) return;
      if (optField === "limit") {
        opts[oi].limit = e.target.checked;
        // ถ้าติ๊กจำกัด → สร้าง role_limits ให้เลย (ถ้ายังไม่มี)
        if (e.target.checked) {
          const roleDoc = await db.collection("role_limits").doc(opts[oi].label).get();
          if (!roleDoc.exists) {
            await db.collection("role_limits").doc(opts[oi].label).set({
              label: opts[oi].label,
              current: 0,
              max: opts[oi].max ? Number(opts[oi].max) : 1
            });
          }
        }
      } else if (optField === "max") {
        opts[oi].max = Number(e.target.value);
      } else {
        // label
        opts[oi].label = e.target.value;
      }
      await db.collection("form_questions").doc(id).update({ options: opts });
      await loadFormQuestions();
      renderAdminFormBuilder();
      return;
    }
  });

  // click on builder (add / del option, del question)
  document.getElementById("admin-form-list").addEventListener("click", async (e) => {
    // delete question
    if (e.target.dataset.del) {
      const id = e.target.dataset.del;
      await db.collection("form_questions").doc(id).delete();
      await loadFormQuestions();
      renderAdminFormBuilder();
    }

    // add option
    if (e.target.dataset.addOpt) {
      const id = e.target.dataset.addOpt;
      const qDoc = await db.collection("form_questions").doc(id).get();
      const data = qDoc.data();
      const opts = data.options || [];
      opts.push({ label: "ตัวเลือกใหม่", limit: false });
      await db.collection("form_questions").doc(id).update({ options: opts });
      await loadFormQuestions();
      renderAdminFormBuilder();
    }

    // delete option
    if (e.target.dataset.optDel !== undefined) {
      const id = e.target.dataset.id;
      const oi = parseInt(e.target.dataset.optDel, 10);
      const qDoc = await db.collection("form_questions").doc(id).get();
      const data = qDoc.data();
      const opts = data.options || [];
      opts.splice(oi, 1);
      await db.collection("form_questions").doc(id).update({ options: opts });
      await loadFormQuestions();
      renderAdminFormBuilder();
    }
  });

  // add new question
  document.getElementById("add-question-btn").addEventListener("click", async () => {
    const label = (document.getElementById("new-q-label").value || "").trim();
    const type = document.getElementById("new-q-type").value;
    if (!label) return;
    await db.collection("form_questions").add({
      label,
      type,
      options: [],
      order: Date.now()
    });
    document.getElementById("new-q-label").value = "";
    await loadFormQuestions();
    renderAdminFormBuilder();
  });

  // ===== ADMIN: USERS =====
  document.getElementById("admin-view-users-btn").addEventListener("click", async () => {
    await loadUsersForAdmin();
    show("admin-users-screen");
  });
  document.getElementById("back-to-admin-from-users").addEventListener("click", () => {
    show("admin-menu-screen");
  });

  async function loadUsersForAdmin() {
    const box = document.getElementById("admin-users-list");
    box.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("registrations").orderBy("createdAt","desc").get();
    registrationsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminUsers(registrationsCache);
  }
  function renderAdminUsers(list) {
    const box = document.getElementById("admin-users-list");
    if (!list || list.length === 0) {
      box.innerHTML = "<p class='muted'>ยังไม่มีผู้สมัคร</p>";
      return;
    }
    box.innerHTML = list.map(item => {
      const t = item.createdAt ? item.createdAt.toDate().toLocaleString("th-TH") : "";
      const ans = item.answers || {};
      const ansHtml = Object.keys(ans).map(k => `<div>${k}: ${ans[k]}</div>`).join("");
      return `
        <div class="admin-card">
          <div class="title-line">
            <span>${item.studentId}</span>
            <small>${t}</small>
          </div>
          ${ansHtml}
        </div>
      `;
    }).join("");
  }

  // search
  document.getElementById("user-search-btn").addEventListener("click", () => {
    const q = (document.getElementById("user-search-input").value || "").trim();
    if (!q) {
      renderAdminUsers(registrationsCache);
      return;
    }
    const f = registrationsCache.filter(r => (r.studentId || "").includes(q));
    renderAdminUsers(f);
  });
  document.getElementById("user-search-clear-btn").addEventListener("click", () => {
    document.getElementById("user-search-input").value = "";
    renderAdminUsers(registrationsCache);
  });

  // ===== ADMIN: ALLOWED STUDENTS =====
  document.getElementById("admin-manage-ids-btn").addEventListener("click", async () => {
    await loadAllowedStudents();
    show("admin-ids-screen");
  });
  document.getElementById("back-to-admin-from-ids").addEventListener("click", () => {
    show("admin-menu-screen");
  });

  async function loadAllowedStudents() {
    const box = document.getElementById("admin-ids-list");
    box.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      box.innerHTML = "<p class='muted'>ยังไม่มีรหัส</p>";
      return;
    }
    box.innerHTML = snap.docs.map(d => `
      <div class="admin-card">
        <div class="title-line">
          <span>${d.id}</span>
          <button class="btn ghost small" data-del-id="${d.id}">ลบ</button>
        </div>
      </div>
    `).join("");

    box.querySelectorAll("[data-del-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.delId;
        await db.collection("allowed_students").doc(id).delete();
        await loadAllowedStudents();
      });
    });
  }

  document.getElementById("add-student-id-btn").addEventListener("click", async () => {
    const inp = document.getElementById("new-student-id");
    const id = (inp.value || "").trim();
    if (!id) return;
    await db.collection("allowed_students").doc(id).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    inp.value = "";
    await loadAllowedStudents();
  });

  // ===== ADMIN: ROLE LIMITS =====
  document.getElementById("admin-role-limits-btn").addEventListener("click", async () => {
    await loadRoleLimitsForAdmin();
    show("admin-roles-screen");
  });
  document.getElementById("back-to-admin-from-roles").addEventListener("click", () => {
    show("admin-menu-screen");
  });

  async function loadRoleLimitsForAdmin() {
    const box = document.getElementById("admin-role-list");
    box.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("role_limits").get();
    if (snap.empty) {
      box.innerHTML = "<p class='muted'>ยังไม่มีบทบาท</p>";
      return;
    }
    box.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `
        <div class="admin-card">
          <div class="title-line">
            <span>${data.label}</span>
            <button class="btn ghost small" data-del-role="${d.id}">ลบ</button>
          </div>
          <div class="inline mt-1">
            <input type="number" value="${data.current || 0}" data-cur="${d.id}" />
            <input type="number" value="${data.max || 0}" data-max="${d.id}" />
            <button class="btn small primary" data-update-role="${d.id}">อัปเดต</button>
          </div>
        </div>
      `;
    }).join("");

    // update
    box.querySelectorAll("[data-update-role]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.updateRole;
        const cur = parseInt(box.querySelector(`[data-cur="${id}"]`).value) || 0;
        const max = parseInt(box.querySelector(`[data-max="${id}"]`).value) || 0;
        await db.collection("role_limits").doc(id).set({
          label: id,
          current: cur,
          max: max
        }, { merge: true });
        await loadRoleLimitsForAdmin();
      });
    });

    // delete
    box.querySelectorAll("[data-del-role]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.delRole;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimitsForAdmin();
      });
    });
  }

  // add role manually
  document.getElementById("add-role-btn").addEventListener("click", async () => {
    const lbl = (document.getElementById("new-role-label").value || "").trim();
    const max = parseInt(document.getElementById("new-role-max").value) || 0;
    if (!lbl) return;
    await db.collection("role_limits").doc(lbl).set({
      label: lbl,
      current: 0,
      max: max
    });
    document.getElementById("new-role-label").value = "";
    document.getElementById("new-role-max").value = "";
    await loadRoleLimitsForAdmin();
  });

});
