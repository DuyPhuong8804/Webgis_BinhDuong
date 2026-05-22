# Hệ Thống WebGIS — Dự án Quản lý Dữ liệu Không Gian (Bình Dương)

Mục tiêu: cung cấp một ứng dụng web nhẹ để trực quan hoá, truy vấn và phân tích dữ liệu không gian (Phường/Xã, Trường học, Đường giao thông, UBND) lưu trong PostgreSQL + PostGIS.

Mục lục
- Giới thiệu
- Yêu cầu & phần mềm
- Cài đặt nhanh
- Cấu hình môi trường
- Thiết lập cơ sở dữ liệu (PostGIS)
- Nạp dữ liệu mẫu
- Chạy ứng dụng
- API & truy vấn mẫu
- GeoServer (tùy chọn)
- Khắc phục lỗi thường gặp
- Cấu trúc dự án
- Góp phần & Bản quyền

Giới thiệu
- Ứng dụng phục vụ tệp tĩnh (frontend) và một server Node (`server.js`) cung cấp API truy vấn và proxy đến GeoServer.
- `server.js` thực thi các truy vấn SQL bằng `psql` để trả về JSON, và cung cấp endpoint proxy cho GeoServer tại `/geoserver/...`.

Yêu cầu & phần mềm
- Node.js (12+ hoặc mới hơn) để chạy `server.js` và phục vụ frontend.
- PostgreSQL (12+) với extension PostGIS.
- Công cụ `psql` (phần của PostgreSQL client) có trong `PATH`, hoặc đặt `PSQL_PATH` trỏ tới `psql.exe` trên Windows.
- GeoServer (tùy chọn) nếu bạn muốn phục vụ WMS/WFS; mặc định `server.js` proxy tới `localhost:8080`.

Cài đặt nhanh
1. Cài Node.js: tải từ trang chính thức hoặc dùng trình quản lý gói (chạy `node -v` để kiểm tra).
2. Cài PostgreSQL + PostGIS:

Trên Windows/macOS/Linux: cài PostgreSQL theo bộ cài chính thức; sau đó cài extension PostGIS (thông thường PostGIS có trong bộ cài hoặc cài riêng).

Cấu hình cơ sở dữ liệu (tạo DB và bật PostGIS)
```bash
# Tạo database (Windows PowerShell / bash)
createdb binhduong_gis
# Kết nối và bật PostGIS
psql -d binhduong_gis -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Nạp dữ liệu mẫu
- Nếu bạn có file SQL/định nghĩa bảng (ví dụ `truyvan.sql` trong dự án), nạp bằng:

```bash
psql -d binhduong_gis -f truyvan.sql
```

- Đối với shapefile/SHP/GeoPackage, dùng `shp2pgsql` hoặc `ogr2ogr`:

```bash
# Ví dụ shp2pgsql (tạo bảng và nạp dữ liệu)
shp2pgsql -I -s 4326 path/to/shapefile.shp public."Dia_gioi_hanh_chinh_Binh_Duong" | psql -d binhduong_gis

