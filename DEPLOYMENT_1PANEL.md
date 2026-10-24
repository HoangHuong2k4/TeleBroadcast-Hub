# Hướng dẫn Deploy TeleBroadcast Hub lên 1Panel và Bảo mật bằng Admin

Tài liệu này hướng dẫn bạn cách đưa ứng dụng TeleBroadcast Hub lên máy chủ ảo (VPS) quản lý bằng **1Panel** và kích hoạt tính năng **Tài khoản Admin** để bảo vệ giao diện của bạn, không cho người ngoài tùy tiện sử dụng bot gửi tin của bạn.

## 1. Cơ chế Bảo mật (Basic Authentication)

Tôi đã code sẵn một cơ chế bảo mật (HTTP Basic Auth) trực tiếp vào máy chủ (Backend).
Khi truy cập trang web, trình duyệt sẽ hiện ra một popup yêu cầu nhập **Tài khoản** và **Mật khẩu**. Nếu nhập sai, người đó sẽ thấy màn hình trắng báo `Authentication required.` và hoàn toàn không thể sử dụng hay phá hoại app của bạn.

**Để bật tính năng này, bạn chỉ cần sửa file `.env` ở thư mục gốc (hoặc khai báo biến môi trường trên 1Panel):**

Mở file `server/.env` và thêm 2 dòng sau:
```env
ADMIN_USER=admin_cuaban
ADMIN_PASS=matkhau_sieu_kho_123
```
*Lưu ý: Nếu bạn xóa 2 dòng này đi (hoặc để trống), ứng dụng sẽ tắt bảo mật và cho phép truy cập tự do như cũ (chỉ dùng khi phát triển).*

## 2. Các bước Deploy trên 1Panel (Bằng App Node.js)

1Panel là một Panel quản lý Docker rất mạnh. Cách tốt nhất để chạy ứng dụng của chúng ta là sử dụng **Node.js Environment** của 1Panel.

### Bước 2.1: Chuẩn bị Source Code

Đầu tiên, bạn cần đóng gói giao diện React (Client) thành file tĩnh. 
Trên máy tính hiện tại, hãy chạy các lệnh sau:

```bash
cd client
npm install
npm run build
```

Sau khi build xong, thư mục `client/dist/` sẽ được tạo ra chứa giao diện đã đóng gói.

### Bước 2.2: Tải code lên 1Panel

1. Truy cập vào **1Panel Dashboard** của bạn.
2. Vào phần **Hosts > Files** (hoặc Websites > Files).
3. Tạo một thư mục mới cho ứng dụng (Ví dụ: `/opt/1panel/apps/telebroadcast`).
4. Tải toàn bộ thư mục gốc của dự án này lên đó.
   *(**Lưu ý quan trọng**: Phải đảm bảo thư mục `client/dist` đã được tải lên thành công, vì trong môi trường Production, Backend sẽ tự động lấy code từ `client/dist` ra hiển thị)*.

### Bước 2.3: Tạo môi trường Node.js trên 1Panel

1. Vào mục **Websites** (Trang web) > Chọn tab **Runtime Environments** (Môi trường chạy).
2. Chọn **Node.js** và nhấn nút **Create** (Tạo website bằng Node.js).
3. Điền các thông tin sau:
   - **Name / Domain**: Điền Domain hoặc IP của bạn (ví dụ: `telebot.domain.com` hoặc `IP_VPS`).
   - **App Directory / Path**: Trỏ tới thư mục `/opt/1panel/apps/telebroadcast/server` (thư mục chứa backend).
   - **Run Command / Script**: Gõ lệnh `npm install && npm start` hoặc cấu hình script start là `start`.
   - **Node.js Version**: Chọn phiên bản Node.js 18 hoặc 20.
   - **Port**: `3001` (Port mặc định của Backend).
4. Ở phần **Environment Variables** (Biến môi trường), thêm các biến sau:
   ```env
   NODE_ENV=production
   PORT=3001
   ADMIN_USER=admin
   ADMIN_PASS=nhap_mat_khau_vao_day
   ```
5. Bấm **Confirm (Xác nhận)** để 1Panel tự động kéo image Node.js về và khởi chạy server.

### Bước 2.4: Kiểm tra thành quả

- Bây giờ, hãy gõ Domain/IP của bạn vào trình duyệt. 
- Ngay lập tức, trình duyệt sẽ bật ra khung đăng nhập 🔒.
- Nhập `ADMIN_USER` và `ADMIN_PASS` bạn đã thiết lập ở trên.
- Bạn sẽ thấy giao diện React hiện ra với đầy đủ các tính năng.

### Bước 2.5: Cấu hình Reverse Proxy (Nginx) - Tuỳ chọn

Nếu bạn điền Domain ở Bước 2.3, 1Panel thường đã tự động tạo một luật Nginx Reverse Proxy trỏ Domain của bạn vào Port `3001`. 
Nếu bạn muốn dùng HTTPS (SSL), hãy vào **Websites > Certificates**, xin chứng chỉ Let's Encrypt cho Domain đó, sau đó vào phần cài đặt trang web bật HTTPS lên là xong!

---

💡 **Tóm tắt quy trình chạy trên Production:**
Trong môi trường `NODE_ENV=production`, bạn **không cần** chạy lệnh `npm run dev` ở thư mục `client`. Server Node.js ở thư mục `server` sẽ vừa làm nhiệm vụ xử lý API, vừa làm nhiệm vụ trả về file HTML/JS của giao diện (nhờ đoạn mã `app.use(express.static(clientBuild))` đã được tôi viết sẵn trong `index.js`). Vì vậy, chỉ cần chạy duy nhất thư mục `server` là cả app sẽ hoạt động!
