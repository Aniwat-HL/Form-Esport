// ====== 0. Firebase Init ======
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

// ====== 1. DOM refs ======
const ADMIN_CODE = "0826940174";

const loginScreen = document.getElementById("login-screen");
const userFormScreen = document.getElementById("user-form-screen");
const adminScreen = document.getElementById("admin-screen");

const loginBtn = document.getElementById("login-btn");
const studentIdInput = document.getElementById("student-id-input");

const loggedInAs = document.getElementById("logged-in-as");
const adminLoggedInAs = document.getElementById("admin-logged-in-as");

const logoutBtnUser = document.getElementById("logout-btn-user");
const logoutBtnAdmin = document.getElementById("logout-btn-admin");

const userFormContainer = document.getElementById("user-form-container");
const submitUserFormBtn = document.getElementById("submit-user-form");
const userSuccessBox = document.getElementById("user-success");

const questionsList = document.getElementById("questions-list");
const addQuestionBtn = document.getElementById("add-question-btn");
const newQLabel = document.getElementById("new-q-label");
const newQType = document.getElementById("new-q-type");
const newQRequired = document.getElementById("new-q-required");
const newQAutoEmail = document.getElementById("new-q-autoemail");

const registrationsList = document.getElementById("registrations-list");
const searchStdId = document.getElementById("search-stdid");

const allowedList = document.getElementById("allowed-list");
const addAllowedIdBtn = document.getElementById("add-allowed-id-btn");
const newAllowedId = document.getElementById("new-allowed-id");

const rolesList = document.getElementById("roles-list");
const addRoleBtn = document.getElementById("add-role-btn");
const newRoleLabel = document.getElementById("new-role-label");
const newRoleMax = document.getElementById("new-role-max");

const toastEl = document.getElementById("toast");

const adminTabBtns = document.querySelectorAll(".admin-tab-btn");
const adminTabs = document.querySelectorAll(".admin-tab");
const adminPageTitle = document.getElementById("admin-page-title");

let currentStudentId = null;
let cachedQuestions = [];
let cachedRegistrations = [];
let cachedAllowed = [];
let cachedRoleLimits = {};

// ====== 2. Utils ======
function showScreen(name) {
  loginScreen.classList.remove("active");
  userFormScreen.classList.remove("active");
  adminScreen.classList.remove("active");
  if (name === "login") loginScreen.classList.add("active");
  if (name === "user") userFormScreen.classList.add("active");
  if (name === "admin") adminScreen.classList.add("active");
}

function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.style.borderColor = isError ? "rgba(244,63,94,0.5)" : "rgba(148,163,184,0.25)";
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 2800);
}

// ====== 3. LOGIN FLOW ======
loginBtn.addEventListener("click", async () => {
  const id = studentIdInput.value.trim();
  if (!id) {
    showToast("กรุณากรอกรหัสก่อน", true);
    return;
  }

  // admin
  if (id === ADMIN_CODE) {
    currentStudentId = id;
    adminLoggedInAs.textContent = `Admin (${id})`;
    showScreen("admin");
    // load data for admin
    await loadAdminQuestions();
    await loadRegistrations();
    await loadAllowedStudents();
    await loadRoleLimits();
    return;
  }

  // student: check allowed_students
  try {
    const doc = await db.collection("allowed_students").doc(id).get();
    if (doc.exists) {
      currentStudentId = id;
      loggedInAs.textContent = `รหัสนักศึกษา: ${id}`;
      showScreen("user");
      await loadRoleLimits();
      await loadUserForm();
    } else {
      showToast("ยังไม่ได้รับอนุญาตให้เข้าใช้งาน", true);
    }
  } catch (err) {
    console.error(err);
    showToast("เชื่อมต่อ Firestore ไม่ได้ (เช็ค rules)", true);
  }
});

logoutBtnUser.addEventListener("click", () => {
  currentStudentId = null;
  studentIdInput.value = "";
  showScreen("login");
});

