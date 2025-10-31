// ========== Firebase Init ==========
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

const ADMIN_CODE = "0826940174";

// เก็บตัวเลือก dropdown ชั่วคราว (ตอนเพิ่ม / แก้ไข)
let currentOptionList = [];

// ======================================================
// 1) LOGIN PAGE
// ======================================================
const loginBtn = document.getElementById("login-btn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return alert("กรุณากรอกรหัส");

    // admin
    if (id === ADMIN_CODE) {
      localStorage.setItem("role", "admin");
      localStorage.setItem("studentId", id);
      window.location.href = "admin.html";
      return;
    }

    // student
    const doc = await db.collection("allowed_students").doc(id).get();
    if (!doc.exists) {
      alert("ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ");
      return;
    }

    localStorage.setItem("role", "student");
    localStorage.setItem("studentId", id);
    window.location.href = "user.html";
  });
}


// ======================================================
// 2) USER PAGE
// ======================================================
const logoutUserBtn = document.getElementById("logout-btn-user");
if (logoutUserBtn) {
  // set id
  document.getElementById("logged-in-as").textContent = localStorage.getItem("studentId") || "-";

  logoutUserBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  // render form
  renderUserForm();

  // submit
  document.getElementById("submit-user-form").addEventListener("click", submitUserForm);
}

async function renderUserForm() {
  const wrap = document.getElementById("user-form-container");
  if (!wrap) return;
  const snap = await db.collection("form_questions").orderBy("order", "asc").get();
  wrap.innerHTML = "";
  snap.forEach(d => {
    const q = d.data();
    let inputHtml = "";

    if (q.type === "textarea") {
      inputHtml = `<textarea data-id="${d.id}"></textarea>`;
    } else if (q.type === "select") {
      const opts = Array.isArray(q.options) ? q.options : [];
      inputHtml = `<select data-id="${d.id}">
        ${opts.map(o => `<option value="${o}">${o}</option>`).join("")}
      </select>`;
    } else {
      inputHtml = `<input type="text" data-id="${d.id}" />`;
    }

    wrap.innerHTML += `
      <div class="question-field">
        <label>${q.label}${q.required ? " *" : ""}${q.limit ? ` (รับ ${q.limit} คน)` : ""}</label>
        ${inputHtml}
      </div>
    `;
  });
}

async function submitUserForm() {
  const uid = localStorage.getItem("studentId");
  if (!uid) return;

  // ดึงคำถามมาเช็ก limit แบบง่ายสุด (global)
  const qSnap = await db.collection("form_questions").get();
  const questions = {};
  qSnap.forEach(d => questions[d.id] = d.data());

  const regSnap = await db.collection("registrations").get();
  const totalReg = regSnap.size;

  let maxLimit = 0;
  Object.values(questions).forEach(q => {
    if (q.limit && q.limit > maxLimit) maxLimit = q.limit;
  });

  if (maxLimit && totalReg >= maxLimit) {
    alert("จำนวนผู้ตอบครบตามที่กำหนดแล้ว");
    return;
  }

  const answers = {};
  document.querySelectorAll("[data-id]").forEach(el => {
    answers[el.dataset.id] = el.value;
  });

  await db.collection("registrations").doc(uid).set({
    userId: uid,
    answers,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("user-success").classList.remove("hidden");
}


// ======================================================
// 3) ADMIN PAGE
// ======================================================
const logoutAdminBtn = document.getElementById("logout-btn-admin");
if (logoutAdminBtn) {
  document.getElementById("admin-logged-in-as").textContent = localStorage.getItem("studentId") || "";

  logoutAdminBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  // tab ซ้าย
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.tab;
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(target).classList.add("active");
    });
  });

  // ช่องเพิ่มตัวเลือก dropdown
  const typeSelect = document.getElementById("new-q-type");
  const optWrap = document.getElementById("new-q-options-wrap");
  const optInput = document.getElementById("new-q-option-input");
  const optAddBtn = document.getElementById("new-q-option-add");
  const optListEl = document.getElementById("new-q-options-list");

  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      if (typeSelect.value === "select") {
        optWrap.style.display = "block";
      } else {
        optWrap.style.display = "none";
        currentOptionList = [];
        renderOptionList(optListEl);
      }
    });
  }

  if (optAddBtn) {
    optAddBtn.addEventListener("click", () => {
      const val = optInput.value.trim();
      if (!val) return;
      currentOptionList.push(val);
      optInput.value = "";
      renderOptionList(optListEl);
    });
  }

  // โหลดข้อมูลเริ่มต้น
  loadQuestions();
  loadRegistrations();
  loadAllowed();
  loadRoles();

  // ปุ่มหลัก
  document.getElementById("add-question-btn").addEventListener("click", addQuestion);
  document.getElementById("add-allowed-id-btn").addEventListener("click", addAllowed);
  document.getElementById("add-role-btn").addEventListener("click", addRole);
}