# Hoặc dùng ogr2ogr
ogr2ogr -f PostgreSQL PG:"host=localhost user=postgres dbname=binhduong_gis password=yourpass" path/to/file.shp -nln "Dia_gioi_hanh_chinh_Binh_Duong" -lco GEOMETRY_NAME=geom -nlt MULTIPOLYGON -a_srs EPSG:4326
```

Cấu hình môi trường (biến môi trường)
- Biến môi trường có thể dùng để điều chỉnh kết nối Postgres và psql path:
	- `PGDATABASE` hoặc `DB_NAME` (mặc định: `binhduong_gis`)
	- `PGUSER` (mặc định: `postgres`)
	- `PGPASSWORD` (mặc định: `1` trong repo này — KHÔNG DÙNG mật khẩu yếu trong môi trường thực)
	- `PGHOST` (mặc định: `localhost`)
	- `PGPORT` (mặc định: `5432`)
	- `PSQL_PATH` (đường dẫn tới `psql` nếu không có trong `PATH`)
	- `PGCONNECT_TIMEOUT` (mặc định: `5`)

Trên Windows PowerShell:
```powershell
$env:PGUSER = "postgres"
$env:PGPASSWORD = "1"
$env:PGDATABASE = "binhduong_gis"
node server.js
```

Trên bash (Linux/macOS / Git Bash trên Windows):
```bash
export PGUSER=postgres
export PGPASSWORD=1
export PGDATABASE=binhduong_gis
node server.js
```

Chạy ứng dụng
- Khởi động server Node:
```bash
node server.js
# Mặc định server lắng nghe trên http://localhost:3000
```
- Hoặc mở `index.html` trực tiếp khi không cần API truy vấn.

API & Truy vấn mẫu
- `server.js` cung cấp các endpoint truy vấn JSON tại `/api/query/:id` với `id` từ `q1` đến `q5`.
- Mô tả ngắn các truy vấn (xem `server.js` để chi tiết SQL):
	- `q1`: Trả dữ liệu phường (Phường/Phường xã) với geometry (GeoJSON).
	- `q2`: Truy các trường học nằm trong một phường cụ thể (ví dụ: Phường Dĩ An).
	- `q3`: Lấy các đoạn đường trong bán kính ~500m từ một trường học mẫu.
	- `q4`: Tìm UBND gần nhất và khoảng cách tới trường học mẫu.
	- `q5`: Thống kê số trường học theo phường.

Ví dụ gọi API bằng curl:
```bash
curl "http://localhost:3000/api/query/q1"
curl "http://localhost:3000/api/query/q2"
```

Phản hồi mẫu:
```json
{
	"ok": true,
	"queryId": "q1",
	"rows": [ ... ]
}
```

GeoServer (tùy chọn)
- Nếu bạn dùng GeoServer để phục vụ WMS/WFS, chạy GeoServer trên `localhost:8080` hoặc chỉnh `GEO_SERVER_HOST`/`GEO_SERVER_PORT` trong `server.js`.
- `server.js` proxy các yêu cầu bắt đầu bằng `/geoserver/` tới GeoServer. Ví dụ truy cập: `http://localhost:3000/geoserver/geoserver/wms?...`.

Khắc phục lỗi thường gặp
- Lỗi `psql` không tìm thấy hoặc quyền truy cập bị từ chối:
	- Kiểm tra `psql` có trong `PATH` hoặc đặt `PSQL_PATH` trỏ tới `psql.exe`.
	- Kiểm tra biến `PGUSER`/`PGPASSWORD`/`PGHOST`/`PGPORT`.
	- Thử câu lệnh kiểm tra:
```bash
psql -h localhost -U postgres -d binhduong_gis -c "SELECT version();"
```
- Lỗi JSON parse khi chạy `server.js`:
	- Đảm bảo truy vấn SQL trả về JSON hợp lệ; `server.js` kỳ vọng `psql` trả một payload JSON text.
	- Kiểm tra `truyvan.sql` hoặc bảng dữ liệu có geometry bị NULL/hư hỏng; có thể cần `ST_MakeValid`.
- Vấn đề CORS/Proxy với GeoServer:
	- Sử dụng proxy của `server.js` hoặc bật CORS trên GeoServer.

Cấu trúc dự án (tệp chính)
- `index.html` — giao diện chính.
- `main.js`, `layer.js`, `popup.js` — logic frontend và tích hợp bản đồ.
- `style.css` — các kiểu giao diện.
- `server.js` — server Node.js cung cấp tệp tĩnh, proxy GeoServer, và endpoint `/api/query/:id`.
- `truyvan.sql` — (nếu có) chứa truy vấn/định nghĩa bảng hoặc mẫu dữ liệu.
- `Dia_gioi_hanh_chinh_Binh_Duong_colored.sld` — style cho GeoServer.

Ghi chú bảo mật
- Không lưu mật khẩu thật lên repository. Sử dụng biến môi trường hoặc file cấu hình ngoài `.gitignore`.