logoutBtnAdmin.addEventListener("click", () => {
  currentStudentId = null;
  studentIdInput.value = "";
  showScreen("login");
});

// ====== 4. LOAD USER FORM ======
async function loadUserForm() {
  userFormContainer.innerHTML = "กำลังโหลดฟอร์ม...";
  try {
    const snap = await db.collection("form_questions").orderBy("order", "asc").get();
    const questions = [];
    snap.forEach((d) => questions.push({ id: d.id, ...d.data() }));
    cachedQuestions = questions;

    userFormContainer.innerHTML = "";
    questions.forEach((q) => {
      const wrap = document.createElement("div");
      wrap.className = "question-field";

      const labelLine = document.createElement("div");
      labelLine.className = "label-line";

      const label = document.createElement("label");
      label.textContent = q.label || "(ไม่มีชื่อคำถาม)";
      labelLine.appendChild(label);

      const badgeWrap = document.createElement("div");
      if (q.required) {
        const b = document.createElement("span");
        b.className = "required-badge";
        b.textContent = "ต้องกรอก";
        badgeWrap.appendChild(b);
      }
      if (q.autoEmail) {
        const b2 = document.createElement("span");
        b2.className = "readonly-tag";
        b2.textContent = "autoEmail";
        badgeWrap.appendChild(b2);
      }
      labelLine.appendChild(badgeWrap);
      wrap.appendChild(labelLine);

      let fieldEl;
      const fieldId = `user-field-${q.id}`;

      if (q.type === "textarea") {
        fieldEl = document.createElement("textarea");
        fieldEl.id = fieldId;
        fieldEl.rows = 3;
      } else if (q.type === "select") {
        fieldEl = document.createElement("select");
        fieldEl.id = fieldId;

        (q.options || []).forEach((opt) => {
          const optEl = document.createElement("option");
          const val = opt.value || opt.label;
          optEl.value = val;

          if (opt.isLimited) {
            const rl = cachedRoleLimits[opt.label];
            if (rl && rl.current >= rl.max) {
              optEl.disabled = true;
              optEl.textContent = `${opt.label} (${rl.current}/${rl.max})`;
            } else if (rl) {
              optEl.textContent = `${opt.label} (${rl.current}/${rl.max})`;
            } else {
              optEl.textContent = opt.label;
            }
          } else {
            optEl.textContent = opt.label;
          }
          fieldEl.appendChild(optEl);
        });
      } else {
        fieldEl = document.createElement("input");
        fieldEl.id = fieldId;
        fieldEl.type = "text";
      }

      // autoEmail
      if (q.autoEmail) {
        if (currentStudentId) {
          fieldEl.value = `s${currentStudentId}@phuket.psu.ac.th`;
        }
        fieldEl.readOnly = true;
      }

      wrap.appendChild(fieldEl);
      userFormContainer.appendChild(wrap);
    });

  } catch (err) {
    console.error(err);
    userFormContainer.innerHTML = "โหลดฟอร์มไม่สำเร็จ (เช็ค rules)";
  }
}

