# Jane's Weather Forecast Dashboard (03_JaneWeather)

Dự án này thực hiện tự động kết nối với API Jane's Weather của Axisstream, định kỳ thu thập dự báo thời tiết 6 ngày tiếp theo, chuẩn hóa và lưu trữ lịch sử các phiên dự đoán vào cơ sở dữ liệu Supabase, đồng thời trực quan hóa dữ liệu qua bảng điều khiển (Dashboard) ReactJS cao cấp (Trắng - Xanh lá).

---

## 1. Sơ đồ khối hệ thống (System Architecture)

Sơ đồ khối thể hiện sự tương tác giữa dịch vụ Axistream, tiến trình chạy ngầm Go Backend, cơ sở dữ liệu Supabase và giao diện ReactJS người dùng.

```mermaid
graph TD
    subgraph Axisstream Cloud
        API[Axisstream API Endpoint]
    end
    subgraph Go Collector Daemon (Backend)
        Client[API Client - Chrome Simulation] --> Parser[Data Parser & Cleaner]
        Parser --> SQL[Simple Protocol Connection]
    end
    subgraph Supabase Database
        DB[(PostgreSQL Database)]
    end
    subgraph Client UI (ReactJS Frontend)
        React[ReactJS Web App] --> Recharts[Charts & Data Visualizer]
        React --> Exporter[CSV Data Exporter]
    end

    API -->|Raw Weather JSON| Client
    SQL -->|Store normalized records| DB
    DB -->|Query weather runs & predictions| React
```

---

## 2. Luồng dữ liệu phân phối (Data Distribution Flow)

Sơ đồ phân rã dữ liệu thô nhận từ API thành các cấu trúc bảng chuyên biệt trong cơ sở dữ liệu để phục vụ việc phân tích độ lệch chênh lệch.

```mermaid
graph LR
    Raw[Raw JSON Response từ API] -->|Trích xuất trực tiếp| Root[Root / recentData]
    Raw -->|Trích xuất trực tiếp| HourlyList[hourlyData Array]
    Raw -->|Trích xuất trực tiếp| DailyList[dailyData Array]

    Root -->|Lưu thông số thời gian thực| RunTable[(weather_forecast_run)]
    HourlyList -->|Lưu các giờ còn lại trong ngày| HourlyTable[(hourly_forecast)]
    DailyList -->|Lưu tóm tắt ngày nhiệt độ Max/Min| DailyTable[(daily_forecast)]
    DailyList -->|Duyệt đệ quy lấy 24h tương lai| HourlyTable
```

---

## 3. Sơ đồ giải thuật đồng bộ (Sync Algorithm Flow Chart)

Tiến trình xử lý của Go Collector Daemon đảm bảo an toàn kết nối, tự gia hạn Token và ghi dữ liệu toàn vẹn bằng SQL Transaction.

```mermaid
flowchart TD
    Start([Bắt đầu chu kỳ đồng bộ]) --> CheckToken{Kiểm tra Token local?}
    CheckToken -->|Chưa có / Hết hạn| Login[Đăng nhập Axistream API để lấy Token mới]
    Login --> SaveToken[Lưu Token vào configs/token.json]
    SaveToken --> Fetch[Gửi request GET lấy dữ liệu thời tiết]
    CheckToken -->|Còn hạn| Fetch
    
    Fetch --> Parse[Trích xuất dữ liệu thô và làm sạch số liệu]
    Parse --> DBConn{Kết nối Database qua Simple Protocol?}
    DBConn -->|Thất bại| Error([Ghi log lỗi & Kết thúc])
    DBConn -->|Thành công| Tx[Khởi tạo Transaction SQL]
    
    Tx --> SaveRun[Lưu thông tin metadata & recentData vào weather_forecast_run]
    SaveRun --> ExtractHours[Gộp hourlyData ngoài & nested hourlyData trong dailyData]
    ExtractHours --> SaveHourly[Lưu tất cả bản ghi vào bảng hourly_forecast]
    SaveHourly --> SaveDaily[Lưu tóm tắt ngày vào bảng daily_forecast]
    SaveDaily --> Commit{Commit Transaction?}
    
    Commit -->|Thành công| Success([Hoàn tất chu kỳ - Chờ 1 giờ])
    Commit -->|Thất bại| Rollback[Rollback Transaction]
    Rollback --> Error
```

---

## 4. Cấu trúc thư mục (Project Structure)

