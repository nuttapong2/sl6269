#
## ตรวจตัวอย่างที่เผยแพร่แล้ว

เปิด https://sl6269-preview.onrender.com ได้ทั้งมือถือและคอมพิวเตอร์ โหมด DEMO ใช้ข้อมูลสมมติ เก็บเฉพาะอุปกรณ์ ไม่รับรหัสผ่านจริงหรือเงินฝากจริง

โค้ดระบบจริงมี API และ SQLite แล้ว แต่ยังไม่ได้เปิดบริการฐานข้อมูลถาวร การเริ่มบริการจริงผ่าน Blueprint จะสร้าง web service แบบเสียเงินพร้อม disk 1 GB ตรวจยอดใน Render ก่อนยืนยัน: https://dashboard.render.com/blueprint/new?repo=https://github.com/nuttapong2/sl6269

ตั้ง ADMIN_PASSWORD เป็น secret ใน Render และตั้ง FRONTEND_ORIGIN=https://sl6269-preview.onrender.com จากนั้นเปิด URL ของ backend เพื่อเข้าสู่ระบบครูและนำเข้ารายชื่อ Backend เสิร์ฟหน้าเว็บและ API ใน URL เดียวกันได้ จึงไม่จำเป็นต้องเปิด GitHub Pages

GitHub Actions ทดสอบและสร้างไฟล์ทุกครั้ง ส่วน deploy ไป GitHub Pages จะทำเฉพาะเมื่อเจ้าของเปิด Pages และตั้ง repository variable ENABLE_GITHUB_PAGES=true ตัวอย่าง Render เผยแพร่แยกจาก Pages

 ห้องของเรา ป.6/2 — SL6269

เว็บไซต์ห้องเรียนโรงเรียนวัดศรีโลหะราษฎร์บำรุง แยกออกจาก GPT Sites ใช้ GitHub เป็นแหล่งโค้ดและ GitHub Pages สำหรับหน้าเว็บ เซิร์ฟเวอร์ Node.js + SQLite ใช้สำหรับข้อมูลร่วมกันหลายเครื่อง

## เปิดหน้าเว็บสาธารณะ

1. เปิด **Settings → Pages → Build and deployment → Source → GitHub Actions** ใน repository นี้ (ทำครั้งเดียวโดยเจ้าของ repository)
2. เปิด Actions → **Test and publish classroom** → Run workflow หากยังไม่มีรอบใหม่
3. เมื่อ deploy ผ่าน เปิด URL ที่ GitHub แสดงในรอบ deploy

URL ตามโครงสร้าง repository คือ `https://nuttapong2.github.io/sl6269/` แต่ถือว่าเผยแพร่สำเร็จเมื่อ Actions และ Pages ยืนยันแล้วเท่านั้น

หากยังไม่มี backend หน้าเว็บเปิด **โหมดทดลอง** พร้อมข้อมูลเลขที่สมมติ บันทึกเฉพาะเครื่อง ห้ามใช้บันทึกเงินฝากจริง รหัสบัญชีจริงจะไม่ถูกตรวจในโหมดนี้

## เชื่อมระบบจริง

- Backend อยู่ใน `server/` ใช้ Node.js 24 และ SQLite โดยไม่ต้องติดตั้ง runtime dependencies
- Deploy บนโฮสต์ที่รัน Node.js และมี persistent disk ได้ อ่าน `server/README.md` และ `render.yaml`
- ตั้ง `ADMIN_USERNAME=krutoey` และตั้ง `ADMIN_PASSWORD` เป็น secret บนโฮสต์ ห้ามใส่รหัสจริงใน GitHub หรือหน้าเว็บ
- ตั้ง `FRONTEND_ORIGIN=https://nuttapong2.github.io` และพื้นที่ข้อมูล `DATA_DIR` บน persistent disk
- ตั้ง repository variable ชื่อ **API_BASE_URL** เป็น URL HTTPS ของ backend แล้วรัน Actions ใหม่ หรือแก้ `config.js` เฉพาะ URL สาธารณะของ API
- Backend สามารถเปิดหน้าเว็บและ API ในโดเมนเดียวกันได้ด้วย จึงใช้ backend URL เป็นเว็บหลักได้เมื่อโฮสต์พร้อม
- เข้าบัญชีครูและนำเข้ารายชื่อ JSON รูปแบบ `[{"id":1,"name":"ชื่อนักเรียน","schoolId":"เลขประจำตัว"}]` ในส่วนครู ข้อมูลนี้ส่งตรงเข้า backend ไม่ commit ลง repository
- บัญชีนักเรียนใช้เลขประจำตัวเป็นทั้งชื่อผู้ใช้และรหัสเริ่มต้น เปลี่ยนรหัสได้ภายหลัง หากไม่มีเลขประจำตัวจะยังเข้าสู่ระบบไม่ได้

## ความสามารถ

- โปรไฟล์รายเลขที่และลิงก์ NFC เช่น `?student=1`
- เช็กชื่อ มา/สาย/ลา/ขาด และเวรประจำวัน
- คะแนนความดีสะสม เหรียญซื้อชุด และเงินฝากแยกยอดกัน
- เพิ่มคะแนนได้เหรียญเท่ากัน หักคะแนนไม่หักเหรียญ ซื้อชุดหักเฉพาะเหรียญ
- ฝาก/ถอนเป็นสตางค์ มีประวัติและป้องกันถอนเกินยอด
- Chibi Pixel Art 12 ชิ้นขึ้นไป ลองชุดฟรีก่อนยืนยันซื้อ ใส่ของที่มีแล้วได้ฟรี
- เข้าระบบครู/นักเรียน เปลี่ยนรหัส รีเซ็ตรหัส จัดการเลขประจำตัว
- ตรวจสิทธิ์ที่ API และปกปิดชื่อจริง/เงินฝากจากผู้ชมทั่วไป

## ตรวจงานในเครื่อง

```sh
node --test server/*.test.mjs tests/*.test.mjs
node scripts/build-pages.mjs
ADMIN_PASSWORD='ตั้งเป็นค่าลับของตนเอง' node server/server.mjs
```

`_site` สร้างจากรายชื่อไฟล์ frontend ที่อนุญาตเท่านั้น ไม่คัดลอก server ฐานข้อมูล รหัสผ่าน หรือรายชื่อจริงเข้า Pages

`src/worker.js`, `drizzle/`, `dist/` และ `.openai/` ที่มีอยู่เดิมเป็นงานรุ่นก่อนย้ายระบบ เก็บไว้เพื่อรักษาประวัติ ไม่ได้ใช้ในขั้นตอน deploy ใหม่

## สิ่งที่ต้องมีภายนอก GitHub

GitHub Pages ไม่รัน API และ SQLite ดังนั้นบัญชีครู การบันทึกข้ามเครื่อง และเงินฝากจริงจะเริ่มใช้งานได้หลังเจ้าของเชื่อมโฮสต์ backend และตั้ง secret เท่านั้น โค้ดนี้ไม่สร้างบริการเสียเงินให้อัตโนมัติ