// ====== 5. SUBMIT USER FORM ======
submitUserFormBtn.addEventListener("click", async () => {
  if (!currentStudentId) return;

  const answers = {};
  let hasError = false;

  cachedQuestions.forEach((q) => {
    const fieldEl = document.getElementById(`user-field-${q.id}`);
    if (!fieldEl) return;
    const val = fieldEl.value;
    if (q.required && !val) {
      hasError = true;
      fieldEl.style.outline = "2px solid rgba(244,63,94,0.4)";
    } else {
      fieldEl.style.outline = "none";
    }

    answers[q.label] = {
      value: val,
      type: q.type || "text",
      optionLabel: null,
    };

    if (q.type === "select") {
      const opt = (q.options || []).find(
        (o) => (o.value || o.label) === val
      );
      if (opt) {
        answers[q.label].optionLabel = opt.label;
      }
    }
  });

  if (hasError) {
    showToast("กรุณากรอกข้อมูลที่บังคับให้ครบ", true);
    return;
  }

  // หาว่ามี select ที่จำกัดจำนวนมั้ย
  const limitedRoles = [];
  cachedQuestions.forEach((q) => {
    if (q.type === "select") {
      const fieldEl = document.getElementById(`user-field-${q.id}`);
      const chosen = fieldEl.value;
      const opt = (q.options || []).find(
        (o) => (o.value || o.label) === chosen
      );
      if (opt && opt.isLimited) {
        limitedRoles.push(opt.label);
      }
    }
  });

  try {
    // อัปเดต role ที่จำกัดด้วย transaction
    for (const roleLabel of limitedRoles) {
      const roleRef = db.collection("role_limits").doc(roleLabel);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(roleRef);
        if (!snap.exists) {
          throw new Error(`บทบาท ${roleLabel} ไม่มีในระบบ`);
        }
        const data = snap.data();
        if (data.current >= data.max) {
          throw new Error("บทบาทนี้เต็มแล้ว");
        }
        tx.update(roleRef, { current: data.current + 1 });
      });
    }

    // แล้วค่อยบันทึกคำตอบ
    await db.collection("registrations").add({
      studentId: currentStudentId,
      createdAt: new Date().toISOString(),
      answers: answers,
    });

    userSuccessBox.classList.remove("hidden");
    showToast("ส่งแบบฟอร์มสำเร็จ");
    setTimeout(() => userSuccessBox.classList.add("hidden"), 3500);
  } catch (err) {
    console.error(err);
    showToast(err.message || "ส่งแบบฟอร์มไม่สำเร็จ", true);
    await loadRoleLimits();
    await loadUserForm();
  }
});

// ====== 6. ADMIN: FORM QUESTIONS ======
async function loadAdminQuestions() {
  questionsList.innerHTML = "กำลังโหลดคำถาม...";
  try {
    const snap = await db.collection("form_questions").orderBy("order", "asc").get();
    const arr = [];
    snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
    cachedQuestions = arr;
    renderAdminQuestions();
  } catch (err) {
    console.error(err);
    questionsList.innerHTML = "โหลดไม่สำเร็จ (rules?)";
  }
}

