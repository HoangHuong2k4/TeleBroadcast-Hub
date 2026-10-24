# Cập nhật Trạng Thái & Vai Trò Hệ Thống (Role Context Update)

Tài liệu này tổng hợp lại các tính năng và logic đã được xây dựng cho dự án **TeleBroadcast Hub**, nhằm làm tư liệu để bạn (hoặc các AI session sau này) nắm bắt được hệ thống đang có những chức năng gì, tránh việc code lại từ đầu hoặc làm hỏng luồng hoạt động cũ.

## 1. Kiến trúc tổng quan
- **Frontend (Client)**: React.js (Vite), sử dụng Tailwind CSS và các icon từ `lucide-react`. Các trang chính: Groups, Templates, Accounts, Scheduler (Lịch), Logs. Giao diện được thiết kế theo phong cách Cyberpunk/Dark mode sang trọng.
- **Backend (Server)**: Node.js (Express), cơ sở dữ liệu **SQLite** (`better-sqlite3`).
- **Telegram Core**: Sử dụng thư viện `gramjs` (MTProto API) chứ không dùng Bot API, cho phép gửi tin nhắn tự động từ tài khoản User Telegram cá nhân (Userbot).

## 2. Các Tính năng Chính đã hoàn thiện

### A. Quản lý Nhóm mục tiêu (Groups)
- Hỗ trợ nhập và lưu trữ 3 dạng định dạng nhóm: 
  - Tên người dùng / username công khai: `@username`
  - Private Invite Link: `https://t.me/+AbCdEfGh` hoặc `t.me/joinchat/...`
  - Topic trong siêu nhóm: `https://t.me/c/1234567890/123` (Hỗ trợ parse ID topic tự động).
- **Auto Join**: Khi truyền một Invite Link chưa từng tham gia, Backend sẽ dùng `CheckChatInvite` và `ImportChatInvite` để tài khoản tự động gia nhập nhóm trước khi gửi tin.
- Bảng nhóm: UI đã xoá `max-w-5xl` để bảng tự mở rộng không bị lỗi giao diện. Tích hợp nút **Gửi Ngay (Run Now)** tại từng hàng.

### B. Quản lý Kịch bản (Templates)
- Trình soạn thảo văn bản hỗ trợ cú pháp Telegram (Bold, Italic, Spoiler, Code...).
- **Tính năng Custom Emoji**: Hỗ trợ dán trực tiếp ID Custom Emoji (ví dụ: `[123456789012345]`). Hệ thống tự động dùng Regex nhận diện chuỗi số này và biến đổi thành thẻ HTML `<tg-emoji emoji-id="123456789012345">⭐</tg-emoji>` trước khi gửi qua `gramjs`.
- Hỗ trợ nhập (Import) hàng loạt kịch bản từ 1 kênh/nhóm mẫu trên Telegram.

### C. Cơ chế Lên Lịch & Gửi Tin (Scheduler)
- Cho phép đặt nhiều khung giờ (VD: 09:00, 14:00, 20:00).
- Sử dụng thư viện `node-cron` để trigger hàm `dispatch()`.
- Có xử lý Rate Limit từ Telegram: tự động bắt lỗi `FLOOD_WAIT_X` và delay quá trình gửi tin theo đúng số giây yêu cầu.
- Gửi tin (Dispatch) nhận diện kịch bản theo mối quan hệ N-N (Group - Template): Nếu nhóm được gán kịch bản riêng, nó sẽ bốc random kịch bản đó. Nếu nhóm không gán kịch bản nào, nó sẽ bốc random từ toàn bộ kịch bản chung.
- Tính năng **Target Dispatch**: Bổ sung Endpoint `/api/scheduler/run-group/:id` cho phép trigger gửi kịch bản ngay cho duy nhất 1 nhóm mục tiêu mà không ảnh hưởng nhóm khác.

### D. Cơ chế Bảo Mật mới (Security)
- Backend `index.js` đã được tích hợp Middleware **HTTP Basic Authentication**. 
- Để kích hoạt, cấu hình `ADMIN_USER` và `ADMIN_PASS` vào file `.env`. Nếu có, mọi request (kể cả xem giao diện React ở production) đều phải nhập mật khẩu bằng prompt của trình duyệt, chống phá hoại từ bên ngoài.

## 3. Quy trình Triển khai (Deployment)
- Dùng `npm run build` trên thư mục `client`.
- Express backend sẽ tự động bắt lấy file từ `client/dist` (thông qua `express.static`) để phục vụ UI.
- Trên môi trường máy chủ (như 1Panel), chỉ cần chạy `npm start` thư mục backend trên cổng `3001` (chỉ định trong `.env` `NODE_ENV=production`) là cả API và UI sẽ được public cùng một lúc.
