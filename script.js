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
  let allSections = [];    // [{id,title,questions:[]}]
  let currentSectionId = null;
  let answersBuffer = {};  // เก็บคำตอบทุก section ก่อน submit
  let allRegistrationsCache = [];
  let adminQuestionsCache = {}; // ใช้แปลง id -> label ตอนแอดมินดู

  // ===== 3. DOM =====
  const screens = {};
  document.querySelectorAll(".screen").forEach(s => screens[s.id] = s);
  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const universalId = document.getElementById("universal-id");
  const loginMsg = document.getElementById("login-msg");

  function show(id) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[id]?.classList.add("active");
  }
  function safeMsg(el, txt) { if (el) el.textContent = txt; }

  // ===== 4. build email =====
  function buildPsuEmailFromStudentId(studentId) {
    if (!studentId) return "";
    return `s${studentId}@phuket.psu.ac.th`;
  }

  // ===== 5. LOGIN =====
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
    await loadUserFormAsSections();
    show("user-form-screen");
  });

  document.getElementById("user-back-btn")?.addEventListener("click", () => {
    currentStudent = null;
    universalId.value = "";
    show("login-screen");
  });

  // ===== 6. USER: load sections =====
  async function loadUserFormAsSections() {
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

  async function renderSection(sectionId) {
    const section = allSections.find(s => s.id === sectionId);
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

      const normalized = (q.label || "").trim();
      const isEmailQuestion =
        normalized.includes("อีเมล") ||
        normalized.toLowerCase().includes("email");

      // อีเมล auto
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

      if (q.type === "select") {
        const sel = document.createElement("select");
        sel.name = q.id;

        // map สำหรับ goTo
        const goToMap = {};

        for (const opt of q.options || []) {
          const optLabel = (opt.label || "").trim();
          const o = document.createElement("option");
          o.value = optLabel;

          // จำกัดจำนวน
          const rl = await db.collection("role_limits").doc(optLabel).get();
          if (rl.exists) {
            const { current = 0, max = 0 } = rl.data();
            o.textContent = max ? `${optLabel} (${current}/${max})` : optLabel;
            if (max && current >= max) o.disabled = true;
          } else {
            o.textContent = optLabel;
          }

          if (opt.goTo) {
            goToMap[optLabel] = opt.goTo;
          }

          sel.appendChild(o);
        }

        // ผูก map ไว้กับ element
        sel._goToMap = goToMap;
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

    // ปุ่มถัดไป / ส่ง
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = isLastSection(sectionId) ? "ส่งแบบฟอร์ม" : "ถัดไป";
    btn.addEventListener("click", () => handleSectionNext(section));
    dynamicForm.appendChild(btn);
  }

  function isLastSection(secId) {
    const idx = allSections.findIndex(s => s.id === secId);
    return idx === allSections.length - 1;
  }

  async function handleSectionNext(section) {
    // เก็บคำตอบของ section นี้ไว้ก่อน
    for (const q of (section.questions || [])) {
      const el = dynamicForm.querySelector(`[name="${q.id}"]`);
      if (!el) continue;
      answersBuffer[q.id] = el.value;
    }

    // ดูว่ามีคำถามแบบ select ที่มี goTo ไหม
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

    // ถ้าไม่มี goTo → ไปถัดไปตามลำดับ
    const idx = allSections.findIndex(s => s.id === section.id);
    if (idx >= 0 && idx < allSections.length - 1) {
      const nextId = allSections[idx + 1].id;
      currentSectionId = nextId;
      renderSection(nextId);
    } else {
      // ส่งฟอร์ม
      await submitAllSections();
    }
  }

  async function submitAllSections() {
    if (!currentStudent) {
      safeMsg(userFormMsg, "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    // เช็ก role limit (จากคำตอบทั้งหมด)
    let roleToUpdate = null;
    for (const key of Object.keys(answersBuffer)) {
      const val = (answersBuffer[key] || "").trim();
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

    await db.collection("registrations").add({
      studentId: currentStudent,
      answers: answersBuffer,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (roleToUpdate) {
      await roleToUpdate.ref.update({
        current: (roleToUpdate.current || 0) + 1,
      });
    }

    safeMsg(userFormMsg, "ส่งแบบฟอร์มเรียบร้อย ✅");
    answersBuffer = {};
    await loadUserFormAsSections();
  }

  // ===== 7. ADMIN MENU =====
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

  // ===== 8. ADMIN: sections =====
  async function loadAdminSections() {
    const box = document.getElementById("admin-sections-list");
    box.innerHTML = "กำลังโหลด...";

    const snap = await db.collection("form_sections").orderBy("order").get();
    if (snap.empty) {
      box.innerHTML = "<p>ยังไม่มี section</p>";
      return;
    }

    box.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `
        <div class="box">
          <strong>${d.id}</strong> - ${data.title || ""}
          <button class="small-btn" data-del="${d.id}">ลบ</button>
          <button class="small-btn" data-edit="${d.id}">แก้ไข</button>
        </div>
      `;
    }).join("");

    // ลบ
    box.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        if (!confirm("ลบ section นี้เลย?")) return;
        await db.collection("form_sections").doc(id).delete();
        await loadAdminSections();
      });
    });

    // แก้
    box.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.edit;
        const doc = await db.collection("form_sections").doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();
        document.getElementById("section-id").value = id;
        document.getElementById("section-title").value = d.title || "";
        document.getElementById("section-raw-questions").value = JSON.stringify(d.questions || [], null, 2);
      });
    });
  }

  document.getElementById("save-section-btn")?.addEventListener("click", async () => {
    const id = (document.getElementById("section-id").value || "").trim();
    const title = (document.getElementById("section-title").value || "").trim();
    const raw = (document.getElementById("section-raw-questions").value || "").trim();

    if (!id) {
      alert("กรุณาใส่ id section");
      return;
    }

    let questions = [];
    if (raw) {
      try {
        questions = JSON.parse(raw);
      } catch (e) {
        alert("JSON คำถามไม่ถูกต้อง");
        return;
      }
    }

    await db.collection("form_sections").doc(id).set({
      title,
      questions,
      order: Date.now()
    }, { merge: true });

    alert("บันทึก section แล้ว");
    await loadAdminSections();
  });

  // ===== 9. ADMIN: view users =====
  async function loadAdminUsers() {
    const listBox = document.getElementById("admin-users-list");
    listBox.innerHTML = "กำลังโหลด...";

    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    allRegistrationsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderAdminUsers(allRegistrationsCache);

    const userSearchInput = document.getElementById("user-search-input");
    const userSearchBtn = document.getElementById("user-search-btn");
    const userSearchClearBtn = document.getElementById("user-search-clear-btn");

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
    const listBox = document.getElementById("admin-users-list");
    if (!list || list.length === 0) {
      listBox.innerHTML = "<p>ไม่พบข้อมูล</p>";
      return;
    }

    listBox.innerHTML = list.map(item => {
      const ans = item.answers || {};
      const ansHtml = Object.keys(ans).map(k => {
        return `<div class="admin-user-answer"><strong>${k}:</strong> ${ans[k]}</div>`;
      }).join("");

      const timeStr = item.createdAt ? item.createdAt.toDate().toLocaleString("th-TH") : "";

      return `
        <div class="admin-user-card">
          <div class="admin-user-header">
            <span>รหัส: ${item.studentId || "-"}</span>
            <span class="admin-user-time">${timeStr}</span>
          </div>
          ${ansHtml}
        </div>
      `;
    }).join("");
  }

  // ===== 10. ADMIN: allowed_students =====
  async function loadAllowedStudents() {
    const box = document.getElementById("admin-ids-list");
    box.innerHTML = "กำลังโหลด...";

    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      box.innerHTML = "<p>ยังไม่มีรหัส</p>";
      return;
    }

    box.innerHTML = snap.docs.map(d => {
      return `
        <div class="box">
          ${d.id}
          <button class="small-btn" data-del="${d.id}">ลบ</button>
        </div>
      `;
    }).join("");

    box.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        await db.collection("allowed_students").doc(id).delete();
        await loadAllowedStudents();
      });
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

  // ===== 11. ADMIN: role_limits =====
  async function loadRoleLimits() {
    const box = document.getElementById("admin-role-list");
    box.innerHTML = "กำลังโหลด...";

    const snap = await db.collection("role_limits").get();
    if (snap.empty) {
      box.innerHTML = "<p>ยังไม่มี role จำกัด</p>";
      return;
    }

    box.innerHTML = snap.docs.map(d => {
      const x = d.data();
      return `
        <div class="box">
          <strong>${x.label}</strong>
          <div>ปัจจุบัน: ${x.current || 0} / ${x.max || 0}</div>
          <div class="inline">
            <input type="number" value="${x.current || 0}" data-cur="${d.id}" />
            <input type="number" value="${x.max || 0}" data-max="${d.id}" />
            <button class="update" data-id="${d.id}">อัปเดต</button>
            <button class="small-btn" data-del="${d.id}">ลบ</button>
          </div>
        </div>
      `;
    }).join("");

    box.querySelectorAll(".update").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const cur = parseInt(box.querySelector(`[data-cur="${id}"]`).value) || 0;
        const max = parseInt(box.querySelector(`[data-max="${id}"]`).value) || 0;
        await db.collection("role_limits").doc(id).update({
          current: cur,
          max: max
        });
        await loadRoleLimits();
      });
    });

    box.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.del;
        await db.collection("role_limits").doc(id).delete();
        await loadRoleLimits();
      });
    });
  }
});
