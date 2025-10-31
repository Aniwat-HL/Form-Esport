document.addEventListener("DOMContentLoaded", () => {
  // ===== Firebase =====
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
  console.log("🔥 Firebase ready with role limit");

  // ===== STATE =====
  const ADMIN_CODE = "0826940174";
  let currentStudentId = null;
  let registrationsCache = [];
  let roleLimitsCache = [];   // {label, current, max}

  // ===== DOM UTILS =====
  const screens = {};
  document.querySelectorAll(".screen").forEach(s => screens[s.id] = s);
  const show = (id) => {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[id]?.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ===== LOGIN =====
  const loginInput = document.getElementById("universal-id");
  const loginMsg = document.getElementById("login-msg");

  document.getElementById("login-btn").addEventListener("click", async () => {
    const code = (loginInput.value || "").trim();
    if (!code) {
      loginMsg.textContent = "กรุณากรอกรหัส";
      return;
    }

    // admin
    if (code === ADMIN_CODE) {
      await loadUsersForAdmin();
      await loadRoleLimitsForAdmin();
      show("admin-menu-screen");
      return;
    }

    // student: check allowed
    const allowDoc = await db.collection("allowed_students").doc(code).get();
    if (!allowDoc.exists) {
      loginMsg.textContent = "ยังไม่ได้รับอนุญาตให้ลงทะเบียน";
      return;
    }

    currentStudentId = code;

    // fill email auto
    document.getElementById("f-email").value = `s${code}@phuket.psu.ac.th`;

    // load role limits for dropdown
    await loadRoleLimitsForUser();

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

  // ===== LOAD ROLE LIMITS FOR USER =====
  async function loadRoleLimitsForUser() {
    const sel = document.getElementById("f-role");
    sel.innerHTML = "<option>กำลังโหลด...</option>";
    const snap = await db.collection("role_limits").get();
    roleLimitsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (roleLimitsCache.length === 0) {
      // ถ้า admin ยังไม่ตั้งเลย ก็ใส่ดีฟอลต์ให้
      sel.innerHTML = "";
      const defaults = [
        { label: "ผู้จัดงาน", current: 0, max: 20 },
        { label: "ผู้แข่งขัน", current: 0, max: 25 },
        { label: "สตาฟ", current: 0, max: 10 }
      ];
      for (const r of defaults) {
        await db.collection("role_limits").doc(r.label).set(r);
      }
      roleLimitsCache = defaults;
    }

    // render select
    sel.innerHTML = "";
    for (const r of roleLimitsCache) {
      const opt = document.createElement("option");
      opt.value = r.label;
      const cur = r.current || 0;
      const max = r.max || 0;
      opt.textContent = `${r.label} (${cur}/${max})`;
      if (max && cur >= max) {
        opt.disabled = true;
      }
      sel.appendChild(opt);
    }
  }

  // ===== SUBMIT FORM (with role limit check) =====
  document.getElementById("submit-form-btn").addEventListener("click", async () => {
    const name = document.getElementById("f-name").value.trim();
    const email = document.getElementById("f-email").value.trim();
    const role = document.getElementById("f-role").value;
    const note = document.getElementById("f-note").value.trim();
    const msgEl = document.getElementById("user-form-msg");

    msgEl.textContent = "";

    if (!currentStudentId) {
      msgEl.textContent = "กรุณาเข้าสู่ระบบก่อน";
      return;
    }
    if (!name) {
      msgEl.textContent = "กรุณากรอกชื่อ";
      return;
    }

    // selected games
    const games = [];
    document.querySelectorAll("#f-games input[type=checkbox]:checked").forEach(cb => {
      games.push(cb.value);
    });

    // เช็ก role limit แบบ realtime
    const roleRef = db.collection("role_limits").doc(role);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roleRef);
      if (!snap.exists) {
        // ถ้าไม่มี doc นี้เลย ให้สร้างพร้อมบันทึก
        tx.set(roleRef, { label: role, current: 1, max: 999 });
      } else {
        const data = snap.data();
        const cur = data.current || 0;
        const max = data.max || 0;
        if (max && cur >= max) {
          throw new Error(`บทบาท "${role}" เต็มแล้ว`);
        }
        tx.update(roleRef, { current: cur + 1 });
      }

      // ถ้าผ่าน → บันทึก registration
      tx.set(db.collection("registrations").doc(), {
        studentId: currentStudentId,
        name,
        email,
        role,
        games,
        note,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).then(() => {
      show("user-success-screen");
    }).catch((err) => {
      console.error(err);
      msgEl.textContent = err.message || "ส่งไม่สำเร็จ";
      // refresh dropdown ให้เห็นว่ามันเต็มแล้ว
      loadRoleLimitsForUser();
    });
  });

  // ===== ADMIN LOGOUT =====
  document.getElementById("admin-logout-btn").addEventListener("click", () => {
    loginInput.value = "";
    show("login-screen");
  });

  // ===== ADMIN VIEW USERS =====
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
      box.innerHTML = "<p class='muted'>ยังไม่มีผู้ลงทะเบียน</p>";
      return;
    }
    box.innerHTML = list.map(item => {
      const dt = item.createdAt ? item.createdAt.toDate().toLocaleString("th-TH") : "";
      const games = (item.games || []).join(", ");
      return `
        <div class="admin-card fade-in">
          <div class="title-line">
            <span>${item.studentId} - ${item.name || "-"}</span>
            <small>${dt}</small>
          </div>
          <div>บทบาท: ${item.role || "-"}</div>
          <div>อีเมล: ${item.email || "-"}</div>
          <div>เกม: ${games || "-"}</div>
          ${item.note ? `<div>หมายเหตุ: ${item.note}</div>` : ""}
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
    const filtered = registrationsCache.filter(r => (r.studentId || "").includes(q));
    renderAdminUsers(filtered);
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
      box.innerHTML = "<p class='muted'>ยังไม่มีรหัสที่อนุญาต</p>";
      return;
    }
    box.innerHTML = snap.docs.map(d => `
      <div class="admin-card">
        <div class="title-line">
          <span>${d.id}</span>
          <button class="btn ghost small" data-del="${d.id}">ลบ</button>
        </div>
      </div>
    `).join("");

    box.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.del;
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

  // add new role
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
