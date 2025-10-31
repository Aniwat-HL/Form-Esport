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

const ADMIN_CODE = "0826940174";

// admin helpers
let currentOptionList = [];    // ตัวเลือกของคำถามใหม่ (type=select)
let REG_CACHE = [];           // เก็บผู้สมัครทั้งหมด
let FORM_QUESTION_CACHE = []; // เก็บหัวตารางจาก form_questions

/* =========================================================
   1) LOGIN PAGE (index.html)
   ========================================================= */
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

/* =========================================================
   2) USER PAGE (user.html)
   ========================================================= */
const logoutUserBtn = document.getElementById("logout-btn-user");
if (logoutUserBtn) {
  document.getElementById("logged-in-as").textContent = localStorage.getItem("studentId") || "-";

  logoutUserBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  renderUserForm();
  document.getElementById("submit-user-form").addEventListener("click", submitUserForm);
}

/**
 * renderUserForm
 * - ดึงฟอร์ม
 * - ดึงคำตอบทั้งหมด
 * - นับว่าแต่ละ option ถูกใช้ไปกี่ครั้ง → แสดง (ใช้ไป/โควต้า)
 */
async function renderUserForm() {
  const wrap = document.getElementById("user-form-container");
  if (!wrap) return;

  const qSnap = await db.collection("form_questions").orderBy("order", "asc").get();

  // ดึง registrations ทั้งหมดมานับ
  const regSnap = await db.collection("registrations").get();
  const counts = {}; // counts[qid][optionLabel] = used
  regSnap.forEach(doc => {
    const data = doc.data();
    const ans = data.answers || {};
    Object.keys(ans).forEach(qid => {
      const val = ans[qid];
      if (!counts[qid]) counts[qid] = {};
      if (!counts[qid][val]) counts[qid][val] = 0;
      counts[qid][val] += 1;
    });
  });

  wrap.innerHTML = "";
  qSnap.forEach(d => {
    const q = d.data();
    let inputHtml = "";

    if (q.type === "textarea") {
      inputHtml = `<textarea data-id="${d.id}"></textarea>`;
    } else if (q.type === "select") {
      const opts = Array.isArray(q.options) ? q.options : [];
      const qCounts = counts[d.id] || {};
      inputHtml = `<select data-id="${d.id}">
        ${opts.map(o => {
          const used = qCounts[o.label] || 0;
          if (!o.limit) {
            return `<option value="${o.label}">${o.label}</option>`;
          }
          const full = used >= o.limit;
          const label = full
            ? `${o.label} (เต็ม ${used}/${o.limit})`
            : `${o.label} (${used}/${o.limit})`;
          return `<option value="${o.label}" ${full ? "disabled" : ""}>${label}</option>`;
        }).join("")}
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

/**
 * ส่งแบบฟอร์ม (เช็กโควต้าซ้ำอีกครั้ง)
 */
async function submitUserForm() {
  const uid = localStorage.getItem("studentId");
  if (!uid) return;

  const qSnap = await db.collection("form_questions").get();
  const questions = {};
  qSnap.forEach(d => questions[d.id] = d.data());

  // เก็บคำตอบ
  const answers = {};
  document.querySelectorAll("[data-id]").forEach(el => {
    answers[el.dataset.id] = el.value;
  });

  // เช็กทุก dropdown ที่มี limit
  for (const qId in answers) {
    const q = questions[qId];
    if (!q) continue;
    if (q.type !== "select" || !Array.isArray(q.options)) continue;

    const userChoice = answers[qId];
    const opt = q.options.find(o => o.label === userChoice);
    if (!opt || !opt.limit) continue;

    // นับจริงจากฐานข้อมูล
    const regSnap = await db.collection("registrations").get();
    let used = 0;
    regSnap.forEach(doc => {
      const data = doc.data();
      if (data.answers && data.answers[qId] === userChoice) {
        used++;
      }
    });

    if (used >= opt.limit) {
      alert(`ตัวเลือก "${userChoice}" เต็มแล้ว กรุณาเลือกตัวอื่น`);
      return;
    }
  }

  // บันทึก
  await db.collection("registrations").doc(uid).set({
    userId: uid,
    answers,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("user-success").classList.remove("hidden");
}

/* =========================================================
   3) ADMIN PAGE (admin.html)
   ========================================================= */
const logoutAdminBtn = document.getElementById("logout-btn-admin");
if (logoutAdminBtn) {
  document.getElementById("admin-logged-in-as").textContent = localStorage.getItem("studentId") || "";

  logoutAdminBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  // สลับแท็บ
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // controls ของ dropdown
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

  // โหลดข้อมูล admin
  loadQuestions();
  loadRegistrations();
  loadAllowed();
  loadRoles();

  // ปุ่มหลัก
  document.getElementById("add-question-btn").addEventListener("click", addQuestion);
  document.getElementById("add-allowed-id-btn").addEventListener("click", addAllowed);
  document.getElementById("add-role-btn").addEventListener("click", addRole);
}

/* ---------- ADMIN: แบบฟอร์ม ---------- */
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

async function loadQuestions() {
  const box = document.getElementById("questions-list");
  if (!box) return;
  const snap = await db.collection("form_questions").orderBy("order", "asc").get();
  box.innerHTML = "";
  snap.forEach(d => {
    const q = d.data();
    const div = document.createElement("div");
    div.className = "list-item";
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

  // reset
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

/* ---------- ADMIN: ผู้สมัคร (table) ---------- */
async function loadRegistrations() {
  const tableEl = document.getElementById("registrations-table");
  if (!tableEl) return;

  // 1) โหลดคำถาม → ใช้เป็นหัวตาราง
  const qSnap = await db.collection("form_questions").orderBy("order", "asc").get();
  FORM_QUESTION_CACHE = [];
  qSnap.forEach(d => {
    FORM_QUESTION_CACHE.push({
      id: d.id,
      label: d.data().label || d.id
    });
  });

  // 2) โหลดผู้สมัคร (กัน createdAt.toDate error)
  const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
  REG_CACHE = [];
  snap.forEach(d => {
    const data = d.data();
    let created = null;
    if (data.createdAt && typeof data.createdAt.toDate === "function") {
      created = data.createdAt.toDate();
    }
    REG_CACHE.push({
      id: d.id,
      userId: data.userId || d.id,
      answers: data.answers || {},
      createdAt: created
    });
  });

  // 3) แสดงตาราง
  renderRegistrationsTable(REG_CACHE);

  // 4) ผูก search
  const searchInput = document.getElementById("reg-search-input");
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim();
      if (!q) {
        renderRegistrationsTable(REG_CACHE);
      } else {
        const filtered = REG_CACHE.filter(r =>
          r.userId.toLowerCase().includes(q.toLowerCase())
        );
        renderRegistrationsTable(filtered);
      }
    });
    searchInput.dataset.bound = "1";
  }
}

function renderRegistrationsTable(items) {
  const tableEl = document.getElementById("registrations-table");
  const totalLabel = document.getElementById("reg-total-label");
  if (!tableEl) return;

  // head
  let theadHtml = `<thead><tr>
    <th class="sticky-col">รหัส นศ.</th>
    <th>เวลาส่ง</th>
    ${FORM_QUESTION_CACHE.map(q => `<th>${q.label}</th>`).join("")}
  </tr></thead>`;

  // body
  let tbodyHtml = "<tbody>";
  if (!items.length) {
    tbodyHtml += `<tr><td colspan="${2 + FORM_QUESTION_CACHE.length}" style="padding:.75rem;">ไม่พบข้อมูล</td></tr>`;
  } else {
    items.forEach(r => {
      tbodyHtml += `<tr>
        <td class="sticky-col">${r.userId}</td>
        <td>${r.createdAt instanceof Date ? r.createdAt.toLocaleString() : ""}</td>
        ${FORM_QUESTION_CACHE.map(q => {
          const val = r.answers[q.id];
          if (val && typeof val === "object" && "value" in val) {
            return `<td>${val.value}</td>`;
          }
          return `<td>${val ? val : ""}</td>`;
        }).join("")}
      </tr>`;
    });
  }
  tbodyHtml += "</tbody>";

  tableEl.innerHTML = theadHtml + tbodyHtml;

  if (totalLabel) {
    totalLabel.textContent = items.length
      ? `พบ ${items.length} รายการ (ทั้งหมด ${REG_CACHE.length})`
      : `ไม่พบข้อมูล (ทั้งหมด ${REG_CACHE.length})`;
  }
}

/* ---------- ADMIN: รหัสอนุญาต ---------- */
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

/* ---------- ADMIN: Roles ---------- */
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