// แสดงรายการตัวเลือก dropdown ใน admin
function renderOptionList(container) {
  if (!container) return;
  container.innerHTML = "";
  currentOptionList.forEach((opt, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `${opt} <button onclick="removeTempOption(${idx})">×</button>`;
    container.appendChild(li);
  });
}
window.removeTempOption = function(idx) {
  currentOptionList.splice(idx, 1);
  renderOptionList(document.getElementById("new-q-options-list"));
};


// ----- ADMIN: Questions -----
async function loadQuestions() {
  const box = document.getElementById("questions-list");
  if (!box) return;
  const snap = await db.collection("form_questions").orderBy("order", "asc").get();
  box.innerHTML = "";
  snap.forEach(d => {
    const q = d.data();
    const div = document.createElement("div");
    div.className = "list-item question-item";
    div.innerHTML = `
      <div>
        <strong>${q.label}</strong>
        <div class="muted small">${q.type}${q.limit ? ` • จำกัด ${q.limit} คน` : ""}</div>
      </div>
      <div class="flex">
        <button class="btn ghost sm" onclick="editQuestion('${d.id}')">แก้ไข</button>
        <button class="btn ghost sm" onclick="deleteQuestion('${d.id}')">ลบ</button>
      </div>
    `;
    box.appendChild(div);
  });
}

async function addQuestion() {
  const label = document.getElementById("new-q-label").value.trim();
  const type = document.getElementById("new-q-type").value;
  const required = document.getElementById("new-q-required").checked;
  const autoEmail = document.getElementById("new-q-autoemail").checked;
  const limitRaw = document.getElementById("new-q-limit").value.trim();
  const limit = limitRaw ? parseInt(limitRaw, 10) : null;

  if (!label) return alert("กรอกชื่อคำถามก่อน");

  // หา order
  const last = await db.collection("form_questions").orderBy("order", "desc").limit(1).get();
  let nextOrder = 1;
  last.forEach(d => {
    nextOrder = (d.data().order || 0) + 1;
  });

  await db.collection("form_questions").add({
    label,
    type,
    required,
    autoEmail,
    options: type === "select" ? currentOptionList : [],
    limit,
    order: nextOrder
  });

  // reset
  document.getElementById("new-q-label").value = "";
  document.getElementById("new-q-required").checked = false;
  document.getElementById("new-q-autoemail").checked = false;
  document.getElementById("new-q-limit").value = "";
  currentOptionList = [];
  renderOptionList(document.getElementById("new-q-options-list"));
  document.getElementById("new-q-options-wrap").style.display = "none";
  document.getElementById("new-q-type").value = "text";

  loadQuestions();
}

