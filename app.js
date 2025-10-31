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

// ====== 1. DOM ======
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
const newAllowedIdInput = document.getElementById("new-allowed-id");

const rolesList = document.getElementById("roles-list");
const addRoleBtn = document.getElementById("add-role-btn");
const newRoleLabel = document.getElementById("new-role-label");
const newRoleMax = document.getElementById("new-role-max");

const toastEl = document.getElementById("toast");

// admin tabs
const adminTabBtns = document.querySelectorAll(".admin-tab-btn");
const adminTabs = document.querySelectorAll(".admin-tab");

let currentStudentId = null;
let cachedQuestions = [];
let cachedRoleLimits = {};
let cachedRegistrations = [];
let cachedAllowedStudents = [];

// ====== utils ======
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
  toastEl.style.borderColor = isError ? "rgba(244,63,94,0.5)" : "rgba(148,163,184,0.2)";
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3000);
}

// ====== 2. LOGIN FLOW ======
loginBtn.addEventListener("click", async () => {
  const id = studentIdInput.value.trim();
  if (!id) {
    showToast("กรุณากรอกรหัสนักศึกษา", true);
    return;
  }

  // admin
  if (id === ADMIN_CODE) {
    currentStudentId = id;
    adminLoggedInAs.textContent = `Admin (${id})`;
    showScreen("admin");
    // load admin data
    loadAdminQuestions();
    loadRegistrations();
    loadAllowedStudents();
    loadRoleLimits();
    return;
  }

  // student
  try {
    const doc = await db.collection("allowed_students").doc(id).get();
    if (doc.exists) {
      currentStudentId = id;
      loggedInAs.textContent = `รหัสนักศึกษา: ${id}`;
      showScreen("user");
      await loadRoleLimits(); // load ก่อนเพื่อใช้ disable dropdown
      await loadUserForm();   // สร้างฟอร์ม
    } else {
      showToast("ยังไม่ได้รับอนุญาตให้เข้าใช้งาน", true);
    }
  } catch (err) {
    console.error(err);
    showToast("ไม่สามารถตรวจสอบสิทธิ์ได้ (chech Firestore rules)", true);
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

// ====== 3. LOAD USER FORM ======
async function loadUserForm() {
  userFormContainer.innerHTML = "กำลังโหลดฟอร์ม...";
  try {
    const snap = await db.collection("form_questions").orderBy("order", "asc").get();
    const questions = [];
    snap.forEach((d) => {
      questions.push({ id: d.id, ...d.data() });
    });
    cachedQuestions = questions;

    // render
    userFormContainer.innerHTML = "";
    questions.forEach((q) => {
      const wrap = document.createElement("div");
      wrap.className = "question-field";

      const labelLine = document.createElement("div");
      labelLine.className = "label-line";

      const label = document.createElement("label");
      label.textContent = q.label || "(ไม่มีชื่อคำถาม)";
      labelLine.appendChild(label);

      const badges = document.createElement("div");
      if (q.required) {
        const b = document.createElement("span");
        b.className = "required-badge";
        b.textContent = "ต้องกรอก";
        badges.appendChild(b);
      }
      if (q.autoEmail) {
        const b2 = document.createElement("span");
        b2.className = "readonly-tag";
        b2.textContent = "auto-email";
        badges.appendChild(b2);
      }
      labelLine.appendChild(badges);
      wrap.appendChild(labelLine);

      // input by type
      let fieldEl = null;
      const fieldId = `user-field-${q.id}`;
      if (q.type === "textarea") {
        fieldEl = document.createElement("textarea");
        fieldEl.id = fieldId;
        fieldEl.rows = 3;
      } else if (q.type === "select") {
        fieldEl = document.createElement("select");
        fieldEl.id = fieldId;

        const opts = q.options || [];
        opts.forEach((opt) => {
          const optEl = document.createElement("option");
          optEl.value = opt.value || opt.label;
          // ถ้ามี limit ต้องเทียบกับ cachedRoleLimits
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
        fieldEl.type = "text";
        fieldEl.id = fieldId;
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
    userFormContainer.innerHTML = "โหลดฟอร์มไม่สำเร็จ กรุณาตรวจสอบ rules Firestore";
  }
}

// ====== 4. SUBMIT USER FORM ======
submitUserFormBtn.addEventListener("click", async () => {
  if (!currentStudentId) return;

  // เก็บคำตอบ
  const answers = {};
  let hasError = false;

  cachedQuestions.forEach((q) => {
    const fieldEl = document.getElementById(`user-field-${q.id}`);
    if (!fieldEl) return;
    let val = fieldEl.value;
    if (q.required && !val) {
      hasError = true;
      fieldEl.style.outline = "2px solid rgba(244,63,94,0.5)";
    } else {
      fieldEl.style.outline = "none";
    }
    answers[q.label] = {
      value: val,
      type: q.type || "text",
      optionLabel: null,
    };

    // สำหรับ select ให้เก็บ option label ด้วย
    if (q.type === "select") {
      const selectedOpt = (q.options || []).find(
        (opt) => (opt.value || opt.label) === val
      );
      if (selectedOpt) {
        answers[q.label].optionLabel = selectedOpt.label;
      }
    }
  });

  if (hasError) {
    showToast("กรุณากรอกข้อมูลที่บังคับให้ครบ", true);
    return;
  }

  // ตรวจว่ามี dropdown ที่จำกัดจำนวนมั้ย → ใช้ transaction
  // เราจะเช็คเฉพาะคำตอบที่เป็น select + isLimited
  const limitedRolesToUpdate = [];
  cachedQuestions.forEach((q) => {
    if (q.type === "select") {
      const selectedValue = document.getElementById(`user-field-${q.id}`).value;
      const opt = (q.options || []).find(
        (o) => (o.value || o.label) === selectedValue
      );
      if (opt && opt.isLimited) {
        limitedRolesToUpdate.push(opt.label);
      }
    }
  });

  try {
    // 1) ถ้ามี role limit ให้ทำ transaction ก่อน
    for (const roleLabel of limitedRolesToUpdate) {
      const roleRef = db.collection("role_limits").doc(roleLabel);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(roleRef);
        if (!snap.exists) {
          throw new Error(`บทบาท ${roleLabel} ไม่มีในระบบ`);
        }
        const data = snap.data();
        if (data.current >= data.max) {
          throw new Error(`บทบาทนี้เต็มแล้ว`);
        }
        tx.update(roleRef, {
          current: data.current + 1,
        });
      });
    }

    // 2) บันทึก registrations
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
    // ถ้าโดน error จาก transaction ให้โหลดฟอร์มใหม่ เพื่อรีเฟรชตัวเลือก disable
    showToast(err.message || "ส่งแบบฟอร์มไม่สำเร็จ", true);
    await loadRoleLimits();
    await loadUserForm();
  }
});

// ====== 5. ADMIN: LOAD QUESTIONS ======
async function loadAdminQuestions() {
  questionsList.innerHTML = "กำลังโหลดคำถาม...";
  try {
    const snap = await db.collection("form_questions").orderBy("order", "asc").get();
    const qs = [];
    snap.forEach((d) => qs.push({ id: d.id, ...d.data() }));
    cachedQuestions = qs;
    renderAdminQuestions();
  } catch (err) {
    console.error(err);
    questionsList.innerHTML = "โหลดคำถามไม่สำเร็จ (เช็ค rules)";
  }
}

function renderAdminQuestions() {
  questionsList.innerHTML = "";
  cachedQuestions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";

    const main = document.createElement("div");
    main.style.flex = "1";

    // title + type
    const row1 = document.createElement("div");
    row1.className = "row-space";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = q.label || "";
    labelInput.addEventListener("change", () => updateQuestion(q.id, { label: labelInput.value }));
    row1.appendChild(labelInput);

    const controls = document.createElement("div");
    // move up
    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.className = "btn ghost";
    upBtn.style.padding = "3px 6px";
    upBtn.addEventListener("click", () => moveQuestion(idx, -1));
    controls.appendChild(upBtn);

    // move down
    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.className = "btn ghost";
    downBtn.style.padding = "3px 6px";
    downBtn.addEventListener("click", () => moveQuestion(idx, +1));
    controls.appendChild(downBtn);

    // delete
    const delBtn = document.createElement("button");
    delBtn.textContent = "ลบ";
    delBtn.className = "btn ghost";
    delBtn.style.padding = "3px 6px";
    delBtn.addEventListener("click", () => deleteQuestion(q.id));
    controls.appendChild(delBtn);

    row1.appendChild(controls);

    main.appendChild(row1);

    // type + required + autoEmail
    const row2 = document.createElement("div");
    row2.className = "flex-row gap";
    const typeSelect = document.createElement("select");
    ["text","textarea","select"].forEach((t) => {
      const op = document.createElement("option");
      op.value = t;
      op.textContent = t;
      if (q.type === t) op.selected = true;
      typeSelect.appendChild(op);
    });
    typeSelect.addEventListener("change", () => updateQuestion(q.id, { type: typeSelect.value }));

    const reqLbl = document.createElement("label");
    const reqChk = document.createElement("input");
    reqChk.type = "checkbox";
    reqChk.checked = !!q.required;
    reqChk.addEventListener("change", () => updateQuestion(q.id, { required: reqChk.checked }));
    reqLbl.appendChild(reqChk);
    reqLbl.appendChild(document.createTextNode(" ต้องกรอก"));

    const autoLbl = document.createElement("label");
    const autoChk = document.createElement("input");
    autoChk.type = "checkbox";
    autoChk.checked = !!q.autoEmail;
    autoChk.addEventListener("change", () => updateQuestion(q.id, { autoEmail: autoChk.checked }));
    autoLbl.appendChild(autoChk);
    autoLbl.appendChild(document.createTextNode(" autoEmail"));

    row2.appendChild(typeSelect);
    row2.appendChild(reqLbl);
    row2.appendChild(autoLbl);

    main.appendChild(row2);

    // if select → render options
    if (q.type === "select") {
      const optsBox = document.createElement("div");
      optsBox.className = "option-box";
      const title = document.createElement("p");
      title.textContent = "ตัวเลือก:";
      title.style.marginBottom = "8px";
      optsBox.appendChild(title);

      (q.options || []).forEach((opt, optIdx) => {
        const line = document.createElement("div");
        line.className = "option-line";

        const optInput = document.createElement("input");
        optInput.type = "text";
        optInput.value = opt.label;
        optInput.style.flex = "1";
        optInput.addEventListener("change", () => {
          const newOptions = [...(q.options || [])];
          newOptions[optIdx].label = optInput.value;
          updateQuestion(q.id, { options: newOptions });
        });
        line.appendChild(optInput);

        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.placeholder = "max";
        maxInput.value = opt.max || "";
        maxInput.style.width = "70px";
        maxInput.addEventListener("change", async () => {
          const newOptions = [...(q.options || [])];
          newOptions[optIdx].max = parseInt(maxInput.value) || null;
          newOptions[optIdx].isLimited = !!maxInput.value;
          await updateQuestion(q.id, { options: newOptions });

          // ถ้าติ๊กจำกัด → sync ไป role_limits
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
            // ถ้าไม่มี max ให้ใส่ 1 default
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

        const delOptBtn = document.createElement("button");
        delOptBtn.textContent = "x";
        delOptBtn.className = "btn ghost";
        delOptBtn.style.padding = "3px 6px";
        delOptBtn.addEventListener("click", async () => {
          const newOptions = (q.options || []).filter((_, i) => i !== optIdx);
          await updateQuestion(q.id, { options: newOptions });
          renderAdminQuestions();
        });
        line.appendChild(delOptBtn);

        optsBox.appendChild(line);
      });

      // add option
      const addOptBtn = document.createElement("button");
      addOptBtn.textContent = "+ เพิ่มตัวเลือก";
      addOptBtn.className = "btn ghost";
      addOptBtn.addEventListener("click", async () => {
        const newOptions = [...(q.options || []), { label: "ตัวเลือกใหม่", isLimited: false }];
        await updateQuestion(q.id, { options: newOptions });
        renderAdminQuestions();
      });
      optsBox.appendChild(addOptBtn);

      main.appendChild(optsBox);
    }

    card.appendChild(main);
    questionsList.appendChild(card);
  });
}

async function updateQuestion(id, data) {
  try {
    await db.collection("form_questions").doc(id).set(data, { merge: true });
    showToast("บันทึกแล้ว");
  } catch (err) {
    console.error(err);
    showToast("บันทึกไม่สำเร็จ (rules?)", true);
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
    showToast("เพิ่มคำถามไม่สำเร็จ", true);
  }
});

// ====== 6. ADMIN: REGISTRATIONS ======
async function loadRegistrations() {
  registrationsList.innerHTML = "กำลังโหลด...";
  try {
    const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    cachedRegistrations = rows;
    renderRegistrations(rows);
  } catch (err) {
    console.error(err);
    registrationsList.innerHTML = "โหลดไม่ได้ (rules?)";
  }
}

function renderRegistrations(data) {
  registrationsList.innerHTML = "";
  data.forEach((r) => {
    const card = document.createElement("div");
    card.className = "question-card";
    const main = document.createElement("div");
    main.style.flex = "1";

    const top = document.createElement("div");
    top.className = "row-space";
    const st = document.createElement("strong");
    st.textContent = r.studentId;
    top.appendChild(st);
    const dt = document.createElement("span");
    dt.textContent = r.createdAt;
    dt.style.color = "rgba(255,255,255,0.5)";
    dt.style.fontSize = "0.7rem";
    top.appendChild(dt);
    main.appendChild(top);

    const ans = r.answers || {};
    Object.keys(ans).forEach((k) => {
      const p = document.createElement("p");
      p.style.margin = "4px 0";
      p.innerHTML = `<strong>${k}:</strong> ${ans[k].value}`;
      main.appendChild(p);
    });

    card.appendChild(main);
    registrationsList.appendChild(card);
  });
}

searchStdId.addEventListener("input", () => {
  const q = searchStdId.value.trim();
  if (!q) {
    renderRegistrations(cachedRegistrations);
  } else {
    const filtered = cachedRegistrations.filter((r) => r.studentId.includes(q));
    renderRegistrations(filtered);
  }
});

// ====== 7. ADMIN: allowed_students ======
async function loadAllowedStudents() {
  allowedList.innerHTML = "กำลังโหลด...";
  try {
    const snap = await db.collection("allowed_students").get();
    const rows = [];
    snap.forEach((d) => rows.push(d.id));
    cachedAllowedStudents = rows;
    renderAllowedStudents();
  } catch (err) {
    console.error(err);
    allowedList.innerHTML = "โหลดไม่ได้ (rules?)";
  }
}

function renderAllowedStudents() {
  allowedList.innerHTML = "";
  cachedAllowedStudents.forEach((id) => {
    const line = document.createElement("div");
    line.className = "row-space";
    const txt = document.createElement("span");
    txt.textContent = id;
    line.appendChild(txt);
    const del = document.createElement("button");
    del.textContent = "ลบ";
    del.className = "btn ghost";
    del.style.padding = "3px 6px";
    del.addEventListener("click", async () => {
      await db.collection("allowed_students").doc(id).delete();
      loadAllowedStudents();
    });
    line.appendChild(del);
    allowedList.appendChild(line);
  });
}

addAllowedIdBtn.addEventListener("click", async () => {
  const id = newAllowedIdInput.value.trim();
  if (!id) return;
  try {
    await db.collection("allowed_students").doc(id).set({ createdAt: new Date().toISOString() });
    newAllowedIdInput.value = "";
    loadAllowedStudents();
  } catch (err) {
    console.error(err);
    showToast("เพิ่มไม่ได้", true);
  }
});

// ====== 8. ADMIN: role_limits ======
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
    // ไม่ต้องโชว์ toast ก็ได้
  }
}

function renderRoleLimits() {
  if (!rolesList) return;
  rolesList.innerHTML = "";
  Object.keys(cachedRoleLimits).forEach((key) => {
    const r = cachedRoleLimits[key];
    const line = document.createElement("div");
    line.className = "row-space";

    const left = document.createElement("div");
    left.innerHTML = `<strong>${r.label}</strong> (${r.current}/${r.max})`;
    line.appendChild(left);

    const right = document.createElement("div");

    const curInput = document.createElement("input");
    curInput.type = "number";
    curInput.value = r.current;
    curInput.style.width = "70px";
    curInput.addEventListener("change", async () => {
      await db.collection("role_limits").doc(key).set({
        ...r,
        current: parseInt(curInput.value) || 0,
      }, { merge: true });
      loadRoleLimits();
    });
    right.appendChild(curInput);

    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.value = r.max;
    maxInput.style.width = "70px";
    maxInput.addEventListener("change", async () => {
      await db.collection("role_limits").doc(key).set({
        ...r,
        max: parseInt(maxInput.value) || r.max,
      }, { merge: true });
      loadRoleLimits();
    });
    right.appendChild(maxInput);

    const delBtn = document.createElement("button");
    delBtn.textContent = "ลบ";
    delBtn.className = "btn ghost";
    delBtn.style.padding = "3px 6px";
    delBtn.addEventListener("click", async () => {
      await db.collection("role_limits").doc(key).delete();
      loadRoleLimits();
    });
    right.appendChild(delBtn);

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

// ====== 9. ADMIN TABS ======
adminTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = btn.getAttribute("data-tab");
    adminTabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    adminTabs.forEach((t) => {
      if (t.id === tabId) t.classList.add("active");
      else t.classList.remove("active");
    });

    // โหลดข้อมูลทุกครั้งที่เข้าแท็บ
    if (tabId === "admin-users-screen") loadRegistrations();
    if (tabId === "admin-ids-screen") loadAllowedStudents();
    if (tabId === "admin-roles-screen") loadRoleLimits();
    if (tabId === "admin-form-screen") loadAdminQuestions();
  });
});