function renderAdminQuestions() {
  questionsList.innerHTML = "";
  cachedQuestions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";

    // actions
    const act = document.createElement("div");
    act.className = "question-actions";

    const up = document.createElement("button");
    up.className = "q-btn";
    up.textContent = "↑";
    up.addEventListener("click", () => moveQuestion(idx, -1));
    act.appendChild(up);

    const down = document.createElement("button");
    down.className = "q-btn";
    down.textContent = "↓";
    down.addEventListener("click", () => moveQuestion(idx, +1));
    act.appendChild(down);

    const del = document.createElement("button");
    del.className = "q-btn";
    del.textContent = "ลบ";
    del.addEventListener("click", () => deleteQuestion(q.id));
    act.appendChild(del);

    card.appendChild(act);

    // label
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = q.label || "";
    labelInput.addEventListener("change", () => updateQuestion(q.id, { label: labelInput.value }));
    card.appendChild(labelInput);

    // type + required + autoemail
    const line = document.createElement("div");
    line.className = "row-between mt";

    const typeSel = document.createElement("select");
    ["text","textarea","select"].forEach((t) => {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = t;
      if (q.type === t) op.selected = true;
      typeSel.appendChild(op);
    });
    typeSel.addEventListener("change", () => updateQuestion(q.id, { type: typeSel.value }));
    line.appendChild(typeSel);

    const right = document.createElement("div");
    right.className = "inline";

    const req = document.createElement("input");
    req.type = "checkbox";
    req.checked = !!q.required;
    req.addEventListener("change", () => updateQuestion(q.id, { required: req.checked }));

    const reqLbl = document.createElement("span");
    reqLbl.textContent = "ต้องกรอก";

    const auto = document.createElement("input");
    auto.type = "checkbox";
    auto.checked = !!q.autoEmail;
    auto.addEventListener("change", () => updateQuestion(q.id, { autoEmail: auto.checked }));

    const autoLbl = document.createElement("span");
    autoLbl.textContent = "autoEmail";

    right.appendChild(req);
    right.appendChild(reqLbl);
    right.appendChild(auto);
    right.appendChild(autoLbl);

    line.appendChild(right);
    card.appendChild(line);

    // options
    if (q.type === "select") {
      const optBox = document.createElement("div");
      optBox.className = "option-box";

      (q.options || []).forEach((opt, optIdx) => {
        const line = document.createElement("div");
        line.className = "option-line";

        const optLabelInput = document.createElement("input");
        optLabelInput.type = "text";
        optLabelInput.value = opt.label;
        optLabelInput.addEventListener("change", async () => {
          const newOptions = [...(q.options || [])];
          newOptions[optIdx].label = optLabelInput.value;
          await updateQuestion(q.id, { options: newOptions });
        });
        line.appendChild(optLabelInput);

        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.placeholder = "max";
        maxInput.value = opt.max || "";
        maxInput.addEventListener("change", async () => {
          const newOptions = [...(q.options || [])];
          newOptions[optIdx].max = parseInt(maxInput.value) || null;
          newOptions[optIdx].isLimited = !!maxInput.value;
          await updateQuestion(q.id, { options: newOptions });

          if (maxInput.value) {
            await db.collection("role_limits").doc(opt.label).set({
              label: opt.label,
              current: 0,
              max: parseInt(maxInput.value),
            }, { merge: true });
            loadRoleLimits();
          }
        });
        line.appendChild(maxInput);

        const limitChk = document.createElement("input");
        limitChk.type = "checkbox";
        limitChk.checked = !!opt.isLimited;
        limitChk.addEventListener("change", async () => {
          const newOptions = [...(q.options || [])];
          newOptions[optIdx].isLimited = limitChk.checked;
          await updateQuestion(q.id, { options: newOptions });
          if (limitChk.checked) {
            const defMax = newOptions[optIdx].max || 1;
            await db.collection("role_limits").doc(opt.label).set({
              label: opt.label,
              current: 0,
              max: defMax,
            }, { merge: true });
            loadRoleLimits();
          }
        });
        line.appendChild(limitChk);

        const delOpt = document.createElement("button");
        delOpt.textContent = "x";
        delOpt.className = "q-btn";
        delOpt.addEventListener("click", async () => {
          const newOptions = (q.options || []).filter((_, i) => i !== optIdx);
          await updateQuestion(q.id, { options: newOptions });
          loadAdminQuestions();
        });
        line.appendChild(delOpt);

        optBox.appendChild(line);
      });

      const addOpt = document.createElement("button");
      addOpt.textContent = "+ เพิ่มตัวเลือก";
      addOpt.className = "btn ghost sm";
      addOpt.addEventListener("click", async () => {
        const newOptions = [...(q.options || []), { label: "ตัวเลือกใหม่", isLimited: false }];
        await updateQuestion(q.id, { options: newOptions });
        loadAdminQuestions();
      });
      optBox.appendChild(addOpt);

      card.appendChild(optBox);
    }

    questionsList.appendChild(card);
  });
}

async function updateQuestion(id, data) {
  try {
    await db.collection("form_questions").doc(id).set(data, { merge: true });
    showToast("บันทึกแล้ว");
  } catch (err) {
    console.error(err);
    showToast("บันทึกไม่สำเร็จ", true);
  }
}

