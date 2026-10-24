# 📡 TeleBroadcast Hub

> **Ứng dụng web automation** để quản lý, lên lịch và tự động gửi tin nhắn tiếp thị vào các nhóm Telegram bằng tài khoản cá nhân (Userbot).

![Stack](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=flat-square)
![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Database-SQLite-orange?style=flat-square)
![Stack](https://img.shields.io/badge/Telegram-GramJS-2CA5E0?style=flat-square)

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|-----------|-------|
| 🔐 **Xác thực Userbot** | Đăng nhập bằng OTP + 2FA, lưu session vĩnh viễn |
| 👥 **Quản lý nhóm** | Thêm đơn lẻ hoặc nhập hàng loạt, bật/tắt từng nhóm |
| 📝 **Kịch bản Spintax** | Soạn nội dung với biến thể ngẫu nhiên, đính kèm ảnh |
| ⏰ **Lịch tự động** | Đặt nhiều khung giờ cố định, tự động gửi mỗi ngày |
| 🤖 **Giả lập người thật** | Shuffle thứ tự nhóm + random delay 35–65s |
| 🛡️ **An toàn** | Tự xử lý FloodWait, không sập khi nhóm bị lỗi |
| 📊 **Nhật ký & Báo cáo** | Log realtime, thống kê 7 ngày, tỷ lệ thành công |

---

## 🗂️ Cấu trúc dự án

```
TeleBroadcast-Hub/
│
├── 📁 server/                        # Backend Node.js + Express
│   ├── src/
│   │   ├── index.js                  # Entry point — khởi động server
│   │   ├── db/
│   │   │   └── database.js           # Khởi tạo schema SQLite
│   │   ├── routes/
│   │   │   ├── accounts.js           # POST /send-otp, /verify-otp, DELETE
│   │   │   ├── groups.js             # CRUD + bulk import + toggle
│   │   │   ├── templates.js          # CRUD + upload ảnh + preview spintax
│   │   │   ├── scheduler.js          # Cấu hình khung giờ + run-now + stop
│   │   │   ├── logs.js               # Nhật ký gửi tin (paginated)
│   │   │   └── stats.js              # Thống kê dashboard
│   │   └── services/
│   │       ├── telegramClient.js     # GramJS: login, session, sendMessage
│   │       └── scheduler.js          # node-cron + dispatch engine
│   ├── data/                         # SQLite database (tự tạo)
│   ├── uploads/                      # Ảnh banner đính kèm
│   └── package.json
│
├── 📁 client/                        # Frontend React + Vite + Tailwind
│   ├── src/
│   │   ├── main.jsx                  # Entry point React
│   │   ├── App.jsx                   # Layout sidebar + React Router
│   │   ├── index.css                 # Tailwind directives + custom classes
│   │   ├── utils/api.js              # Axios instance với interceptor
│   │   └── pages/
│   │       ├── Dashboard.jsx         # Tổng quan, stat cards, chart 7 ngày
│   │       ├── Accounts.jsx          # Luồng đăng nhập OTP 3 bước
│   │       ├── Groups.jsx            # Bảng nhóm, tìm kiếm, multi-select
│   │       ├── Templates.jsx         # Card kịch bản, spintax preview
│   │       ├── Scheduler.jsx         # Khung giờ, cài đặt delay, run-now
│   │       └── Logs.jsx              # Bảng log, filter, pagination
│   ├── index.html
│   ├── vite.config.js                # Proxy /api → localhost:3001
│   ├── tailwind.config.js
│   └── package.json
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Cài đặt & Khởi động

### ① Yêu cầu hệ thống

- **Node.js** ≥ 18.x → kiểm tra: `node -v`
- **npm** ≥ 9.x → kiểm tra: `npm -v`
- Tài khoản Telegram có số điện thoại thật

---

### ② Lấy Telegram API credentials

> Bắt buộc phải có trước khi chạy ứng dụng.

1. Mở trình duyệt, vào **[https://my.telegram.org](https://my.telegram.org)**
2. Nhập số điện thoại Telegram của bạn → nhập OTP xác nhận
3. Vào mục **"API development tools"**
4. Nhấn **"Create new application"**, điền form:

   | Trường | Gợi ý điền |
   |--------|-----------|
   | App title | `TeleBroadcast Hub` |
   | Short name | `telebroadcast` (5–32 ký tự) |
   | Platform | **Desktop** hoặc **Web** |
   | URL, Description | Để trống |

5. Nhấn **"Create application"** → lưu lại:
   - `api_id` → số nguyên (VD: `12345678`)
   - `api_hash` → chuỗi hex (VD: `a1b2c3d4e5f6...`)

> ⚠️ Không chia sẻ `api_hash` cho bất kỳ ai.

---

### ③ Clone & Cài đặt

```bash
# Clone hoặc giải nén dự án
cd TeleBroadcast-Hub

# Cài đặt dependencies cho Server
cd server && npm install

# Cài đặt dependencies cho Client
cd ../client && npm install
```

> 💡 Lần đầu cài có thể mất 2–5 phút do `better-sqlite3` cần biên dịch native code và `telegram` (GramJS) có kích thước lớn.

---

### ④ Cấu hình môi trường (tùy chọn)

Mặc định ứng dụng chạy được ngay không cần cấu hình. Nếu muốn thay đổi port hoặc đường dẫn:

```bash
# Tạo file .env từ template
cp .env.example server/.env
```

Chỉnh sửa `server/.env`:

```env
PORT=3001               # Port của backend API
NODE_ENV=development
DB_PATH=./data/telebroadcast.db   # Đường dẫn SQLite
UPLOADS_DIR=./uploads             # Thư mục lưu ảnh
```

---

### ⑤ Chạy Development (2 terminal)

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# ✅ Server API: http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# ✅ Web UI: http://localhost:5173
```

Mở trình duyệt: **http://localhost:5173** 🎉

---

### ⑥ Build Production (1 server phục vụ tất cả)

```bash
# 1. Build React thành static files
cd client && npm run build

# 2. Chạy server production (phục vụ cả API + UI)
cd ../server
NODE_ENV=production npm start
# ✅ Truy cập: http://localhost:3001
```

---

## 📖 Hướng dẫn sử dụng từng bước

### Bước 1 — Thêm tài khoản Telegram

1. Vào menu **"Tài khoản"** → nhấn **"Thêm tài khoản"**
2. Nhập **Số điện thoại** (định dạng quốc tế: `+84901234567`)
3. Nhập **API ID** và **API Hash** vừa lấy từ my.telegram.org
4. Nhấn **"Gửi OTP"** → kiểm tra ứng dụng Telegram trên điện thoại/máy tính
5. Nhập **mã OTP** nhận được (5–6 số)
6. Nếu tài khoản có **2FA**: nhập thêm mật khẩu xác thực 2 bước
7. ✅ Đăng nhập thành công! Session được lưu vĩnh viễn vào SQLite

> 🔄 Khi restart server, tài khoản sẽ tự kết nối lại — không cần đăng nhập lại.

---

### Bước 2 — Thêm nhóm mục tiêu

Vào menu **"Nhóm mục tiêu"**:

**Thêm đơn lẻ:**
```
Nhập: @ten_nhom  hoặc  t.me/ten_nhom  hoặc  https://t.me/ten_nhom
```

**Nhập hàng loạt** (nút "Nhập hàng loạt"):
```
@nhom_kinh_doanh_1
@nhom_buon_ban_ha_noi
t.me/cong_dong_mua_ban
https://t.me/nhom_thi_truong
```
Mỗi dòng 1 nhóm — hệ thống tự chuẩn hóa định dạng.

**Toggle bật/tắt:** Click vào nút toggle ở cột "Trạng thái" để tạm dừng gửi cho nhóm cụ thể mà không cần xóa.

---

### Bước 3 — Soạn kịch bản tin nhắn

Vào menu **"Kịch bản"** → nhấn **"Tạo kịch bản"**:

**Cú pháp Spintax:**
```
{Chào|Hello|Xin chào} mọi người! 👋

Bên mình {đang có|hiện cung cấp|ra mắt} sản phẩm {hot|xịn xò|chất lượng}:

✅ Sản phẩm A – {giá tốt|ưu đãi khủng}
✅ Sản phẩm B – {hàng có sẵn|giao ngay hôm nay}

📞 Liên hệ: @ten_cua_ban
```

Mỗi lần gửi, hệ thống chọn ngẫu nhiên 1 biến thể trong `{}` → tạo ra tin nhắn khác nhau cho từng nhóm.

Nhấn **"Xem trước Spintax"** để xem 5 biến thể ngẫu nhiên trước khi lưu.

**Đính kèm ảnh:** Upload banner/ảnh sản phẩm → sẽ gửi kèm caption là nội dung kịch bản.

---

### Bước 4 — Cài đặt lịch gửi

Vào menu **"Lịch gửi tin"**:

**Khung giờ mặc định:** `09:00` · `14:00` · `20:00`

Có thể thêm/xóa/bật-tắt từng khung giờ tùy ý.

**Cài đặt hành vi:**

| Thông số | Mặc định | Mô tả |
|----------|----------|-------|
| Delay tối thiểu | 35 giây | Thời gian nghỉ tối thiểu giữa 2 nhóm |
| Delay tối đa | 65 giây | Thời gian nghỉ tối đa (random trong khoảng) |
| Shuffle nhóm | Bật | Đảo ngẫu nhiên thứ tự nhóm trước mỗi đợt gửi |

**Gửi thủ công:** Nhấn **"Gửi thủ công ngay"** để test 1 lượt mà không cần chờ đến giờ.

---

### Bước 5 — Theo dõi & Báo cáo

**Dashboard:**
- Tổng nhóm đang active
- Số tin đã gửi hôm nay
- Tỷ lệ thành công tổng thể
- Biểu đồ 7 ngày gần nhất
- Khung giờ sắp tới trong ngày

**Nhật ký hoạt động:**
- Log chi tiết mỗi lần gửi: thời gian, nhóm, trạng thái, lỗi
- Bộ lọc theo: trạng thái / tên nhóm / ngày cụ thể
- Tự động refresh mỗi 8 giây
- Phân trang 50 bản ghi/trang

---

## 🛡️ Khuyến nghị an toàn

> Sử dụng đúng cách để tránh bị Telegram hạn chế tài khoản.

```
✅ Delay tối thiểu ≥ 35 giây giữa mỗi nhóm
✅ Không gửi quá 3 lần/ngày cho cùng 1 nhóm
✅ Số lượng nhóm mỗi đợt: lý tưởng < 50 nhóm
✅ Nội dung tin nhắn nên đa dạng (dùng Spintax tốt)
✅ Chỉ gửi vào nhóm bạn có quyền đăng bài
❌ Không gửi nội dung spam, lừa đảo, vi phạm ToS Telegram
```

**Khi bị FloodWait:**
- Hệ thống tự động phát hiện và tạm dừng
- Đợi hết thời gian → tự động tiếp tục
- Trạng thái hiển thị ngay trên màn hình Tài khoản

---

## 🔌 API Reference

### Accounts

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| `GET` | `/api/accounts` | — | Danh sách tài khoản + trạng thái |
| `POST` | `/api/accounts/send-otp` | `{phone, api_id, api_hash}` | Gửi OTP về Telegram |
| `POST` | `/api/accounts/verify-otp` | `{phone, code, password?}` | Xác thực OTP / 2FA |
| `POST` | `/api/accounts/:id/disconnect` | — | Ngắt kết nối |
| `DELETE` | `/api/accounts/:id` | — | Xóa tài khoản |

### Groups

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| `GET` | `/api/groups` | — | Danh sách nhóm |
| `POST` | `/api/groups` | `{identifier}` hoặc `{bulk}` | Thêm 1 hoặc nhiều nhóm |
| `PUT` | `/api/groups/:id` | `{title, is_active}` | Cập nhật nhóm |
| `PATCH` | `/api/groups/:id/toggle` | — | Bật/Tắt nhóm |
| `DELETE` | `/api/groups/:id` | — | Xóa nhóm |
| `DELETE` | `/api/groups` | `{ids: []}` | Xóa nhiều nhóm |

### Templates

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| `GET` | `/api/templates` | — | Danh sách kịch bản |
| `POST` | `/api/templates` | FormData `{name, content, image?}` | Tạo kịch bản |
| `PUT` | `/api/templates/:id` | FormData | Cập nhật kịch bản |
| `DELETE` | `/api/templates/:id` | — | Xóa kịch bản |
| `POST` | `/api/templates/preview-spintax` | `{content}` | Xem 5 biến thể Spintax |

### Scheduler

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| `GET` | `/api/scheduler/config` | — | Lấy cấu hình lịch & settings |
| `POST` | `/api/scheduler/config/slots` | `{time_slot: "HH:MM"}` | Thêm khung giờ |
| `PATCH` | `/api/scheduler/config/slots/:id/toggle` | — | Bật/Tắt khung giờ |
| `DELETE` | `/api/scheduler/config/slots/:id` | — | Xóa khung giờ |
| `PUT` | `/api/scheduler/config/settings` | `{delay_min, delay_max, shuffle_groups}` | Lưu cài đặt |
| `POST` | `/api/scheduler/run-now` | — | Gửi thủ công ngay lập tức |
| `POST` | `/api/scheduler/stop` | — | Dừng dispatcher đang chạy |
| `GET` | `/api/scheduler/status` | — | Trạng thái dispatcher realtime |

### Logs & Stats

| Method | Endpoint | Query | Mô tả |
|--------|----------|-------|-------|
| `GET` | `/api/logs` | `page, limit, status, group, date` | Nhật ký có phân trang |
| `DELETE` | `/api/logs` | — | Xóa toàn bộ nhật ký |
| `GET` | `/api/stats` | — | Thống kê tổng quan dashboard |

---

## 🗄️ Database Schema

```sql
accounts       -- Tài khoản Telegram (phone, api_id, api_hash, session_string, status)
groups         -- Nhóm mục tiêu (identifier, title, is_active, last_sent_at)
templates      -- Kịch bản tin nhắn (name, content, image_path, is_active)
schedule_config -- Khung giờ gửi (time_slot, is_active)
send_logs      -- Nhật ký gửi tin (group, template, status, error_message, sent_at)
settings       -- Cài đặt chung (delay_min, delay_max, shuffle_groups)
```

---

## 📦 Tech Stack

### Backend
| Package | Phiên bản | Mục đích |
|---------|-----------|----------|
| `express` | ^4.19 | HTTP server & routing |
| `better-sqlite3` | ^9.4 | SQLite database (sync, nhanh) |
| `telegram` (GramJS) | ^2.26 | Telegram MTProto Userbot |
| `node-cron` | ^3.0 | Lên lịch cron jobs |
| `melanke-spintax` | ^1.0 | Engine xử lý Spintax |
| `express-fileupload` | ^1.5 | Upload file ảnh |
| `dotenv` | ^16.4 | Biến môi trường |
| `nodemon` | ^3.1 | Hot-reload development |

### Frontend
| Package | Phiên bản | Mục đích |
|---------|-----------|----------|
| `react` + `react-dom` | ^18.3 | UI framework |
| `vite` | ^5.3 | Build tool & dev server |
| `tailwindcss` | ^3.4 | Utility-first CSS |
| `lucide-react` | ^0.395 | Icon library |
| `axios` | ^1.7 | HTTP client |
| `react-router-dom` | ^6.24 | Client-side routing |
| `react-hot-toast` | ^2.4 | Toast notifications |

---

## ❓ Câu hỏi thường gặp

**Q: Tôi có thể dùng nhiều tài khoản Telegram không?**
> Hiện tại hệ thống hỗ trợ lưu nhiều tài khoản nhưng dispatcher dùng 1 tài khoản `connected` đầu tiên tìm thấy. Tính năng multi-account rotation có thể mở rộng sau.

**Q: Session có bị mất khi tắt server không?**
> Không. Session được lưu dưới dạng `StringSession` trong SQLite. Khi khởi động lại, server tự kết nối lại tất cả tài khoản có session.

**Q: Ứng dụng có gửi được vào channel không?**
> Có thể, nhưng tài khoản cần là **admin** của channel đó. Với channel công khai, tài khoản cần có quyền gửi bài.

**Q: Bị FloodWait thì làm gì?**
> Không cần làm gì — hệ thống tự động phát hiện, tạm dừng, và tiếp tục khi hết thời gian chờ. Trạng thái hiển thị trực tiếp trên UI.

**Q: Spintax hỗ trợ lồng nhau không?**
> Có! Ví dụ: `{Chào {bạn|anh chị}|Hello {everyone|all}}` hoàn toàn hợp lệ.
