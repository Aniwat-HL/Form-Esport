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

// ===== constants =====
const ADMIN_CODE = "0826940174";
const LOCAL_DRAFT_PREFIX = "formDraft_";

// ===== globals =====
let currentOptionList = [];    // admin: ตัวเลือกชั่วคราวของคำถาม select
let REG_CACHE = [];           // admin: รายการสมัคร
let FORM_QUESTION_CACHE = []; // admin: หัวตาราง

/* =========================================================
   1) LOGIN PAGE (index.html)
   ========================================================= */
const loginBtn = document.getElementById("login-btn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return alert("กรุณากรอกรหัสนักศึกษา/แอดมิน");

    // ---- admin ----
    if (id === ADMIN_CODE) {
      localStorage.setItem("role", "admin");
      localStorage.setItem("studentId", id);
      window.location.href = "admin.html";
      return;
    }

    // ---- student ---- (ต้องอยู่ใน allowed_students)
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
   Utility สำหรับ draft (user)
   ========================================================= */
function getLocalDraft(studentId) {
  if (!studentId) return {};
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_PREFIX + studentId);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function setLocalDraft(studentId, draftObj) {
  if (!studentId) return;
  try {
    localStorage.setItem(
      LOCAL_DRAFT_PREFIX + studentId,
      JSON.stringify(draftObj || {})
    );
  } catch (e) {
    console.warn("cannot save draft", e);
  }
}

function clearLocalDraft(studentId) {
  if (!studentId) return;
  localStorage.removeItem(LOCAL_DRAFT_PREFIX + studentId);
}

/* =========================================================
   2) USER PAGE (user.html)
   ========================================================= */
const logoutUserBtn = document.getElementById("logout-btn-user");
if (logoutUserBtn) {
  const sid = localStorage.getItem("studentId") || "-";
  const badge = document.getElementById("logged-in-as");
  if (badge) badge.textContent = sid;

  logoutUserBtn.addEventListener("click", () => {
    // ออกจากระบบ → ล้างเฉพาะข้อมูล session
    localStorage.removeItem("role");
    localStorage.removeItem("studentId");
    window.location.href = "index.html";
  });

  // แสดงฟอร์ม
  renderUserForm();
  document.getElementById("submit-user-form").addEventListener("click", submitUserForm);
}

/**
 * renderUserForm()
 * - โหลดโครงฟอร์มจาก form_questions
 * - ดึงคำตอบเก่าจาก Firestore
 * - ดึง draft จาก localStorage
 * - รวมค่า: localDraft > firestoreAnswer > ""
 * - นับจำนวนคนเลือกแต่ละ option เพื่อปิดตัวที่เต็ม
 * - ❗ เวอร์ชันนี้: ถ้า option เต็มแล้ว → disabled ให้ทุกคนเลย
 */
async function renderUserForm() {
  const wrap = document.getElementById("user-form-container");
  if (!wrap) return;

  const studentId = localStorage.getItem("studentId") || "";

  // 1) โหลดคำถาม
  const qSnap = await db.collection("form_questions").orderBy("order", "asc").get();

  // 2) โหลดคำตอบเก่าจาก Firestore
  let oldAnswers = {};
  let oldDoc = await db.collection("registrations").doc(studentId).get();

  if (oldDoc.exists) {
    oldAnswers = oldDoc.data().answers || {};
  } else {
    // เผื่อเคยเซฟด้วย doc id สุ่ม แต่มี field userId
    const q = await db.collection("registrations")
      .where("userId", "==", studentId)
      .limit(1)
      .get();
    if (!q.empty) {
      const d = q.docs[0];
      oldDoc = d;
      oldAnswers = d.data().answers || {};
    }
  }

  // 3) โหลด draft ในเครื่อง
  const localDraft = getLocalDraft(studentId); // {questionId: value}

  // 4) โหลดทั้งหมดเพื่อนับ quota dropdown
  const regSnap = await db.collection("registrations").get();
  const counts = {}; // { questionId: {label: count} }
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

  // 5) render
  wrap.innerHTML = "";
  qSnap.forEach(d => {
    const q = d.data();
    const qId = d.id;

    // ค่าที่จะใส่ = draft > firestore
    const fromDb = oldAnswers[qId] || "";
    const fromLocal = localDraft[qId] || "";
    const finalValue = fromLocal || fromDb || "";

    let inputHtml = "";
    const autoEmailValue = q.autoEmail
      ? `s${studentId}@phuket.psu.ac.th`
      : "";

    if (q.type === "textarea") {
      inputHtml = `<textarea data-id="${qId}">${finalValue}</textarea>`;
    } else if (q.type === "select") {
      const opts = Array.isArray(q.options) ? q.options : [];
      const qCounts = counts[qId] || {};
      inputHtml = `<select data-id="${qId}" class="input-select">
        <option value="">-- เลือก --</option>
        ${opts.map(o => {
          const used = qCounts[o.label] || 0;

          // ถ้าไม่มี limit → ปกติ
          if (!o.limit) {
            return `<option value="${o.label}" ${o.label === finalValue ? "selected" : ""}>${o.label}</option>`;
          }

          const full = used >= o.limit;
          const label = full
            ? `${o.label} (เต็ม ${used}/${o.limit})`
            : `${o.label} (${used}/${o.limit})`;

          // ❗ เวอร์ชันนี้: ถ้าเต็มแล้ว → disabled สำหรับทุกคน
          if (full) {
            return `<option value="${o.label}" disabled>${label}</option>`;
          }

          return `<option value="${o.label}" ${o.label === finalValue ? "selected" : ""}>${label}</option>`;
        }).join("")}
      </select>`;
    } else {
      // text
      if (q.autoEmail) {
        inputHtml = `<input type="text" data-id="${qId}" value="${autoEmailValue}" readonly style="background:#f3f4f6;" />`;
      } else {
        inputHtml = `<input type="text" data-id="${qId}" value="${finalValue}" />`;
      }
    }

    wrap.innerHTML += `
      <div class="question-field">
        <label>${q.label}${q.required ? ' <span class="required">*</span>' : ''}</label>
        ${inputHtml}
      </div>
    `;
  });

  // 6) ผูก event เพื่อเซฟ draft ทันทีที่กรอก
  wrap.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("input", () => {
      const qid = el.dataset.id;
      const current = getLocalDraft(studentId);
      current[qid] = el.value;
      setLocalDraft(studentId, current);
    });
  });
}