```
03_JaneWeather/
├── backend/                   # Go Backend Collector Daemon
│   ├── cmd/
│   │   └── collector/
│   │       └── main.go        # Điểm khởi chạy daemon và xử lý CLI flags
│   ├── internal/
│   │   ├── client/
│   │   │   ├── client.go      # HTTP client giả lập Chrome & tự quản lý Token
│   │   │   └── jwt.go         # Trình phân tích JWT nội bộ để kiểm tra hạn sử dụng
│   │   ├── config/
│   │   │   └── config.go      # Đọc và cấu hình biến môi trường từ .env
│   │   ├── db/
│   │   │   └── db.go          # Thiết lập kết nối Simple Protocol & xử lý dữ liệu DB
│   │   └── model/
│   │       └── model.go       # Cấu trúc Struct Go khớp với JSON API Axistream
│   ├── .env                   # [Git Ignored] Chứa cấu hình tài khoản & database nội bộ
│   ├── go.mod                 # Go module descriptor
│   └── go.sum                 # Go dependency checksums
└── frontend/                  # ReactJS Frontend (Vite)
    ├── src/
    │   ├── App.jsx            # Giao diện Dashboard chính (kết nối Supabase)
    │   ├── index.css          # Hệ thống CSS (Giao diện Trắng - Xanh lá)
    │   ├── main.jsx           # Mounting wrapper
    │   └── supabaseClient.js  # Cấu hình kết nối Supabase Client
    ├── index.html             # HTML layout template
    ├── package.json           # npm configuration
    └── vite.config.js         # Cấu hình Vite
```

---

## 5. Cấu hình cơ sở dữ liệu Supabase (PostgreSQL)

Cơ sở dữ liệu được thiết lập trên **AWS Sydney (ap-southeast-2)** kết nối qua cổng **6543** (PgBouncer Pooler).

*   **`weather_forecast_run`**: Lưu giữ metadata các lần cào dữ liệu thành công (`location`, `update_time`, `temperature`, `pressure`, `total_precipitation`, `wind_speed`, `humidity`, `wind_direction_compass`, `wind_direction_angle`, `uv_index`, `uv_level`, `dew_point`, `delta_t`, `fog_probability`, `spray_rating`).
*   **`hourly_forecast`**: Lưu trữ dự báo chi tiết từng giờ. Ràng buộc UNIQUE trên `(update_time, prediction_time)` để phân tích độ dịch chuyển.
*   **`daily_forecast`**: Lưu trữ tóm tắt chung theo ngày. Ràng buộc UNIQUE trên `(update_time, prediction_date)`.

---

## 6. Hướng dẫn vận hành Backend (Go)

Di chuyển vào thư mục `03_JaneWeather/backend`:

### Thiết lập biến môi trường (Environment Variables)
Tạo tệp tin `.env` bên trong thư mục `backend/` theo mẫu an toàn dưới đây:
```env
AXISTREAM_EMAIL=your-email@domain.com
AXISTREAM_PASSWORD=your-password
AXISTREAM_PROJECT_ID=your-project-uuid-from-axistream
AXISTREAM_PROVIDER_ID=your-provider-uuid-from-axistream
SUPABASE_DB_URL=postgresql://postgres.rtemlpaeyjpbktpqqtwv:your-supabase-password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require
```
> [!IMPORTANT]
> Tuyệt đối không commit tệp tin `.env` chứa mật khẩu thật lên GitHub công khai.

### Chạy đồng bộ một lần (One-shot Mode)
```bash
go run ./cmd/collector
```

### Chạy dạng tiến trình ngầm (Daemon Mode)
Mặc định chu kỳ quét dữ liệu là 1 tiếng (khuyên dùng):
```bash
go run ./cmd/collector -daemon
```

Tùy chỉnh khoảng thời gian quét (ví dụ: quét dữ liệu 30 phút một lần):
```bash
go run ./cmd/collector -daemon -interval 30m
```

---

## 7. Hướng dẫn vận hành Frontend (ReactJS)

Di chuyển vào thư mục `03_JaneWeather/frontend`:

### Chạy môi trường nhà phát triển (Development Mode)
```bash
npm run dev
```

### Biên dịch mã nguồn sản xuất (Production Build)
```bash
npm run build
```
Mã nguồn tĩnh sẽ được xuất ra thư mục `dist/`, sẵn sàng được nạp trực tiếp qua Go Web Server.
