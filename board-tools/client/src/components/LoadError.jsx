import { Trans } from "@lingui/react/macro";

export default function LoadError({ code }) {
  return (
    <div style={{ padding: 40 }}>
      <Trans>
        Không tải được dữ liệu. Kiểm tra server đã chạy chưa (npm run dev trong thư mục server) và biến MONGODB_URI đã đúng chưa.
      </Trans>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-dim)" }}>{code}</div>
    </div>
  );
}
