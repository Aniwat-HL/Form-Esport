// ========== 0. Firebase ========== //
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


// ========== 1. LOGIN PAGE ========== //
const loginBtn = document.getElementById("login-btn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const input = document.getElementById("student-id-input");
    const id = input.value.trim();
    if (!id) {
      alert("กรุณากรอกรหัส");
      return;
    }

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
      alert("ยังไม่ได้รับอนุญาตให้เข้าระบบ");
      return;
    }

    localStorage.setItem("role", "student");
    localStorage.setItem("studentId", id);
    window.location.href = "user.html";
  });
}


// ========== 2. USER PAGE ========== //
const logoutUserBtn = document.getElementById("logout-btn-user");
if (logoutUserBtn) {
  const showId = document.getElementById("logged-in-as");
  showId.textContent = localStorage.getItem("studentId") || "-";

  logoutUserBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  renderUserForm();

  const submitBtn = document.getElementById("submit-user-form");
  submitBtn.addEventListener("click", async () => {
    const uid = localStorage.getItem("studentId");
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
  });
}

async function renderUserForm() {
  const wrap = document.getElementById("user-form-container");
  if (!wrap) return;

  const snap = await db.collection("form_questions").orderBy("order", "asc").get();
  wrap.innerHTML = "";
  snap.forEach(d => {
    const q = d.data();
    wrap.innerHTML += `
      <div class="question-field">
        <label>${q.label}${q.required ? ' *' : ''}</label>
        ${
          q.type === "textarea"
            ? `<textarea data-id="${d.id}"></textarea>`
            : `<input type="text" data-id="${d.id}" />`
        }
      </div>
    `;
  });
}


// ========== 3. ADMIN PAGE ========== //
const logoutAdminBtn = document.getElementById("logout-btn-admin");
if (logoutAdminBtn) {
  const adminLabel = document.getElementById("admin-logged-in-as");
  adminLabel.textContent = localStorage.getItem("studentId") || "";

  logoutAdminBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });

  // tabs
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.dataset.tab;
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(target).classList.add("active");
    });
  });

  loadQuestions();
  loadRegistrations();
  loadAllowed();
  loadRoles();

  // add question
  document.getElementById("add-question-btn").addEventListener("click", addQuestion);
  document.getElementById("add-allowed-id-btn").addEventListener("click", addAllowed);
  document.getElementById("add-role-btn").addEventListener("click", addRole);
}

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
      <span>${q.label} <small class="muted">(${q.type})</small></span>
      <button class="btn ghost sm" onclick="deleteQuestion('${d.id}')">ลบ</button>
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
    order: nextOrder
  });

  document.getElementById("new-q-label").value = "";
  document.getElementById("new-q-required").checked = false;
  document.getElementById("new-q-autoemail").checked = false;

  loadQuestions();
}

async function deleteQuestion(id) {
  await db.collection("form_questions").doc(id).delete();
  loadQuestions();
}

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
      <p><strong>${r.userId || "—"}</strong></p>
      <pre class="json-block">${JSON.stringify(r.answers, null, 2)}</pre>
    `;
    box.appendChild(card);
  });
}

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

async function removeAllowed(id) {
  await db.collection("allowed_students").doc(id).delete();
  loadAllowed();
}

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

async function deleteRole(id) {
  await db.collection("roles").doc(id).delete();
  loadRoles();
}
