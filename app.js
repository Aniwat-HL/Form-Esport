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

/* ---------- LOGIN ---------- */
const loginBtn = document.getElementById("login-btn");
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return alert("กรุณากรอกรหัส");
    if (id === ADMIN_CODE) {
      localStorage.setItem("role", "admin");
      localStorage.setItem("studentId", id);
      window.location.href = "admin.html";
      return;
    }
    const doc = await db.collection("allowed_students").doc(id).get();
    if (!doc.exists) return alert("ยังไม่ได้รับอนุญาต");
    localStorage.setItem("role", "student");
    localStorage.setItem("studentId", id);
    window.location.href = "user.html";
  });
}

/* ---------- USER PAGE ---------- */
const logoutUser = document.getElementById("logout-btn-user");
if (logoutUser) {
  document.getElementById("logged-in-as").innerText = localStorage.getItem("studentId");
  logoutUser.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });
  renderUserForm();
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
        ${q.type === "textarea" ? `<textarea data-id="${d.id}"></textarea>` : `<input data-id="${d.id}" type="text">`}
      </div>`;
  });
}
const submitBtn = document.getElementById("submit-user-form");
if (submitBtn) {
  submitBtn.addEventListener("click", async () => {
    const uid = localStorage.getItem("studentId");
    const ans = {};
    document.querySelectorAll("[data-id]").forEach(el => ans[el.dataset.id] = el.value);
    await db.collection("registrations").doc(uid).set({
      userId: uid,
      answers: ans,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("user-success").classList.remove("hidden");
  });
}

/* ---------- ADMIN PAGE ---------- */
const logoutAdmin = document.getElementById("logout-btn-admin");
if (logoutAdmin) {
  document.getElementById("admin-logged-in-as").innerText = localStorage.getItem("studentId");
  logoutAdmin.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });
  loadQuestions();
  loadRegistrations();
  loadAllowed();
  loadRoles();
}
async function loadQuestions() {
  const list = document.getElementById("questions-list");
  if (!list) return;
  const snap = await db.collection("form_questions").orderBy("order", "asc").get();
  list.innerHTML = "";
  snap.forEach(d => {
    const q = d.data();
    const div = document.createElement("div");
    div.className = "card light";
    div.innerHTML = `<strong>${q.label}</strong> <button onclick="deleteQuestion('${d.id}')">ลบ</button>`;
    list.appendChild(div);
  });
}
async function deleteQuestion(id) {
  await db.collection("form_questions").doc(id).delete();
  loadQuestions();
}
async function loadRegistrations() {
  const list = document.getElementById("registrations-list");
  if (!list) return;
  const snap = await db.collection("registrations").orderBy("createdAt", "desc").get();
  list.innerHTML = "";
  snap.forEach(d => {
    const r = d.data();
    const div = document.createElement("div");
    div.className = "card light";
    div.innerHTML = `<strong>${r.userId}</strong><pre>${JSON.stringify(r.answers, null, 2)}</pre>`;
    list.appendChild(div);
  });
}
async function loadAllowed() {
  const list = document.getElementById("allowed-list");
  if (!list) return;
  const snap = await db.collection("allowed_students").get();
  list.innerHTML = "";
  snap.forEach(d => {
    const div = document.createElement("div");
    div.className = "card light";
    div.innerHTML = `${d.id} <button onclick="removeAllowed('${d.id}')">ลบ</button>`;
    list.appendChild(div);
  });
}
async function removeAllowed(id) {
  await db.collection("allowed_students").doc(id).delete();
  loadAllowed();
}
async function loadRoles() {
  const list = document.getElementById("roles-list");
  if (!list) return;
  const snap = await db.collection("roles").get();
  list.innerHTML = "";
  snap.forEach(d => {
    const r = d.data();
    const div = document.createElement("div");
    div.className = "card light";
    div.innerHTML = `${r.label} (${r.max}) <button onclick="deleteRole('${d.id}')">ลบ</button>`;
    list.appendChild(div);
  });
}
async function deleteRole(id) {
  await db.collection("roles").doc(id).delete();
  loadRoles();
}
