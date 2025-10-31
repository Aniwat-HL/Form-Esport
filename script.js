document.addEventListener("DOMContentLoaded", () => {
  // ====== 1. Firebase init ======
  const firebaseConfig = {
    apiKey: "AIzaSyBqnVyK9BeJqMKuyYCqXzGOd1-07eEltEI",
    authDomain: "form-esport.firebaseapp.com",
    projectId: "form-esport",
    storageBucket: "form-esport.firebasestorage.app",
    messagingSenderId: "846451064511",
    appId: "1:846451064511:web:67cdec6e10d527396a900a",
    measurementId: "G-GQZ8RK4JTC"
  };
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  console.log("Firebase connected!");

  // ====== 2. CONSTANTS & STATE ======
  const ADMIN_CODE = "0826940174";   // รหัสแอดมิน
  // คำถามไหนที่ต้อง "จำกัดจำนวน" ให้เปลี่ยนชื่อนี้ให้ตรงกับคำถามที่แอดมินจะตั้ง
  const LIMIT_QUESTION_LABEL = "ตำแหน่งที่อยากเป็น";

  let currentStudentId = null;
  let currentQuestions = [];
  let editingQuestionId = null;
  let currentOptionList = [];  // สำหรับ select / radio ตอนเพิ่มคำถาม

  // ====== 3. DOM ======
  const loginScreen = document.getElementById("login-screen");
  const userFormScreen = document.getElementById("user-form-screen");
  const adminMenuScreen = document.getElementById("admin-menu-screen");
  const adminFormEditorScreen = document.getElementById("admin-form-editor-screen");
  const adminUsersScreen = document.getElementById("admin-users-screen");
  const adminIdsScreen = document.getElementById("admin-ids-screen");

  const universalIdInput = document.getElementById("universal-id");
  const loginBtn = document.getElementById("login-btn");
  const loginMsg = document.getElementById("login-msg");

  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const userBackBtn = document.getElementById("user-back-btn");

  const adminEditFormBtn = document.getElementById("admin-edit-form-btn");
  const adminViewUsersBtn = document.getElementById("admin-view-users-btn");
  const adminManageIdsBtn = document.getElementById("admin-manage-ids-btn");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");

  const adminFormList = document.getElementById("admin-form-list");
  const formEditorTitle = document.getElementById("form-editor-title");
  const newQuestionLabel = document.getElementById("new-question-label");
  const newQuestionType = document.getElementById("new-question-type");
  const optionEditor = document.getElementById("option-editor");
  const optionListEl = document.getElementById("option-list");
  const newOptionText = document.getElementById("new-option-text");
  const addOptionBtn = document.getElementById("add-option-btn");
  const addQuestionBtn = document.getElementById("add-question-btn");
  const adminFormMsg = document.getElementById("admin-form-msg");
  const backToAdminMenu1 = document.getElementById("back-to-admin-menu-1");

  const adminUsersList = document.getElementById("admin-users-list");
  const adminUsersMsg = document.getElementById("admin-users-msg");
  const backToAdminMenu2 = document.getElementById("back-to-admin-menu-2");

  const adminIdsList = document.getElementById("admin-ids-list");
  const newStudentIdInput = document.getElementById("new-student-id");
  const addStudentIdBtn = document.getElementById("add-student-id-btn");
  const adminIdsMsg = document.getElementById("admin-ids-msg");
  const backToAdminMenu3 = document.getElementById("back-to-admin-menu-3");

  // ====== helper: show screen ======
  function showScreen(el) {
    [
      loginScreen,
      userFormScreen,
      adminMenuScreen,
      adminFormEditorScreen,
      adminUsersScreen,
      adminIdsScreen
    ].forEach(s => s.classList.remove("active"));
    el.classList.add("active");
  }

  // ====== 4. LOGIN ======
  async function handleLogin() {
    const code = (universalIdInput.value || "").trim();
    if (!code) {
      loginMsg.textContent = "กรุณากรอกรหัส";
      return;
    }
    loginMsg.textContent = "";

    // แอดมิน
    if (code === ADMIN_CODE) {
      showScreen(adminMenuScreen);
      return;
    }

    // ผู้ใช้ → check allowed_students
    try {
      const doc = await db.collection("allowed_students").doc(code).get();
      if (!doc.exists) {
        loginMsg.textContent = "รหัสนี้ยังไม่ได้รับอนุญาต";
        return;
      }
      currentStudentId = code;
      await loadFormForUser();
      showScreen(userFormScreen);
    } catch (err) {
      console.error(err);
      loginMsg.textContent = "เชื่อมต่อฐานข้อมูลไม่ได้";
    }
  }

  loginBtn.addEventListener("click", handleLogin);
  universalIdInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleLogin();
  });

  // ====== 5. USER FORM ======
  async function loadFormForUser() {
    dynamicForm.innerHTML = "กำลังโหลด...";
    try {
      const snap = await db.collection("form_questions").orderBy("order").get();
      currentQuestions = [];
      const frag = document.createDocumentFragment();
      snap.forEach(doc => {
        const d = doc.data();
        d.id = doc.id;
        currentQuestions.push(d);
        frag.appendChild(createUserField(d));
      });
      dynamicForm.innerHTML = "";
      dynamicForm.appendChild(frag);

      const submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.textContent = "ส่งแบบฟอร์ม";
      submitBtn.addEventListener("click", submitUserForm);
      dynamicForm.appendChild(submitBtn);
    } catch (err) {
      console.error(err);
      dynamicForm.innerHTML = "โหลดแบบฟอร์มไม่สำเร็จ";
    }
  }

  function createUserField(q) {
    const wrap = document.createElement("div");
    wrap.className = "dynamic-field";
    const label = document.createElement("label");
    label.textContent = q.label || "(ไม่มีชื่อคำถาม)";
    wrap.appendChild(label);

    switch (q.type) {
      case "textarea":
        const ta = document.createElement("textarea");
        ta.name = q.id;
        wrap.appendChild(ta);
        break;
      case "number":
        const num = document.createElement("input");
        num.type = "number";
        num.name = q.id;
        wrap.appendChild(num);
        break;
      case "date":
        const dt = document.createElement("input");
        dt.type = "date";
        dt.name = q.id;
        wrap.appendChild(dt);
        break;
      case "select":
        const sel = document.createElement("select");
        sel.name = q.id;
        (q.options || []).forEach(op => {
          const opt = document.createElement("option");
          opt.value = op;
          opt.textContent = op;
          sel.appendChild(opt);
        });
        wrap.appendChild(sel);
        break;
      case "radio":
        (q.options || []).forEach((op, i) => {
          const row = document.createElement("div");
          const r = document.createElement("input");
          r.type = "radio";
          r.name = q.id;
          r.value = op;
          r.id = q.id + "_" + i;
          const la = document.createElement("label");
          la.htmlFor = r.id;
          la.textContent = op;
          row.appendChild(r);
          row.appendChild(la);
          wrap.appendChild(row);
        });
        break;
      default:
        const inp = document.createElement("input");
        inp.type = "text";
        inp.name = q.id;
        wrap.appendChild(inp);
    }
    return wrap;
  }

  // ====== 5.1 submit + check limit ======
  async function submitUserForm() {
    if (!currentStudentId) {
      userFormMsg.textContent = "กรุณาเข้าสู่ระบบก่อน";
      return;
    }

    // เก็บคำตอบทั้งหมด
    const answers = {};
    currentQuestions.forEach((q) => {
      if (q.type === "radio") {
        const checked = dynamicForm.querySelector(`input[name="${q.id}"]:checked`);
        answers[q.id] = checked ? checked.value : "";
      } else {
        const el = dynamicForm.querySelector(`[name="${q.id}"]`);
        answers[q.id] = el ? el.value : "";
      }
    });

    // หาว่าคำถามไหนคือคำถามที่ต้องจำกัดจำนวน
    let pickedRole = null;
    currentQuestions.forEach((q) => {
      if (q.label === LIMIT_QUESTION_LABEL) {
        pickedRole = answers[q.id] || null;
      }
    });

    try {
      // ถ้ามีตัวเลือกที่ต้องจำกัด
      if (pickedRole) {
        const roleRef = db.collection("role_limits").doc(pickedRole);
        const roleSnap = await roleRef.get();

        if (roleSnap.exists) {
          const rd = roleSnap.data();
          const current = rd.current || 0;
          const max = rd.max || 0;

          if (current >= max) {
            userFormMsg.textContent = `ตำแหน่ง "${pickedRole}" เต็มแล้ว (${current}/${max}) กรุณาเลือกตำแหน่งอื่น`;
            return;
          }

          // ยังไม่เต็ม → บันทึกคำตอบก่อน
          const regRef = await db.collection("registrations").add({
            studentId: currentStudentId,
            answers,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });

          // อัปเดตจำนวนใน role_limits แบบ transaction
          await db.runTransaction(async (tx) => {
            const fresh = await tx.get(roleRef);
            if (!fresh.exists) return;
            const data = fresh.data();
            const cur = data.current || 0;
            const mx = data.max || 0;
            if (cur >= mx) {
              throw new Error("SLOT_FULL");
            }
            tx.update(roleRef, { current: cur + 1 });
          });

          userFormMsg.textContent = "ส่งแบบฟอร์มเรียบร้อย ✅";
          return;
        }
        // ถ้า role นี้ไม่มีใน role_limits → ถือว่าไม่ล็อก → ส่งปกติ
      }

      // ส่งปกติ (ไม่มี role จำกัด)
      await db.collection("registrations").add({
        studentId: currentStudentId,
        answers,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      userFormMsg.textContent = "ส่งแบบฟอร์มเรียบร้อย ✅";

    } catch (err) {
      console.error(err);
      if (err.message === "SLOT_FULL") {
        userFormMsg.textContent = `ขออภัย ตำแหน่ง "${pickedRole}" ถูกจองจนเต็มแล้ว ให้ลองเลือกตำแหน่งอื่น`;
      } else {
        userFormMsg.textContent = "ส่งแบบฟอร์มไม่สำเร็จ ❌";
      }
    }
  }

  userBackBtn.addEventListener("click", () => {
    currentStudentId = null;
    universalIdInput.value = "";
    userFormMsg.textContent = "";
    showScreen(loginScreen);
  });

  // ====== 6. ADMIN MENU ======
  adminLogoutBtn.addEventListener("click", () => {
    showScreen(loginScreen);
  });

  adminEditFormBtn.addEventListener("click", async () => {
    editingQuestionId = null;
    formEditorTitle.textContent = "เพิ่มคำถามใหม่";
    addQuestionBtn.textContent = "บันทึก";
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    optionEditor.style.display = "none";
    currentOptionList = [];
    renderOptionList();
    await loadAdminFormList();
    showScreen(adminFormEditorScreen);
  });

  adminViewUsersBtn.addEventListener("click", async () => {
    await loadAdminUsers();
    showScreen(adminUsersScreen);
  });

  adminManageIdsBtn.addEventListener("click", async () => {
    await loadAllowedStudents();
    showScreen(adminIdsScreen);
  });

  backToAdminMenu1.addEventListener("click", () => showScreen(adminMenuScreen));
  backToAdminMenu2.addEventListener("click", () => showScreen(adminMenuScreen));
  backToAdminMenu3.addEventListener("click", () => showScreen(adminMenuScreen));

  // ====== 7. ADMIN: FORM LIST ======
  async function loadAdminFormList() {
    adminFormList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("form_questions").orderBy("order").get();
    const arr = [];
    snap.forEach(doc => {
      const d = doc.data();
      const id = doc.id;
      arr.push(`
        <div class="box">
          <div><strong>${d.label || "(ไม่มีชื่อ)"}</strong> <small>(${d.type})</small></div>
          ${d.options && d.options.length ? `<div>ตัวเลือก: ${d.options.join(", ")}</div>` : ""}
          <div style="margin-top:6px;">
            <button class="small-btn-edit" data-id="${id}">แก้ไข</button>
            <button class="small-btn-del" data-id="${id}">ลบ</button>
          </div>
        </div>
      `);
    });
    adminFormList.innerHTML = arr.join("") || "<p>ยังไม่มีคำถาม</p>";

    // bind edit
    adminFormList.querySelectorAll(".small-btn-edit").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        const doc = await db.collection("form_questions").doc(id).get();
        if (!doc.exists) return;
        const d = doc.data();

        editingQuestionId = id;
        formEditorTitle.textContent = "แก้ไขคำถาม";
        addQuestionBtn.textContent = "บันทึกการแก้";

        newQuestionLabel.value = d.label || "";
        newQuestionType.value = d.type || "text";

        if (d.type === "select" || d.type === "radio") {
          optionEditor.style.display = "block";
          currentOptionList = Array.isArray(d.options) ? d.options.slice() : [];
          renderOptionList();
        } else {
          optionEditor.style.display = "none";
          currentOptionList = [];
          renderOptionList();
        }
      });
    });

    // bind delete
    adminFormList.querySelectorAll(".small-btn-del").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        if (!confirm("ลบคำถามนี้เลยไหม")) return;
        await db.collection("form_questions").doc(id).delete();
        await loadAdminFormList();
      });
    });
  }

  // ====== 7.1 OPTION EDITOR ======
  function renderOptionList() {
    optionListEl.innerHTML = "";
    currentOptionList.forEach((opt, index) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = opt;
      const delBtn = document.createElement("button");
      delBtn.textContent = "ลบ";
      delBtn.className = "small-btn";
      delBtn.addEventListener("click", () => {
        currentOptionList.splice(index, 1);
        renderOptionList();
      });
      li.appendChild(span);
      li.appendChild(delBtn);
      optionListEl.appendChild(li);
    });
  }

  newQuestionType.addEventListener("change", () => {
    const t = newQuestionType.value;
    if (t === "select" || t === "radio") {
      optionEditor.style.display = "block";
    } else {
      optionEditor.style.display = "none";
      currentOptionList = [];
      renderOptionList();
    }
  });

  addOptionBtn.addEventListener("click", () => {
    const val = (newOptionText.value || "").trim();
    if (!val) return;
    currentOptionList.push(val);
    newOptionText.value = "";
    renderOptionList();
  });

  addQuestionBtn.addEventListener("click", async () => {
    const label = (newQuestionLabel.value || "").trim();
    const type = newQuestionType.value;

    if (!label) {
      adminFormMsg.textContent = "กรุณาใส่ชื่อคำถาม";
      return;
    }

    const data = {
      label,
      type,
      options: (type === "select" || type === "radio") ? currentOptionList : []
    };

    if (editingQuestionId) {
      await db.collection("form_questions").doc(editingQuestionId).update(data);
      adminFormMsg.textContent = "อัปเดตคำถามสำเร็จ";
    } else {
      // หา order ต่อท้าย
      const last = await db.collection("form_questions").orderBy("order", "desc").limit(1).get();
      let nextOrder = 1;
      last.forEach(doc => {
        const d = doc.data();
        nextOrder = (d.order || 0) + 1;
      });
      data.order = nextOrder;
      await db.collection("form_questions").add(data);
      adminFormMsg.textContent = "เพิ่มคำถามสำเร็จ";
    }

    // reset
    editingQuestionId = null;
    formEditorTitle.textContent = "เพิ่มคำถามใหม่";
    addQuestionBtn.textContent = "บันทึก";
    newQuestionLabel.value = "";
    newQuestionType.value = "text";
    optionEditor.style.display = "none";
    currentOptionList = [];
    renderOptionList();

    await loadAdminFormList();
  });

  // ====== 8. ADMIN: USERS ======
  async function loadAdminUsers() {
    adminUsersList.innerHTML = "กำลังโหลด...";
    // โหลดคำถามไว้ map label
    const qSnap = await db.collection("form_questions").orderBy("order").get();
    const qMap = {};
    qSnap.forEach(doc => qMap[doc.id] = doc.data());

    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      adminUsersList.innerHTML = "<p>ยังไม่มีการส่งแบบฟอร์ม</p>";
      return;
    }
    const arr = [];
    snap.forEach(doc => {
      const d = doc.data();
      const ans = d.answers || {};
      const time = d.createdAt ? d.createdAt.toDate().toLocaleString("th-TH") : "";
      let ansHtml = "";
      Object.keys(ans).forEach(qid => {
        const q = qMap[qid];
        const label = q ? q.label : qid;
        ansHtml += `<div><strong>${label}:</strong> ${ans[qid]}</div>`;
      });
      arr.push(`
        <div class="box">
          <div><strong>รหัส นศ.:</strong> ${d.studentId || "-"}</div>
          <div style="font-size:12px; color:#666;">${time}</div>
          <div style="margin-top:4px;">${ansHtml}</div>
        </div>
      `);
    });
    adminUsersList.innerHTML = arr.join("");
  }

  // ====== 9. ADMIN: ALLOWED STUDENTS ======
  async function loadAllowedStudents() {
    adminIdsList.innerHTML = "กำลังโหลด...";
    const snap = await db.collection("allowed_students").get();
    if (snap.empty) {
      adminIdsList.innerHTML = "<p>ยังไม่มีรหัสที่อนุญาต</p>";
      return;
    }
    const arr = [];
    snap.forEach(doc => {
      const id = doc.id;
      arr.push(`
        <div class="box">
          ${id}
          <button class="small-btn" data-sid="${id}">ลบ</button>
        </div>
      `);
    });
    adminIdsList.innerHTML = arr.join("");

    // bind ลบ
    adminIdsList.querySelectorAll(".small-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const sid = e.target.getAttribute("data-sid");
        await db.collection("allowed_students").doc(sid).delete();
        await loadAllowedStudents();
      });
    });
  }

  addStudentIdBtn.addEventListener("click", async () => {
    const sid = (newStudentIdInput.value || "").trim();
    if (!sid) {
      adminIdsMsg.textContent = "กรุณาใส่รหัส";
      return;
    }
    await db.collection("allowed_students").doc(sid).set({
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    adminIdsMsg.textContent = "เพิ่มรหัสสำเร็จ";
    newStudentIdInput.value = "";
    await loadAllowedStudents();
  });

});