async function moveQuestion(index, delta) {
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= cachedQuestions.length) return;

  const q1 = cachedQuestions[index];
  const q2 = cachedQuestions[newIndex];

  try {
    await db.collection("form_questions").doc(q1.id).update({ order: newIndex });
    await db.collection("form_questions").doc(q2.id).update({ order: index });
    await loadAdminQuestions();
  } catch (err) {
    console.error(err);
    showToast("เลื่อนลำดับไม่ได้", true);
  }
}

async function deleteQuestion(id) {
  if (!confirm("ลบคำถามนี้?")) return;
  try {
    await db.collection("form_questions").doc(id).delete();
    loadAdminQuestions();
  } catch (err) {
    console.error(err);
    showToast("ลบไม่สำเร็จ", true);
  }
}

addQuestionBtn.addEventListener("click", async () => {
  const label = newQLabel.value.trim();
  const type = newQType.value;
  const required = newQRequired.checked;
  const autoEmail = newQAutoEmail.checked;

  if (!label) {
    showToast("กรุณากรอกชื่อคำถาม", true);
    return;
  }

  try {
    const order = cachedQuestions.length;
    await db.collection("form_questions").add({
      label,
      type,
      required,
      autoEmail,
      order,
      options: type === "select" ? [] : null,
    });
    newQLabel.value = "";
    newQRequired.checked = false;
    newQAutoEmail.checked = false;
    await loadAdminQuestions();
  } catch (err) {
    console.error(err);
    showToast("เพิ่มคำถามไม่ได้", true);
  }
});

// ====== 7. ADMIN: REGISTRATIONS ======
async function loadRegistrations() {
  registrationsList.innerHTML = "กำลังโหลด...";
  try {
    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    const arr = [];
    snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
    cachedRegistrations = arr;
    renderRegistrations(arr);
  } catch (err) {
    console.error(err);
    registrationsList.innerHTML = "โหลดไม่ได้ (rules?)";
  }
}

function renderRegistrations(data) {
  registrationsList.innerHTML = "";
  data.forEach((r) => {
    const card = document.createElement("div");
    card.className = "card";

    const top = document.createElement("div");
    top.className = "row-between";
    const std = document.createElement("strong");
    std.textContent = r.studentId;
    top.appendChild(std);
    const dt = document.createElement("span");
    dt.className = "text-muted";
    dt.style.fontSize = ".68rem";
    dt.textContent = r.createdAt;
    top.appendChild(dt);
    card.appendChild(top);

    const ans = r.answers || {};
    Object.keys(ans).forEach((k) => {
      const p = document.createElement("p");
      p.style.margin = "4px 0";
      p.innerHTML = `<strong>${k}:</strong> ${ans[k].value}`;
      card.appendChild(p);
    });

    registrationsList.appendChild(card);
  });
}

searchStdId && searchStdId.addEventListener("input", () => {
  const q = searchStdId.value.trim();
  if (!q) {
    renderRegistrations(cachedRegistrations);
  } else {
    const filtered = cachedRegistrations.filter((r) => r.studentId.includes(q));
    renderRegistrations(filtered);
  }
});

// ====== 8. ADMIN: allowed_students ======
async function loadAllowedStudents() {
  allowedList.innerHTML = "กำลังโหลด...";
  try {
    const snap = await db.collection("allowed_students").get();
    const rows = [];
    snap.forEach((d) => rows.push(d.id));
    cachedAllowed = rows;
    renderAllowedStudents();
  } catch (err) {
    console.error(err);
    allowedList.innerHTML = "โหลดไม่ได้";
  }
}

function renderAllowedStudents() {
  allowedList.innerHTML = "";
  cachedAllowed.forEach((id) => {
    const line = document.createElement("div");
    line.className = "row-between";

    const span = document.createElement("span");
    span.textContent = id;
    line.appendChild(span);

    const del = document.createElement("button");
    del.className = "btn ghost sm";
    del.textContent = "ลบ";
    del.addEventListener("click", async () => {
      await db.collection("allowed_students").doc(id).delete();
      loadAllowedStudents();
    });
    line.appendChild(del);

    allowedList.appendChild(line);
  });
}