/**
 * submitUserForm()
 * - validate ช่องที่มี *
 * - เช็ก quota ของ select อีกครั้ง (กันกดพร้อมกัน)
 * - บันทึก
 * - ลบ draft
 * - กลับหน้า login
 */
async function submitUserForm() {
  const uid = localStorage.getItem("studentId");
  if (!uid) return;

  const btn = document.getElementById("submit-user-form");
  const successBox = document.getElementById("user-success");

  btn.disabled = true;
  btn.textContent = "กำลังตรวจสอบ...";

  try {
    // โหลดคำถามมาเช็ก required / quota
    const qSnap = await db.collection("form_questions").get();
    const questions = {};
    qSnap.forEach(d => questions[d.id] = d.data());

    // เก็บคำตอบ + เช็ก required
    const answers = {};
    const missing = [];
    document.querySelectorAll("[data-id]").forEach(el => {
      const qid = el.dataset.id;
      const q = questions[qid];
      const val = (el.value || "").trim();

      if (q && q.required && !val) {
        missing.push(q.label);
        el.classList.add("input-error");
      } else {
        el.classList.remove("input-error");
      }
      answers[qid] = val;
    });

    if (missing.length) {
      alert("กรุณากรอกข้อมูลให้ครบในช่องต่อไปนี้:\n- " + missing.join("\n- "));
      btn.disabled = false;
      btn.textContent = "ส่งแบบฟอร์ม";
      return;
    }

    // เช็ก quota อีกครั้งตอนกดส่ง
    for (const qId in answers) {
      const q = questions[qId];
      if (!q) continue;
      if (q.type !== "select" || !Array.isArray(q.options)) continue;

      const userChoice = answers[qId];
      if (!userChoice) continue;
      const opt = q.options.find(o => o.label === userChoice);
      if (!opt || !opt.limit) continue;

      // ดึงนับจริง
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
        btn.disabled = false;
        btn.textContent = "ส่งแบบฟอร์ม";
        return;
      }
    }

    // บันทึก
    await db.collection("registrations").doc(uid).set({
      userId: uid,
      answers,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // ลบ draft ของคนนี้
    clearLocalDraft(uid);

    // แจ้งสำเร็จ
    if (successBox) {
      successBox.classList.remove("hidden");
      successBox.textContent = "ส่งข้อมูลเรียบร้อยแล้ว ขอบคุณที่เข้าร่วมกิจกรรม ✅ กำลังกลับไปหน้าเข้าสู่ระบบ...";
    }
    btn.textContent = "ส่งแล้ว ✅";

    // ออกจากระบบ
    localStorage.removeItem("role");
    localStorage.removeItem("studentId");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 3500);
  } catch (err) {
    console.error(err);
    alert("ส่งไม่สำเร็จ: " + err.message);
    btn.disabled = false;
    btn.textContent = "ส่งแบบฟอร์ม";
  }
}

/* =========================================================
   3) ADMIN PAGE (admin.html)
   ========================================================= */
