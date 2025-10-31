document.addEventListener('DOMContentLoaded', () => {
  // ========== 1. Firebase init ==========
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

  // ========== 2. DOM refs ==========
  const ADMIN_CODE = "0826940174";

  // user
  const userLoginScreen = document.getElementById("user-login-screen");
  const userFormScreen = document.getElementById("user-form-screen");
  const userLoginInput = document.getElementById("user-student-id");
  const userLoginBtn = document.getElementById("user-login-btn");
  const userLoginMsg = document.getElementById("user-login-msg");
  const dynamicForm = document.getElementById("dynamic-form");
  const userFormMsg = document.getElementById("user-form-msg");
  const userLogoutBtn = document.getElementById("user-logout-btn");

  // admin screens
  const adminLoginScreen = document.getElementById("admin-login-screen");
  const adminMenuScreen = document.getElementById("admin-menu-screen");
  const adminFormEditorScreen = document.getElementById("admin-form-editor-screen");
  const adminUsersScreen = document.getElementById("admin-users-screen");
  const adminIdsScreen = document.getElementById("admin-ids-screen");

  // admin controls
  const goAdminLoginBtn = document.getElementById("go-admin-login");
  const backToUserBtn = document.getElementById("back-to-user");

  const adminCodeInput = document.getElementById("admin-code");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminLoginMsg = document.getElementById("admin-login-msg");

  const adminEditFormBtn = document.getElementById("admin-edit-form-btn");
  const adminViewUsersBtn = document.getElementById("admin-view-users-btn");
  const adminManageIdsBtn = document.getElementById("admin-manage-ids-btn");
  const adminLogoutBtn = document.getElementById("admin-logout-btn");

  // admin form editor
  const adminFormList = document.getElementById("admin-form-list");
  const formEditorTitle = document.getElementById("form-editor-title");
  const newQuestionLabel = document.getElementById("new-question-label");
  const newQuestionType = document.getElementById("new-question-type");
  const newQuestionOptions = document.getElementById("new-question-options");
  const addQuestionBtn = document.getElementById("add-question-btn");
  const adminFormMsg = document.getElementById("admin-form-msg");

  // admin users
  const adminUsersList = document.getElementById("admin-users-list");
  const adminUsersMsg = document.getElementById("admin-users-msg");

  // admin ids
  const adminIdsList = document.getElementById("admin-ids-list");
  const newStudentIdInput = document.getElementById("new-student-id");
  const addStudentIdBtn = document.getElementById("add-student-id-btn");
  const adminIdsMsg = document.getElementById("admin-ids-msg");

  // back buttons
  const backToAdminMenu1 = document.getElementById("back-to-admin-menu-1");
  const backToAdminMenu2 = document.getElementById("back-to-admin-menu-2");
  const backToAdminMenu3 = document.getElementById("back-to-admin-menu-3");

  // state
  let currentStudentId = null;
  let currentQuestions = [];
  // สำหรับโหมดแก้ไขฟอร์ม
  let editingQuestionId = null;

  // helpers
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");

  // ==================================================
  // USER FLOW
  // ==================================================
  if (userLoginBtn) {
    userLoginBtn.addEventListener("click", async () => {
      const sid = (userLoginInput.value || "").trim();
      if (!sid) {
        userLoginMsg.textContent = "กรุณากรอกรหัสนักศึกษา";
        return;
      }

      if (sid === ADMIN_CODE) {
        userLoginMsg.textContent = "นี่คือรหัสแอดมิน ให้กดเข้าส่วนแอดมินแทน";
        return;
      }

      // เช็ครหัสจาก allowed_students
      try {
        const allowSnap = await db.collection("allowed_students").doc(sid).get();
        if (!allowSnap.exists) {
          userLoginMsg.textContent = "ยังไม่ได้อนุญาตให้ใช้รหัสนี้";
          return;
        }
      } catch (err) {
        console.error(err);
        userLoginMsg.textContent = "เช็กสิทธิ์ไม่สำเร็จ";
        return;
      }

      currentStudentId = sid;
      userLoginMsg.textContent = "";

      hide(userLoginScreen);
      show(userFormScreen);

      await loadFormForUser();
    });
  }

  if (userLogoutBtn) {
    userLogoutBtn.addEventListener("click", () => {
      currentStudentId = null;
      userLoginInput.value = "";
      hide(userFormScreen);
      show(userLoginScreen);
    });
  }

  // โหลดฟอร์มฝั่งผู้ใช้
  async function loadFormForUser() {
    if (!dynamicForm) return;
    dynamicForm.innerHTML = "กำลังโหลดแบบฟอร์ม...";

    try {
      const snap = await db.collection("form_questions").orderBy("order").get();
      currentQuestions = [];
      const frag = document.createDocumentFragment();

      snap.forEach((doc) => {
        const q = doc.data();
        q.id = doc.id;
        currentQuestions.push(q);

        const field = createFieldForUser(q);
        frag.appendChild(field);
      });

      dynamicForm.innerHTML = "";
      dynamicForm.appendChild(frag);

      // ปุ่ม submit
      let submitBtn = document.getElementById("user-submit-form");
      if (!submitBtn) {
        submitBtn = document.createElement("button");
        submitBtn.id = "user-submit-form";
        submitBtn.textContent = "ส่งแบบฟอร์ม";
        submitBtn.className = "primary";
        dynamicForm.appendChild(submitBtn);
      }
      submitBtn.onclick = submitUserForm;
    } catch (err) {
      console.error(err);
      dynamicForm.innerHTML = "โหลดแบบฟอร์มไม่สำเร็จ ❌";
    }
  }

  // สร้างฟิลด์ตามประเภท (ฝั่งผู้ใช้)
  function createFieldForUser(q) {
    const wrap = document.createElement("div");
    wrap.className = "dynamic-field";

    const label = document.createElement("label");
    label.textContent = q.label || "(ไม่มีชื่อคำถาม)";
    wrap.appendChild(label);

    // รองรับประเภทต่างๆ
    switch (q.type) {
      case "textarea": {
        const ta = document.createElement("textarea");
        ta.name = q.id;
        wrap.appendChild(ta);
        break;
      }
      case "number": {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.name = q.id;
        wrap.appendChild(inp);
        break;
      }
      case "date": {
        const inp = document.createElement("input");
        inp.type = "date";
        inp.name = q.id;
        wrap.appendChild(inp);
        break;
      }
      case "select": {
        const sel = document.createElement("select");
        sel.name = q.id;
        (q.options || []).forEach((op) => {
          const opt = document.createElement("option");
          opt.value = op;
          opt.textContent = op;
          sel.appendChild(opt);
        });
        wrap.appendChild(sel);
        break;
      }
      case "radio": {
        (q.options || []).forEach((op, i) => {
          const rWrap = document.createElement("div");
          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = q.id;
          radio.value = op;
          radio.id = q.id + "_" + i;

          const rLabel = document.createElement("label");
          rLabel.htmlFor = radio.id;
          rLabel.textContent = op;

          rWrap.appendChild(radio);
          rWrap.appendChild(rLabel);
          wrap.appendChild(rWrap);
        });
        break;
      }
      default: {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.name = q.id;
        wrap.appendChild(inp);
      }
    }

    return wrap;
  }

  // ส่งฟอร์ม
  async function submitUserForm(e) {
    e.preventDefault?.();

    if (!currentStudentId) {
      userFormMsg.textContent = "กรุณาเข้าสู่ระบบก่อน";
      return;
    }

    const answers = {};
    currentQuestions.forEach((q) => {
      // radio ต้องหาแบบพิเศษ
      if (q.type === "radio") {
        const checked = dynamicForm.querySelector(`input[name="${q.id}"]:checked`);
        answers[q.id] = checked ? checked.value : "";
      } else {
        const el = dynamicForm.querySelector(`[name="${q.id}"]`);
        answers[q.id] = el ? el.value : "";
      }
    });

    try {
      await db.collection("registrations").add({
        studentId: currentStudentId,
        answers,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      userFormMsg.textContent = "ส่งแบบฟอร์มเรียบร้อย ✅";
    } catch (err) {
      console.error(err);
      userFormMsg.textContent = "ส่งแบบฟอร์มไม่สำเร็จ ❌";
    }
  }

  // ==================================================
  // ADMIN FLOW
  // ==================================================

  // ไปหน้า login แอดมิน
  if (goAdminLoginBtn) {
    goAdminLoginBtn.addEventListener("click", () => {
      hide(userLoginScreen);
      show(adminLoginScreen);
    });
  }

  if (backToUserBtn) {
    backToUserBtn.addEventListener("click", () => {
      hide(adminLoginScreen);
      show(userLoginScreen);
    });
  }

  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", () => {
      const code = (adminCodeInput.value || "").trim();
      if (code === ADMIN_CODE) {
        adminLoginMsg.textContent = "";
        hide(adminLoginScreen);
        show(adminMenuScreen);
      } else {
        adminLoginMsg.textContent = "รหัสไม่ถูกต้อง";
      }
    });
  }

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
      adminCodeInput.value = "";
      hide(adminMenuScreen);
      hide(adminFormEditorScreen);
      hide(adminUsersScreen);
      hide(adminIdsScreen);
      show(userLoginScreen);
      // reset โหมดแก้ไข
      editingQuestionId = null;
      formEditorTitle.textContent = "เพิ่มคำถามใหม่";
      addQuestionBtn.textContent = "บันทึก";
      newQuestionLabel.value = "";
      newQuestionOptions.value = "";
      newQuestionType.value = "text";
    });
  }

  // ไปหน้าแก้ฟอร์ม
  if (adminEditFormBtn) {
    adminEditFormBtn.addEventListener("click", async () => {
      hide(adminMenuScreen);
      show(adminFormEditorScreen);
      editingQuestionId = null;
      formEditorTitle.textContent = "เพิ่มคำถามใหม่";
      addQuestionBtn.textContent = "บันทึก";
      newQuestionLabel.value = "";
      newQuestionOptions.value = "";
      newQuestionType.value = "text";
      await loadAdminFormList();
    });
  }

  // ไปหน้าดูผู้ใช้
  if (adminViewUsersBtn) {
    adminViewUsersBtn.addEventListener("click", async () => {
      hide(adminMenuScreen);
      show(adminUsersScreen);
      await loadAdminUsers();
    });
  }

  // ไปหน้าจัดการรหัส
  if (adminManageIdsBtn) {
    adminManageIdsBtn.addEventListener("click", async () => {
      hide(adminMenuScreen);
      show(adminIdsScreen);
      await loadAllowedStudents();
    });
  }

  // ย้อนจากหน้าแก้ฟอร์ม
  if (backToAdminMenu1) {
    backToAdminMenu1.addEventListener("click", () => {
      hide(adminFormEditorScreen);
      show(adminMenuScreen);
    });
  }

  if (backToAdminMenu2) {
    backToAdminMenu2.addEventListener("click", () => {
      hide(adminUsersScreen);
      show(adminMenuScreen);
    });
  }

  if (backToAdminMenu3) {
    backToAdminMenu3.addEventListener("click", () => {
      hide(adminIdsScreen);
      show(adminMenuScreen);
    });
  }

  // โหลดรายการฟอร์มให้แอดมิน
  async function loadAdminFormList() {
    if (!adminFormList) return;
    adminFormList.innerHTML = "กำลังโหลด...";
    try {
      const snap = await db.collection("form_questions").orderBy("order").get();
      const items = [];
      snap.forEach((doc) => {
        const d = doc.data();
        const qid = doc.id;
        items.push(`
          <div class="admin-item" data-id="${qid}">
            <div>
              <strong>${d.label || "(ไม่มีชื่อ)"} </strong>
              <span class="badge ${d.type}">${d.type}</span>
              ${
                d.options && d.options.length
                  ? `<div>ตัวเลือก: ${d.options.join(", ")}</div>`
                  : ""
              }
            </div>
            <div class="action-btns">
              <button class="btn-edit" data-id="${qid}">แก้ไข</button>
              <button class="btn-del" data-id="${qid}">ลบ</button>
            </div>
          </div>
        `);
      });
      adminFormList.innerHTML = items.join("") || "<p>ยังไม่มีคำถาม</p>";

      // ผูก event แก้/ลบ
      const editBtns = adminFormList.querySelectorAll(".btn-edit");
      editBtns.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.getAttribute("data-id");
          await loadQuestionToEditor(id);
        });
      });

      const delBtns = adminFormList.querySelectorAll(".btn-del");
      delBtns.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.getAttribute("data-id");
          if (confirm("ลบคำถามนี้เลยไหม")) {
            await db.collection("form_questions").doc(id).delete();
            await loadAdminFormList();
          }
        });
      });
    } catch (err) {
      console.error(err);
      adminFormList.innerHTML = "โหลดฟอร์มไม่สำเร็จ ❌";
    }
  }

  // โหลดคำถามเข้าช่องแก้ไข
  async function loadQuestionToEditor(qid) {
    const doc = await db.collection("form_questions").doc(qid).get();
    if (!doc.exists) return;
    const d = doc.data();

    editingQuestionId = qid;
    formEditorTitle.textContent = "แก้ไขคำถาม";
    addQuestionBtn.textContent = "บันทึกการแก้";

    newQuestionLabel.value = d.label || "";
    newQuestionType.value = d.type || "text";
    newQuestionOptions.value = (d.options || []).join(", ");
  }

  // เพิ่ม/บันทึกคำถาม
  if (addQuestionBtn) {
    addQuestionBtn.addEventListener("click", async () => {
      const label = (newQuestionLabel.value || "").trim();
      const type = newQuestionType.value;
      const optionsRaw = (newQuestionOptions.value || "").trim();

      if (!label) {
        adminFormMsg.textContent = "กรุณาใส่ชื่อคำถาม";
        return;
      }

      const data = {
        label,
        type,
      };

      if (type === "select" || type === "radio") {
        data.options = optionsRaw
          ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
      } else {
        data.options = [];
      }

      try {
        if (editingQuestionId) {
          // โหมดแก้
          await db.collection("form_questions").doc(editingQuestionId).update(data);
          adminFormMsg.textContent = "อัปเดตคำถามสำเร็จ ✅";
        } else {
          // โหมดเพิ่ม → ต้องหาลำดับก่อน
          const last = await db
            .collection("form_questions")
            .orderBy("order", "desc")
            .limit(1)
            .get();
          let nextOrder = 1;
          last.forEach((doc) => {
            const d = doc.data();
            nextOrder = (d.order || 0) + 1;
          });

          data.order = nextOrder;
          await db.collection("form_questions").add(data);
          adminFormMsg.textContent = "เพิ่มคำถามสำเร็จ ✅";
        }

        // reset editor
        editingQuestionId = null;
        formEditorTitle.textContent = "เพิ่มคำถามใหม่";
        addQuestionBtn.textContent = "บันทึก";
        newQuestionLabel.value = "";
        newQuestionOptions.value = "";
        newQuestionType.value = "text";

        await loadAdminFormList();
      } catch (err) {
        console.error(err);
        adminFormMsg.textContent = "บันทึกไม่สำเร็จ ❌";
      }
    });
  }

  // --------------------------------------------------
  // ADMIN: โหลดข้อมูลผู้สมัคร
  // --------------------------------------------------
  async function loadAdminUsers() {
    if (!adminUsersList) return;
    adminUsersList.innerHTML = "กำลังโหลด...";

    try {
      const qSnap = await db.collection("form_questions").orderBy("order").get();
      const qMap = {};
      qSnap.forEach((doc) => (qMap[doc.id] = doc.data()));

      const snap = await db
        .collection("registrations")
        .orderBy("createdAt", "desc")
        .get();
      if (snap.empty) {
        adminUsersList.innerHTML = "<p>ยังไม่มีคนส่งแบบฟอร์ม</p>";
        return;
      }

      const rows = [];
      snap.forEach((doc) => {
        const d = doc.data();
        const sid = d.studentId || "-";
        const time = d.createdAt
          ? d.createdAt.toDate().toLocaleString("th-TH")
          : "";
        const ans = d.answers || {};

        const ansHtml = Object.keys(ans)
          .map((qid) => {
            const q = qMap[qid];
            const label = q ? q.label : qid;
            return `<div><strong>${label}</strong>: ${ans[qid]}</div>`;
          })
          .join("");

        rows.push(`
          <div class="admin-item">
            <div>
              <div><strong>รหัส นศ.:</strong> ${sid}</div>
              <div style="font-size:12px;color:#777">${time}</div>
              <div>${ansHtml}</div>
            </div>
          </div>
        `);
      });

      adminUsersList.innerHTML = rows.join("");
    } catch (err) {
      console.error(err);
      adminUsersList.innerHTML = "โหลดข้อมูลผู้ใช้ไม่สำเร็จ ❌";
    }
  }

  // --------------------------------------------------
  // ADMIN: จัดการรหัส นศ.
  // --------------------------------------------------
  async function loadAllowedStudents() {
    if (!adminIdsList) return;
    adminIdsList.innerHTML = "กำลังโหลด...";

    try {
      const snap = await db.collection("allowed_students").get();
      if (snap.empty) {
        adminIdsList.innerHTML = "<p>ยังไม่มีรหัสที่อนุญาต</p>";
        return;
      }

      const rows = [];
      snap.forEach((doc) => {
        const sid = doc.id;
        rows.push(`
          <div class="admin-item">
            <div><strong>${sid}</strong></div>
            <button class="del-id-btn" data-sid="${sid}">ลบ</button>
          </div>
        `);
      });

      adminIdsList.innerHTML = rows.join("");

      const delBtns = adminIdsList.querySelectorAll(".del-id-btn");
      delBtns.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const sid = e.target.getAttribute("data-sid");
          await db.collection("allowed_students").doc(sid).delete();
          await loadAllowedStudents();
        });
      });
    } catch (err) {
      console.error(err);
      adminIdsList.innerHTML = "โหลดรายชื่อไม่ได้ ❌";
    }
  }

  if (addStudentIdBtn) {
    addStudentIdBtn.addEventListener("click", async () => {
      const sid = (newStudentIdInput.value || "").trim();
      if (!sid) {
        adminIdsMsg.textContent = "กรุณากรอกรหัส";
        return;
      }
      try {
        await db
          .collection("allowed_students")
          .doc(sid)
          .set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        adminIdsMsg.textContent = "เพิ่มรหัสสำเร็จ ✅";
        newStudentIdInput.value = "";
        await loadAllowedStudents();
      } catch (err) {
        console.error(err);
        adminIdsMsg.textContent = "เพิ่มรหัสไม่สำเร็จ ❌";
      }
    });
  }
});