addAllowedIdBtn.addEventListener("click", async () => {
  const id = newAllowedId.value.trim();
  if (!id) return;
  try {
    await db.collection("allowed_students").doc(id).set({
      createdAt: new Date().toISOString(),
    });
    newAllowedId.value = "";
    loadAllowedStudents();
  } catch (err) {
    console.error(err);
    showToast("เพิ่มไม่ได้", true);
  }
});

// ====== 9. ADMIN: role_limits ======
async function loadRoleLimits() {
  try {
    const snap = await db.collection("role_limits").get();
    const obj = {};
    snap.forEach((d) => {
      obj[d.id] = d.data();
    });
    cachedRoleLimits = obj;
    renderRoleLimits();
  } catch (err) {
    console.error(err);
  }
}

function renderRoleLimits() {
  if (!rolesList) return;
  rolesList.innerHTML = "";
  Object.keys(cachedRoleLimits).forEach((key) => {
    const r = cachedRoleLimits[key];
    const line = document.createElement("div");
    line.className = "row-between";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${r.label}</strong> (${r.current}/${r.max})`;
    line.appendChild(left);

    const right = document.createElement("div");
    right.className = "row";

    const cur = document.createElement("input");
    cur.type = "number";
    cur.value = r.current;
    cur.style.width = "65px";
    cur.addEventListener("change", async () => {
      await db.collection("role_limits").doc(key).set({
        ...r,
        current: parseInt(cur.value) || 0,
      }, { merge: true });
      loadRoleLimits();
    });
    right.appendChild(cur);

    const max = document.createElement("input");
    max.type = "number";
    max.value = r.max;
    max.style.width = "65px";
    max.addEventListener("change", async () => {
      await db.collection("role_limits").doc(key).set({
        ...r,
        max: parseInt(max.value) || r.max,
      }, { merge: true });
      loadRoleLimits();
    });
    right.appendChild(max);

    const del = document.createElement("button");
    del.className = "btn ghost sm";
    del.textContent = "ลบ";
    del.addEventListener("click", async () => {
      await db.collection("role_limits").doc(key).delete();
      loadRoleLimits();
    });
    right.appendChild(del);

    line.appendChild(right);
    rolesList.appendChild(line);
  });
}

addRoleBtn.addEventListener("click", async () => {
  const label = newRoleLabel.value.trim();
  const max = parseInt(newRoleMax.value);
  if (!label || !max) return;
  try {
    await db.collection("role_limits").doc(label).set({
      label,
      current: 0,
      max: max,
    });
    newRoleLabel.value = "";
    newRoleMax.value = "";
    loadRoleLimits();
  } catch (err) {
    console.error(err);
    showToast("เพิ่ม role ไม่ได้", true);
  }
});

// ====== 10. ADMIN TABS (fix กดไม่ได้) ======
function showAdminTab(tabId) {
  adminTabs.forEach((t) => {
    if (t.id === tabId) t.classList.add("active");
    else t.classList.remove("active");
  });
  adminTabBtns.forEach((b) => {
    if (b.getAttribute("data-tab") === tabId) b.classList.add("active");
    else b.classList.remove("active");
  });

  if (tabId === "admin-form-screen") {
    loadAdminQuestions();
    adminPageTitle.textContent = "จัดการแบบฟอร์ม";
  }
  if (tabId === "admin-users-screen") {
    loadRegistrations();
    adminPageTitle.textContent = "ผู้สมัคร";
  }
  if (tabId === "admin-ids-screen") {
    loadAllowedStudents();
    adminPageTitle.textContent = "อนุญาตเข้า";
  }
  if (tabId === "admin-roles-screen") {
    loadRoleLimits();
    adminPageTitle.textContent = "Role Limits";
  }
}

adminTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-tab");
    showAdminTab(tabId);
  });
});

// เปิดหน้าแรก
showAdminTab("admin-form-screen");
