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

  const ADMIN_CODE = "0826940174";
  let currentStudentId = null;
  let currentQuestions = [];
  let registrationsCache = [];
  let roleLimitsCache = [];

  // ===== DOM =====
  const screens = {};
  document.querySelectorAll(".screen").forEach(s => screens[s.id] = s);
  const show = (id) => {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    if (screens[id]) screens[id].classList.add("active");
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

    // admin
    if (code === ADMIN_CODE) {
      try {
        await loadFormQuestions();
        await loadUsersForAdmin();
        await loadRoleLimitsForAdmin();
        show("admin-menu-screen");
      } catch (err) {
        console.error(err);
        loginMsg.textContent = "โหลดข้อมูลแอดมินไม่ได้: " + err.message;
      }
      return;
    }

    // student: check allowed
    try {
      const allow = await db.collection("allowed_students").doc(code).get();
      if (!allow.exists) {
        loginMsg.textContent = "ยังไม่ได้รับอนุญาตให้ลงทะเบียน";
        return;
      }
      currentStudentId = code;
      await loadFormQuestions();
      await renderUserForm();
      show("user-form-screen");
    } catch (err) {
      console.error(err);
      loginMsg.textContent = "อ่านข้อมูลไม่ได้ (เช็ก Firestore rules)";
    }
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
    const ref = db.collection("form_questions").orderBy("order");
    const snap = await ref.get();   // <--- ที่นี่ถ้า rules ไม่ให้ จะ error
    if (snap.empty) {
      // create defaults
      let order = 1;
      const defaults = [
        { label: "ชื่อ - นามสกุล", type: "text", required: true },
        { label: "อีเมล (ใช้อีเมลมหาวิทยาลัยเท่านั้น)", type: "text", autoEmail: true, required: true },
        {
          label: "บทบาทที่สมัคร",
          type: "select",
          required: true,
          options: [
            { label: "ผู้จัดงาน", limit: true, max: 5 },
            { label: "ผู้แข่งขัน", limit: true, max: 20 },
            { label: "สตาฟ", limit: true, max: 10 }
          ]
        }
      ];
      for (const q of defaults) {
        await db.collection("form_questions").add({ ...q, order: order++ });
      }
      return loadFormQuestions();
    }
    currentQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ===== RENDER USER FORM =====
  async function renderUserForm() {
    const wrap = document.getElementById("dynamic-user-form");
    wrap.innerHTML = "";

    // load role limits
    try {
      const rlSnap = await db.collection("role_limits").get();
      roleLimitsCache = rlSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("read role_limits fail", err);
      roleLimitsCache = [];
      // ก็ยังเรนเดอร์ฟอร์มได้ แค่จะไม่โชว์จำนวน
    }

    for (const q of currentQuestions) {
      const f = document.createElement("div");
      f.className = "form-field";
      const lbl = document.createElement("label");
      lbl.textContent = q.label + (q.required ? " *" : "");
      f.appendChild(lbl);

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
            const m = roleLimitsCache.find(r => r.label === opt.label);
            const cur = m ? (m.current || 0) : 0;
            const max = m ? (m.max || opt.max || 0) : (opt.max || 0);
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

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "submit-form-btn";
    btn.className = "btn primary mt-1";
    btn.textContent = "ส่งแบบฟอร์ม";
    wrap.appendChild(btn);

    const msg = document.createElement("p");
    msg.id = "user-form-msg";
    msg.className = "msg";
    wrap.appendChild(msg);

    btn.addEventListener("click", submitUserForm);
  }

  // ===== SUBMIT USER FORM =====
  async function submitUserForm() {
    const msg = document.getElementById("user-form-msg");
    msg.textContent = "";

    if (!currentStudentId) {
      msg.textContent = "กรุณาเข้าสู่ระบบก่อน";
      return;
    }

    const formEl = document.getElementById("dynamic-user-form");
    const answers = {};
    let limitedRole = null;

    for (const q of currentQuestions) {
      const el = formEl.querySelector(`[name="${q.id}"]`);
      if (!el) continue;
      const val = el.value.trim();

      if (q.required && !val) {
        msg.textContent = `กรุณากรอก: ${q.label}`;
        return;
      }

      answers[q.label] = val;

      if (q.type === "select") {
        const optConf = (q.options || []).find(o => o.label === val);
        if (optConf && optConf.limit) {
          limitedRole = val;
        }
      }
    }

    // มี role limit
    if (limitedRole) {
      const roleRef = db.collection("role_limits").doc(limitedRole);
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(roleRef);
          if (!snap.exists) {
            // หา max จากฟอร์ม
            const qHas = currentQuestions.find(q => (q.options || []).some(o => o.label === limitedRole));
            const opt = qHas ? (qHas.options || []).find(o => o.label === limitedRole) : null;
            const max = opt && opt.max ? Number(opt.max) : 1;
            tx.set(roleRef, { label: limitedRole, current: 1, max });
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
        console.error(err);
        msg.textContent = err.message || "ส่งไม่สำเร็จ (เช็ก rules / จำนวนเต็มแล้ว)";
        // refresh ให้เห็นว่าเต็ม
        await renderUserForm();
      }
    } else {
      // ไม่มี limit
      try {
        await db.collection("registrations").add({
          studentId: currentStudentId,
          answers,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        show("user-success-screen");
      } catch (err) {
        console.error(err);
        msg.textContent = "ส่งไม่สำเร็จ: " + err.message;
      }
    }
  }

  // ===== ADMIN =====
  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    loginInput.value = "";
    show("login-screen");
  });

  // --- FORM BUILDER
  document.getElementById("admin-form-builder-btn").addEventListener("click", async () => {
    try {
      await loadFormQuestions();
      renderAdminFormBuilder();
      show("admin-form-screen");
    } catch (err) {
      console.error(err);
      alert("โหลดฟอร์มไม่ได้: " + err.message);
    }
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

    currentQuestions.forEach((q) => {
      const card = document.createElement("div");
      card.className = "q-card";
      card.innerHTML = `
        <div class="q-card-header">
          <input type="text" value="${q.label || ""}" data-id="${q.id}" data-field="label" />
          <select data-id="${q.id}" data-field="type">
            <option value="text" ${q.type === "text" ? "selected" : ""}>ข้อความสั้น</option>
            <option value="textarea" ${q.type === "textarea" ? "selected" : ""}>ย่อหน้า</option>
            <option value="select" ${q.type === "select" ? "selected" : ""}>ตัวเลือก (dropdown)</option>
          </select>
          <label class="inline-check">
            <input type="checkbox" data-id="${q.id}" data-field="autoEmail" ${q.autoEmail ? "checked" : ""} />
            auto-email
          </label>
          <label class="inline-check">
            <input type="checkbox" data-id="${q.id}" data-field="required" ${q.required ? "checked" : ""} />
            required
          </label>
          <button class="q-move" data-move-up="${q.id}">⬆</button>
          <button class="q-move" data-move-down="${q.id}">⬇</button>
          <button class="q-del" data-del="${q.id}">ลบ</button>
        </div>
        <div class="q-options" id="opts-${q.id}">
          ${
            q.type === "select"
              ? (q.options || []).map((opt, oi) => `
                <div class="option-row">
                  <input type="text" value="${opt.label || ""}" placeholder="ชื่อตัวเลือก"
                    data-id="${q.id}" data-opt="${oi}" data-opt-field="label" />
                  <input type="number" value="${opt.max || ""}" placeholder="max"
                    data-id="${q.id}" data-opt="${oi}" data-opt-field="max" />
                  <label>
                    <input type="checkbox"
                      data-id="${q.id}" data-opt="${oi}" data-opt-field="limit"
                      ${opt.limit ? "checked" : ""} />
                    จำกัดจำนวน
                  </label>
                  <button class="opt-del" data-id="${q.id}" data-opt-del="${oi}">ลบ</button>
                </div>
              `).join("") + `<button class="add-option-btn" data-add-opt="${q.id}">+ เพิ่มตัวเลือก</button>`
              : `<p class="tiny muted">ผู้ใช้จะกรอกเป็นข้อความ</p>`
          }
        </div>
      `;
      box.appendChild(card);
    });
  }

  // change in builder
  document.getElementById("admin-form-list").addEventListener("change", async (e) => {
    const id = e.target.dataset.id;
    const field = e.target.dataset.field;
    const optField = e.target.dataset.optField;

    try {
      // change label/type/autoEmail/required
      if (id && field) {
        const val = (field === "autoEmail" || field === "required") ? e.target.checked : e.target.value;
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
          if (e.target.checked && opts[oi].label) {
            const rl = await db.collection("role_limits").doc(opts[oi].label).get();
            if (!rl.exists) {
              await db.collection("role_limits").doc(opts[oi].label).set({
                label: opts[oi].label,
                current: 0,
                max: opts[oi].max ? Number(opts[oi].max) : 1
              });
            }
          }
        } else if (optField === "max") {
          opts[oi].max = Number(e.target.value);
          // ถ้ามี doc role_limits อยู่แล้วก็อัปเดตเลย
          await db.collection("role_limits").doc(opts[oi].label).set({
            label: opts[oi].label,
            max: Number(e.target.value),
          }, { merge: true });
        } else {
          // label
          const oldLabel = opts[oi].label;
          opts[oi].label = e.target.value;
          // อัปเดต role_limits ชื่อใหม่ด้วย (ง่ายสุดคือเขียนอันใหม่ทับ)
          await db.collection("role_limits").doc(e.target.value).set({
            label: e.target.value,
            current: 0,
            max: opts[oi].max ? Number(opts[oi].max) : 1
          }, { merge: true });
        }

        await db.collection("form_questions").doc(id).update({ options: opts });
        await loadFormQuestions();
        renderAdminFormBuilder();
      }
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่ได้: " + err.message);
    }
  });

  // click in builder
  document.getElementById("admin-form-list").addEventListener("click", async (e) => {
    try {
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

      // move up
      if (e.target.dataset.moveUp) {
        const id = e.target.dataset.moveUp;
        await moveQuestion(id, -1);
      }
      // move down
      if (e.target.dataset.moveDown) {
        const id = e.target.dataset.moveDown;
        await moveQuestion(id, +1);
      }
    } catch (err) {
      console.error(err);
      alert("ทำรายการไม่ได้: " + err.message);
    }
  });

  async function moveQuestion(qid, dir) {
    const snap = await db.collection("form_questions").orderBy("order").get();
    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const idx = arr.findIndex(x => x.id === qid);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;

    const curOrder = arr[idx].order;
    const newOrder = arr[newIdx].order;
    const batch = db.batch();
    batch.update(db.collection("form_questions").doc(arr[idx].id), { order: newOrder });
    batch.update(db.collection("form_questions").doc(arr[newIdx].id), { order: curOrder });
    await batch.commit();

    await loadFormQuestions();
    renderAdminFormBuilder();
  }

  // add new question
  document.getElementById("add-question-btn").addEventListener("click", async () => {
    const label = (document.getElementById("new-q-label").value || "").trim();
    const type = document.getElementById("new-q-type").value;
    const autoEmail = document.getElementById("new-q-autoemail").checked;
    const required = document.getElementById("new-q-required").checked;
    if (!label) return;

    const order = Date.now();

    try {
      await db.collection("form_questions").add({
        label,
        type,
        autoEmail,
        required,
        options: [],
        order
      });
      document.getElementById("new-q-label").value = "";
      document.getElementById("new-q-autoemail").checked = false;
      document.getElementById("new-q-required").checked = false;
      await loadFormQuestions();
      renderAdminFormBuilder();
    } catch (err) {
      console.error(err);
      alert("เพิ่มคำถามไม่ได้: " + err.message);
    }
  });

  // reset form
  document.getElementById("reset-form-btn").addEventListener("click", async () => {
    const ok = confirm("รีเซ็ตแบบฟอร์มกลับค่าเริ่มต้นทั้งหมด?");
    if (!ok) return;
    try {
      const snap = await db.collection("form_questions").get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      await loadFormQuestions();
      renderAdminFormBuilder();
    } catch (err) {
      console.error(err);
      alert("รีเซ็ตไม่ได้: " + err.message);
    }
  });

  // ===== ADMIN USERS =====
  document.getElementById("admin-view-users-btn").addEventListener("click", async () => {
    try {
      await loadUsersForAdmin();
      show("admin-users-screen");
    } catch (err) {
      alert("โหลดรายชื่อไม่ได้: " + err.message);
    }
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
    try {
      await loadAllowedStudents();
      show("admin-ids-screen");
    } catch (err) {
      alert("โหลดรหัสไม่ได้: " + err.message);
    }
  });
  document.getElementById("back-to-admin-from-ids").addEventListener("click", () => {
    show("admin-menu-screen");
  });

  async function loadAllowedStudents() {
    const box = document.getElementById("admin-ids-list");
    box.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      box.innerHTML = "<p class='muted'>ยังไม่มีรหัสที่อนุญาต</p>";
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
    const id = (document.getElementById("new-student-id").value || "").trim();
    if (!id) return;
    await db.collection("allowed_students").doc(id).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("new-student-id").value = "";
    await loadAllowedStudents();
  });

  // ===== ADMIN: ROLE LIMITS =====
  document.getElementById("admin-role-limits-btn").addEventListener("click", async () => {
    try {
      await loadRoleLimitsForAdmin();
      show("admin-roles-screen");
    } catch (err) {
      alert("โหลดบทบาทไม่ได้: " + err.message);
    }
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

    box.querySelectorAll("[data-del-role]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.delRole;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimitsForAdmin();
      });
    });
  }

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
