# Discord AutoVoice Bot cho người Việt Nam

Công cụ Discord self-bot mạnh mẽ cho phép quản lý nhiều kết nối voice Discord cùng lúc.

![Discord AutoVoice](https://img.shields.io/badge/Discord-AutoVoice-5865F2)
![Phiên bản](https://img.shields.io/badge/Phi%C3%AAn%20b%E1%BA%A3n-1.0.0-brightgreen)

## 📖 Tổng quan

Discord AutoVoice là một self-bot đa tính năng cho phép bạn kết nối nhiều tài khoản Discord đến các kênh voice cùng một lúc. Nó cung cấp cách quản lý và duy trì các kết nối này một cách liền mạch với các tính năng bảo mật mạnh mẽ và tối ưu hóa tài nguyên.

## ⚠️ Khuyến cáo

**Self-bot** về mặt kỹ thuật là vi phạm Điều khoản Dịch vụ của Discord. Công cụ này được thiết kế chỉ với mục đích học tập. Sử dụng với sự chấp nhận rủi ro của riêng bạn.

## ✨ Tính năng

### Tính năng cốt lõi

- **Quản lý đa tài khoản**: Kết nối và quản lý nhiều tài khoản Discord cùng lúc
- **Tích hợp kênh voice**: Tham gia các kênh voice cụ thể với cài đặt voice tùy chỉnh
- **Phân nhóm tài khoản**: Sắp xếp tài khoản thành các nhóm để quản lý tốt hơn
- **Tự động kết nối lại**: Kết nối lại thông minh với chiến lược tăng thời gian chờ theo cấp số nhân nếu bị ngắt kết nối
- **Giám sát trạng thái**: Hiển thị trạng thái theo thời gian thực của tất cả tài khoản đã kết nối

### Tính năng bảo mật

- **Mã hóa token**: Mã hóa AES-256 cho token Discord của bạn
- **Phát hiện hoạt động đáng ngờ**: Giám sát và cảnh báo về các nỗ lực đăng nhập đáng ngờ
- **Phát hiện thay đổi IP**: Phát hiện và ghi lại khi tài khoản được truy cập từ các IP khác nhau
- **Ghi nhật ký bảo mật**: Ghi lại sự kiện bảo mật một cách toàn diện

### Tối ưu hóa hiệu suất

- **Giám sát bộ nhớ**: Tự động phát hiện và tối ưu hóa khi sử dụng bộ nhớ cao
- **Chế độ tài nguyên thấp**: Giảm sử dụng bộ nhớ khi tài nguyên hệ thống bị hạn chế
- **Kiểm tra trạng thái API Discord**: Xác minh khả năng sử dụng API Discord trước khi thử kết nối

## 🚀 Bắt đầu

### Cài đặt

1. Clone repository:
```bash
git clone https://github.com/yourusername/discord-autovoice.git
cd discord-autovoice
```

2. Cài đặt các gói phụ thuộc:
```bash
npm install
```

3. Biên dịch và chạy ứng dụng:
```bash
npm run dev
```

### Cách sử dụng

Sau khi khởi động ứng dụng, bạn sẽ thấy menu với các tùy chọn sau:

1. **Kết nối tất cả tài khoản**: Kết nối tất cả tài khoản đã cấu hình
2. **Kết nối một tài khoản**: Kết nối một tài khoản cụ thể
3. **Thêm tài khoản**: Thêm tài khoản Discord mới
4. **Chỉnh sửa tài khoản**: Sửa đổi tài khoản hiện có
5. **Xóa tài khoản**: Xóa một tài khoản
6. **Ngắt kết nối tất cả**: Ngắt kết nối tất cả tài khoản
7. **Giám sát trạng thái**: Xem trạng thái của tất cả tài khoản đã kết nối
8. **Lên lịch tài khoản**: Thiết lập lịch trình kết nối
9. **Quản lý nhóm**: Tạo và quản lý nhóm tài khoản
10. **Cài đặt bảo mật**: Cấu hình tùy chọn bảo mật
11. **Thoát**: Thoát ứng dụng

### Thêm tài khoản

Khi thêm tài khoản mới:

1. Nhập tên cho tài khoản
2. Cung cấp token Discord
3. Chọn máy chủ Discord (guild) từ danh sách
4. Chọn kênh voice để kết nối
5. Cấu hình cài đặt voice (tắt mic, tắt loa, video)
6. Tùy chọn gán tài khoản vào một nhóm

## 📋 Cấu hình

Tất cả cấu hình được lưu trữ trong tệp cấu hình nằm tại `~/.discord-autovoice/config.json`. Tệp này chứa:

- Thông tin tài khoản
- Cấu hình nhóm
- Cài đặt bảo mật

Ứng dụng tự động xử lý việc mã hóa dữ liệu nhạy cảm.

## 🔒 Giải thích tính năng bảo mật

### Mã hóa token

Token được mã hóa bằng AES-256-CBC với khóa được tạo từ các định danh duy nhất của máy tính của bạn, đảm bảo rằng ngay cả khi tệp cấu hình của bạn bị sao chép, token không thể bị giải mã dễ dàng trên hệ thống khác.

### Phát hiện hoạt động đáng ngờ

Hệ thống giám sát:
- Nhiều lần đăng nhập trong thời gian ngắn
- Thay đổi địa chỉ IP
- Lỗi kết nối

### Nhật ký bảo mật

Nhật ký bảo mật chi tiết được lưu trữ tại `~/.discord-autovoice/security.log` để kiểm tra và khắc phục sự cố.

## 🛠️ Tính năng nâng cao

### Tùy chỉnh cài đặt voice

Đối với mỗi tài khoản, bạn có thể cấu hình:
- Tự tắt mic: Tự động tắt micrô của bạn
- Tự tắt loa: Tự động tắt loa của bạn
- Video: Bật hoặc tắt camera

### Tối ưu hóa tài nguyên

Ứng dụng tự động giám sát việc sử dụng bộ nhớ và sẽ chuyển sang chế độ tài nguyên thấp khi cần thiết, bao gồm:
- Giảm kích thước bộ nhớ đệm
- Giảm thiểu yêu cầu API Discord
- Tối ưu hóa mẫu sử dụng bộ nhớ

### Hệ thống tự động kết nối lại

Khi bị ngắt kết nối, hệ thống sẽ:
1. Thử kết nối lại ngay lập tức
2. Sử dụng thời gian chờ tăng dần cho các lần thử tiếp theo (5 giây, 10 giây, 20 giây, v.v.)
3. Giới hạn tối đa 5 lần thử kết nối lại
4. Xác minh trạng thái API Discord trước khi thử kết nối lại

## 📝 Giấy phép

Dự án này được cấp phép theo Giấy phép ISC - xem tệp LICENSE để biết chi tiết.

## 🤝 Đóng góp

Đóng góp, báo cáo vấn đề và yêu cầu tính năng đều được chào đón! Hãy kiểm tra trang issues.

## 📞 Liên hệ

Đối với câu hỏi hoặc hỗ trợ, vui lòng mở issue trên repository GitHub.

---

Tạo với ❤️ bởi Hanh & discord.js-selfbot-v13