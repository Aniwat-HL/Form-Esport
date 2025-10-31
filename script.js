// ใส่ URL จาก Google Apps Script ตรงนี้
const WEB_APP_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec';

const form = document.getElementById('regForm');
const statusEl = document.getElementById('status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = 'กำลังส่ง...';

  // ดึงค่าจากฟอร์ม
  const formData = new FormData(form);
  const data = {
    email: formData.get('email'),
    studentId: formData.get('studentId'),
    title: formData.get('title'),
    fullname: formData.get('fullname'),
    position: formData.get('position'),
    food: formData.get('food'),
  };

  try {
    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors', // เพื่อให้ยิงได้จาก GitHub Pages
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
    });

    // ถ้าใช้ no-cors จะอ่าน response ไม่ได้ แต่เราถือว่าส่งแล้ว
    statusEl.textContent = 'ส่งข้อมูลแล้ว ✅';
    form.reset();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง ❌';
  }
});
