// ================== Firebase ==================
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

// admin code
const ADMIN_CODE = "0826940174";

// เก็บตัวเลือก dropdown ชั่วคราวแบบ {label, limit}
let currentOptionList = [];


// ======================================================
// 1) LOGIN PAGE
// ======================================================
const loginBtn = document.getElementById("login-btn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const idEl = document.getElementById("student-id-input");
    const id = idEl.value.trim();
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
  // show id
  const uid = localStorage.getItem("studentId") || "-";
  document.getElementById("logged-in-as").textContent = uid;

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
        ${opts.map(o => `<option value="${o.label}">${o.label}${o.limit ? ` (โควต้า ${o.limit})` : ""}</option>`).join("")}
      </select>`;
    } else {
      inputHtml = `<input type="text" data-id="${d.id}" />`;
    }

    wrap.innerHTML += `
      <div class="question-field">
        <label>${q.label}${q.required ? " *" : ""}</label>
        ${inputHtml}
      </div>
    `;
  });
}

async function submitUserForm() {
  const uid = localStorage.getItem("studentId");
  if (!uid) return;

  // ดึงคำถามทั้งหมดมาก่อน
  const qSnap = await db.collection("form_questions").get();
  const questions = {};
  qSnap.forEach(d => questions[d.id] = d.data());

  // เก็บคำตอบจากฟอร์ม
  const answers = {};
  document.querySelectorAll("[data-id]").forEach(el => {
    answers[el.dataset.id] = el.value;
  });

  // เช็กโควต้าของทุก dropdown
  for (const qId in answers) {
    const q = questions[qId];
    if (!q) continue;

    // สนใจเฉพาะ dropdown
    if (q.type === "select" && Array.isArray(q.options)) {
      const userChoice = answers[qId]; // เช่น "ชั้นปี 1"
      const opt = q.options.find(o => o.label === userChoice);

      if (opt && opt.limit) {
        // นับ registration ทั้งหมดที่เลือก option นี้ในคำถามนี้
        const regSnap = await db.collection("registrations").get();
        let used = 0;
        regSnap.forEach(doc => {
          const data = doc.data();
          if (data.answers && data.answers[qId] === userChoice) {
            used++;
          }
        });

        if (used >= opt.limit) {
          alert(`ตัวเลือก "${userChoice}" เต็มแล้ว กรุณาเลือกตัวเลือกอื่น`);
          return;
        }
      }
    }
  }

  // ถ้าผ่านทุกอย่าง → บันทึก
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
  // set id
  document.getElementById("admin-logged-in-as").textContent = localStorage.getItem("studentId") || "";

  // logout
  logoutAdminBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  // sidebar tabs
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.tab;
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(target).classList.add("active");
    });
  });

  // dropdown option controls
  const typeSelect = document.getElementById("new-q-type");
  const optWrap = document.getElementById("new-q-options-wrap");
  const optInput = document.getElementById("new-q-option-input");
  const optLimitInput = document.getElementById("new-q-option-limit");
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
      const label = optInput.value.trim();
      const limitRaw = optLimitInput.value.trim();
      if (!label) return;
      currentOptionList.push({
        label,
        limit: limitRaw ? parseInt(limitRaw, 10) : null
      });
      optInput.value = "";
      optLimitInput.value = "";
      renderOptionList(optListEl);
    });
  }

  // load data
  loadQuestions();
  loadRegistrations();
  loadAllowed();
  loadRoles();

  // admin buttons
  document.getElementById("add-question-btn").addEventListener("click", addQuestion);
  document.getElementById("add-allowed-id-btn").addEventListener("click", addAllowed);
  document.getElementById("add-role-btn").addEventListener("click", addRole);
}

// แสดงรายชื่อตัวเลือกชั่วคราว
function renderOptionList(container) {
  if (!container) return;
  container.innerHTML = "";
  currentOptionList.forEach((opt, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `${opt.label}${opt.limit ? ` <small>(รับ ${opt.limit})</small>` : ""} <button onclick="removeTempOption(${idx})">×</button>`;
    container.appendChild(li);
  });
}
window.removeTempOption = function(idx) {
  currentOptionList.splice(idx, 1);
  renderOptionList(document.getElementById("new-q-options-list"));
};


// ------------- ADMIN: Questions -------------
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
        <div class="muted small">${q.type}</div>
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

  if (!label) return alert("กรอกชื่อคำถามก่อน");

  // หา order ล่าสุด
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
    order: nextOrder
  });

  // reset form
  document.getElementById("new-q-label").value = "";
  document.getElementById("new-q-required").checked = false;
  document.getElementById("new-q-autoemail").checked = false;
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

  document.getElementById("new-q-label").value = q.label || "";
  document.getElementById("new-q-type").value = q.type || "text";
  document.getElementById("new-q-required").checked = !!q.required;
  document.getElementById("new-q-autoemail").checked = !!q.autoEmail;

  if (q.type === "select") {
    document.getElementById("new-q-options-wrap").style.display = "block";
    currentOptionList = Array.isArray(q.options) ? q.options : [];
    renderOptionList(document.getElementById("new-q-options-list"));
  } else {
    document.getElementById("new-q-options-wrap").style.display = "none";
    currentOptionList = [];
    renderOptionList(document.getElementById("new-q-options-list"));
  }

  const btn = document.getElementById("add-question-btn");
  btn.textContent = "บันทึกการแก้ไข";
  btn.onclick = async () => {
    const newLabel = document.getElementById("new-q-label").value.trim();
    const newType = document.getElementById("new-q-type").value;
    const newReq = document.getElementById("new-q-required").checked;
    const newAuto = document.getElementById("new-q-autoemail").checked;

    await db.collection("form_questions").doc(id).update({
      label: newLabel,
      type: newType,
      required: newReq,
      autoEmail: newAuto,
      options: newType === "select" ? currentOptionList : []
    });

    // reset
    btn.textContent = "เพิ่มคำถาม";
    btn.onclick = addQuestion;
    document.getElementById("new-q-label").value = "";
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


// ------------- ADMIN: Registrations -------------
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


// ------------- ADMIN: Allowed IDs -------------
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


// ------------- ADMIN: Roles -------------
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
