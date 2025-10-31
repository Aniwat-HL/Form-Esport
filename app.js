// ===== 0. Firebase Init =====
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

// ===== 1. Elements =====
const ADMIN_CODE = "0826940174";
const loginBtn = document.getElementById("login-btn");
const studentIdInput = document.getElementById("student-id-input");
const logoutUser = document.getElementById("logout-btn-user");
const logoutAdmin = document.getElementById("logout-btn-admin");
const loggedInAs = document.getElementById("logged-in-as");
const adminLoggedInAs = document.getElementById("admin-logged-in-as");

const screens = document.querySelectorAll(".screen");
function showScreen(id) {
  screens.forEach(sc => sc.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// Toast helper
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}

// ===== 2. Start always on login =====
document.addEventListener("DOMContentLoaded", () => {
  showScreen("login-screen");
});

// ===== 3. LOGIN FLOW =====
loginBtn.addEventListener("click", async () => {
  const id = studentIdInput.value.trim();
  if (!id) return toast("กรอกรหัสก่อน");

  // --- admin ---
  if (id === ADMIN_CODE) {
    localStorage.setItem("role", "admin");
    localStorage.setItem("studentId", id);
    adminLoggedInAs.textContent = id;
    showScreen("admin-screen");
    loadQuestions();
    loadRegistrations();
    loadAllowed();
    loadRoles();
    return;
  }

  // --- student ---
  const doc = await db.collection("allowed_students").doc(id).get();
  if (!doc.exists) {
    toast("ยังไม่ได้รับอนุญาตให้ลงทะเบียน");
    return;
  }

  localStorage.setItem("role", "student");
  localStorage.setItem("studentId", id);
  loggedInAs.textContent = id;
  showScreen("user-form-screen");
  renderUserForm();
});

// ===== 4. LOGOUT =====
logoutUser.addEventListener("click", () => {
  localStorage.clear();
  showScreen("login-screen");
});
logoutAdmin.addEventListener("click", () => {
  localStorage.clear();
  showScreen("login-screen");
});

// ===== 5. ADMIN TABS =====
document.querySelectorAll(".admin-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ===== 6. ADMIN: Questions =====
async function loadQuestions() {
  const snap = await db.collection("form_questions").orderBy("order","asc").get();
  const list = document.getElementById("questions-list");
  list.innerHTML = "";
  snap.forEach(d => {
    const q = d.data();
    const div = document.createElement("div");
    div.className = "card glass";
    div.innerHTML = `
      <strong>${q.label}</strong><br>
      <small class="text-muted">${q.type} | ${q.required ? "ต้องกรอก" : "ไม่บังคับ"}</small>
      <button class="btn sm ghost" onclick="deleteQuestion('${d.id}')">ลบ</button>
    `;
    list.appendChild(div);
  });
}
async function deleteQuestion(id) {
  await db.collection("form_questions").doc(id).delete();
  loadQuestions();
  toast("ลบคำถามแล้ว");
}
document.getElementById("add-question-btn").addEventListener("click", async () => {
  const label = document.getElementById("new-q-label").value.trim();
  const type = document.getElementById("new-q-type").value;
  const required = document.getElementById("new-q-required").checked;
  const autoEmail = document.getElementById("new-q-autoemail").checked;
  if (!label) return toast("กรอกชื่อคำถาม");
  const snap = await db.collection("form_questions").orderBy("order","desc").limit(1).get();
  let nextOrder = 1; snap.forEach(d => nextOrder=(d.data().order||0)+1);
  await db.collection("form_questions").add({label,type,required,autoEmail,order:nextOrder});
  loadQuestions();
  toast("เพิ่มคำถามแล้ว");
});

// ===== 7. ADMIN: Registrations =====
async function loadRegistrations() {
  const list = document.getElementById("registrations-list");
  const snap = await db.collection("registrations").orderBy("createdAt","desc").get();
  list.innerHTML="";
  snap.forEach(d=>{
    const r = d.data();
    const div=document.createElement("div");
    div.className="card glass";
    div.innerHTML=`<strong>${r.userId}</strong><br>
      <small>${r.createdAt ? r.createdAt.toDate().toLocaleString() : ""}</small>
      <pre>${JSON.stringify(r.answers,null,2)}</pre>`;
    list.appendChild(div);
  });
}

// ===== 8. ADMIN: Allowed IDs =====
async function loadAllowed(){
  const list=document.getElementById("allowed-list");
  const snap=await db.collection("allowed_students").get();
  list.innerHTML="";
  snap.forEach(d=>{
    const div=document.createElement("div");
    div.className="row-between card";
    div.innerHTML=`<span>${d.id}</span>
      <button class="btn sm ghost" onclick="removeAllowed('${d.id}')">ลบ</button>`;
    list.appendChild(div);
  });
}
async function removeAllowed(id){
  await db.collection("allowed_students").doc(id).delete();
  loadAllowed(); toast("ลบรหัสแล้ว");
}
document.getElementById("add-allowed-id-btn").addEventListener("click",async()=>{
  const id=document.getElementById("new-allowed-id").value.trim();
  if(!id)return;
  await db.collection("allowed_students").doc(id).set({createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  loadAllowed(); toast("เพิ่มรหัสแล้ว");
});

// ===== 9. ADMIN: Roles =====
async function loadRoles(){
  const list=document.getElementById("roles-list");
  const snap=await db.collection("roles").get();
  list.innerHTML="";
  snap.forEach(d=>{
    const r=d.data();
    const div=document.createElement("div");
    div.className="row-between card";
    div.innerHTML=`<span>${r.label} (${r.max})</span>
      <button class="btn sm ghost" onclick="delRole('${d.id}')">ลบ</button>`;
    list.appendChild(div);
  });
}
async function delRole(id){await db.collection("roles").doc(id).delete();loadRoles();}
document.getElementById("add-role-btn").addEventListener("click",async()=>{
  const label=document.getElementById("new-role-label").value.trim();
  const max=parseInt(document.getElementById("new-role-max").value||"0",10);
  if(!label)return toast("กรอกชื่อ role");
  await db.collection("roles").add({label,max});
  loadRoles(); toast("เพิ่ม role แล้ว");
});

// ===== 10. USER FORM =====
async function renderUserForm(){
  const wrap=document.getElementById("user-form-container");
  const snap=await db.collection("form_questions").orderBy("order","asc").get();
  wrap.innerHTML="";
  snap.forEach(d=>{
    const q=d.data();
    const div=document.createElement("div");
    div.className="question-field";
    div.innerHTML=`<label>${q.label}${q.required?'<span class="required-badge">ต้องกรอก</span>':''}</label>
      ${q.type==='textarea'
        ?'<textarea data-id="'+d.id+'"></textarea>'
        :'<input type="text" data-id="'+d.id+'" />'}`;
    wrap.appendChild(div);
  });
}

// ===== 11. USER SUBMIT =====
document.getElementById("submit-user-form").addEventListener("click",async()=>{
  const userId=localStorage.getItem("studentId");
  const ans={};
  document.querySelectorAll("[data-id]").forEach(el=>{
    ans[el.dataset.id]=el.value;
  });
  await db.collection("registrations").doc(userId).set({
    userId,answers:ans,createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  toast("ส่งแบบฟอร์มสำเร็จ");
  document.getElementById("user-success").classList.remove("hidden");
});