const logoutAdminBtn = document.getElementById("logout-btn-admin");
if (logoutAdminBtn) {
  const sid = localStorage.getItem("studentId") || "";
  const el = document.getElementById("admin-logged-in-as");
  if (el) el.textContent = sid;

  logoutAdminBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  // nav tabs
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      const tab = document.getElementById(btn.dataset.tab);
      if (tab) tab.classList.add("active");
    });
  });

  // controls
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

/* ===== admin helpers ===== */
function renderOptionList(container) {
  if (!container) return;
  container.innerHTML = "";
  currentOptionList.forEach((opt, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `${opt.label}${opt.limit ? ` <small>(รับ ${opt.limit})</small>` : ""} <button onclick="removeTempOption(${idx})">×</button>`;
    container.appendChild(li);
  });
}
window.removeTempOption = function (idx) {
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

window.editQuestion = async function (id) {
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

    btn.textContent = "เพิ่มคำถาม";
    btn.onclick = addQuestion;
    document.getElementById("new-q-label").value = "";
    currentOptionList = [];
    renderOptionList(document.getElementById("new-q-options-list"));
    document.getElementById("new-q-options-wrap").style.display = "none";

    loadQuestions();
  };
};

window.deleteQuestion = async function (id) {
  await db.collection("form_questions").doc(id).delete();
  loadQuestions();
};

async function loadRegistrations() {
  const tableEl = document.getElementById("registrations-table");
  if (!tableEl) return;

  const qSnap = await db.collection("form_questions").orderBy("order", "asc").get();
  FORM_QUESTION_CACHE = [];
  qSnap.forEach(d => {
    FORM_QUESTION_CACHE.push({
      id: d.id,
      label: d.data().label || d.id
    });
  });

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

  renderRegistrationsTable(REG_CACHE);

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

  let theadHtml = `<thead><tr>
    <th class="sticky-col">รหัส นศ.</th>
    <th>เวลาส่ง</th>
    ${FORM_QUESTION_CACHE.map(q => `<th>${q.label}</th>`).join("")}
    <th>จัดการ</th>
  </tr></thead>`;

  let tbodyHtml = "<tbody>";
  if (!items.length) {
    tbodyHtml += `<tr><td colspan="${3 + FORM_QUESTION_CACHE.length}" style="padding:.75rem;">ไม่พบข้อมูล</td></tr>`;
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
        <td><button class="btn ghost sm" onclick="deleteRegistration('${r.id}')">ลบ</button></td>
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

window.deleteRegistration = async function (regId) {
  const ok = confirm("ต้องการลบรายการนี้จริง ๆ ไหม?");
  if (!ok) return;
  try {
    await db.collection("registrations").doc(regId).delete();
    REG_CACHE = REG_CACHE.filter(r => r.id !== regId);
    renderRegistrationsTable(REG_CACHE);
  } catch (err) {
    console.error("deleteRegistration error:", err);
    alert("ลบไม่ได้: " + err.message);
  }
};

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
window.removeAllowed = async function (id) {
  await db.collection("allowed_students").doc(id).delete();
  loadAllowed();
};

async function loadRoles() {
  const box = document.getElementById("roles-list");
  if (!box) return;
  try {
    const snap = await db.collection("roles").get();
    box.innerHTML = "";
    if (snap.empty) {
      box.innerHTML = `<div class="muted small" style="padding:.5rem 0;">ยังไม่มี Role ในระบบ</div>`;
      return;
    }
    snap.forEach(d => {
      const r = d.data();
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div>
          <strong>${r.label || d.id}</strong>
          <div class="muted small">รับได้สูงสุด: ${typeof r.max === "number" ? r.max : "-"}</div>
        </div>
        <button class="btn ghost sm" onclick="deleteRole('${d.id}')">ลบ</button>
      `;
      box.appendChild(div);
    });
  } catch (err) {
    console.error("loadRoles error:", err);
    box.innerHTML = `<div class="muted small" style="color:#b91c1c;">โหลด Role ไม่ได้: ${err.message}</div>`;
  }
}

async function addRole() {
  const labelEl = document.getElementById("new-role-label");
  const maxEl = document.getElementById("new-role-max");
  const label = labelEl.value.trim();
  const maxRaw = maxEl.value.trim();

  if (!label) {
    alert("กรอกชื่อบทบาทก่อน");
    return;
  }

  const max = maxRaw ? parseInt(maxRaw, 10) : null;

  try {
    await db.collection("roles").add({
      label,
      max
    });

    labelEl.value = "";
    maxEl.value = "";
    loadRoles();
  } catch (err) {
    console.error("addRole error:", err);
    alert("เพิ่ม role ไม่ได้: " + err.message);
  }
}

window.deleteRole = async function (id) {
  try {
    await db.collection("roles").doc(id).delete();
    loadRoles();
  } catch (err) {
    console.error("deleteRole error:", err);
    alert("ลบ role ไม่ได้: " + err.message);
  }
};