window.editQuestion = async function(id) {
  const doc = await db.collection("form_questions").doc(id).get();
  if (!doc.exists) return;
  const q = doc.data();

  // เอาขึ้นฟอร์ม
  document.getElementById("new-q-label").value = q.label || "";
  document.getElementById("new-q-type").value = q.type || "text";
  document.getElementById("new-q-required").checked = !!q.required;
  document.getElementById("new-q-autoemail").checked = !!q.autoEmail;
  document.getElementById("new-q-limit").value = q.limit || "";

  if (q.type === "select") {
    document.getElementById("new-q-options-wrap").style.display = "block";
    currentOptionList = Array.isArray(q.options) ? q.options : [];
    renderOptionList(document.getElementById("new-q-options-list"));
  } else {
    document.getElementById("new-q-options-wrap").style.display = "none";
    currentOptionList = [];
    renderOptionList(document.getElementById("new-q-options-list"));
  }

  // เปลี่ยนปุ่มเป็น บันทึกการแก้ไข
  const addBtn = document.getElementById("add-question-btn");
  addBtn.textContent = "บันทึกการแก้ไข";
  addBtn.onclick = async () => {
    const newLabel = document.getElementById("new-q-label").value.trim();
    const newType = document.getElementById("new-q-type").value;
    const newReq = document.getElementById("new-q-required").checked;
    const newAuto = document.getElementById("new-q-autoemail").checked;
    const newLimitRaw = document.getElementById("new-q-limit").value.trim();
    const newLimit = newLimitRaw ? parseInt(newLimitRaw, 10) : null;

    await db.collection("form_questions").doc(id).update({
      label: newLabel,
      type: newType,
      required: newReq,
      autoEmail: newAuto,
      options: newType === "select" ? currentOptionList : [],
      limit: newLimit
    });

    // reset ปุ่ม
    addBtn.textContent = "เพิ่มคำถาม";
    addBtn.onclick = addQuestion;

    // reset form
    document.getElementById("new-q-label").value = "";
    document.getElementById("new-q-limit").value = "";
    currentOptionList = [];
    renderOptionList(document.getElementById("new-q-options-list"));
    document.getElementById("new-q-options-wrap").style.display = "none";

    loadQuestions();
  };
};

window.deleteQuestion = async function(id) {
  await db.collection("form_questions").doc(id).delete();
  loadQuestions();
};


// ----- ADMIN: Registrations -----
async function loadRegistrations() {
  const box = document.getElementById("registrations-list");
  if (!box) return;
  const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
  box.innerHTML = "";
  snap.forEach(d => {
    const r = d.data();
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <p><strong>${r.userId || "-"}</strong></p>
      <pre class="json-block">${JSON.stringify(r.answers, null, 2)}</pre>
    `;
    box.appendChild(card);
  });
}


// ----- ADMIN: Allowed IDs -----
async function loadAllowed() {
  const box = document.getElementById("allowed-list");
  if (!box) return;
  const snap = await db.collection("allowed_students").get();
  box.innerHTML = "";
  snap.forEach(d => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <span>${d.id}</span>
      <button class="btn ghost sm" onclick="removeAllowed('${d.id}')">ลบ</button>
    `;
    box.appendChild(div);
  });
}

async function addAllowed() {
  const id = document.getElementById("new-allowed-id").value.trim();
  if (!id) return;
  await db.collection("allowed_students").doc(id).set({
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById("new-allowed-id").value = "";
  loadAllowed();
}

window.removeAllowed = async function(id) {
  await db.collection("allowed_students").doc(id).delete();
  loadAllowed();
};


// ----- ADMIN: Roles -----
async function loadRoles() {
  const box = document.getElementById("roles-list");
  if (!box) return;
  const snap = await db.collection("roles").get();
  box.innerHTML = "";
  snap.forEach(d => {
    const r = d.data();
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <span>${r.label} (${r.max})</span>
      <button class="btn ghost sm" onclick="deleteRole('${d.id}')">ลบ</button>
    `;
    box.appendChild(div);
  });
}

async function addRole() {
  const label = document.getElementById("new-role-label").value.trim();
  const max = parseInt(document.getElementById("new-role-max").value || "0", 10);
  if (!label) return;
  await db.collection("roles").add({ label, max });
  document.getElementById("new-role-label").value = "";
  document.getElementById("new-role-max").value = "";
  loadRoles();
}

window.deleteRole = async function(id) {
  await db.collection("roles").doc(id).delete();
  loadRoles();
};
