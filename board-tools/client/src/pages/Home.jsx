import { Link } from "react-router-dom";
import { useTheme } from "../lib/useTheme.js";

export default function Home() {
  const toggleTheme = useTheme();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 20px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 40 }}>
        <div>
          <div className="eyebrow">Dự án nhóm</div>
          <h1 className="display" style={{ fontSize: "clamp(28px, 6vw, 40px)", margin: "6px 0 10px", lineHeight: 1 }}>
            Xưởng Game Của Tôi
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: 14, maxWidth: "48ch", margin: 0 }}>
            Hai công cụ nhẹ để quản lý ý tưởng và thử cân bằng số liệu trước khi bắt tay code thật. Dữ liệu dùng chung cho cả nhóm.
          </p>
        </div>
        <button className="btn ghost icon" onClick={toggleTheme} title="Đổi giao diện sáng/tối">◐</button>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <Link
          to="/idea-map"
          style={{
            display: "block", textDecoration: "none", color: "var(--ink)",
            background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
            padding: "18px 20px", boxShadow: "var(--shadow)"
          }}
        >
          <div style={{ fontSize: 22 }}>🗺️</div>
          <h2 className="display" style={{ fontSize: 16, margin: "8px 0 6px", letterSpacing: "0.02em" }}>Bản đồ ý tưởng</h2>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: 0, lineHeight: 1.5 }}>
            Sơ đồ tư duy tự do: kéo-thả, nối quan hệ, gắn nhãn/trạng thái, lọc và tìm kiếm — quản lý mọi ý tưởng liên quan đến game.
          </p>
        </Link>
        <Link
          to="/calculator"
          style={{
            display: "block", textDecoration: "none", color: "var(--ink)",
            background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
            padding: "18px 20px", boxShadow: "var(--shadow)"
          }}
        >
          <div style={{ fontSize: 22 }}>🛡️</div>
          <h2 className="display" style={{ fontSize: 16, margin: "8px 0 6px", letterSpacing: "0.02em" }}>Bàn tính đối đầu</h2>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", margin: 0, lineHeight: 1.5 }}>
            Chia ngân sách điểm vào Máu / Giáp / Xuyên giáp / Tấn công cho hai build, rồi mô phỏng xem ai thắng.
          </p>
        </Link>
      </div>

      <div style={{ marginTop: 36, fontSize: 11.5, color: "var(--ink-dim)" }}>
        Dữ liệu lưu chung trên server cho cả nhóm — ai mở link cũng thấy bản mới nhất.
      </div>
    </div>
  );
}
