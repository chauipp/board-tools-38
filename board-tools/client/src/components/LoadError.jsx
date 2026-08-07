import { Trans } from "@lingui/react/macro";

export default function LoadError({ code }) {
  return (
    <div style={{ padding: 40 }}>
      {code === "board_limit_reached" ? (
        <Trans>
          Bạn đã tạo tối đa số board cho phép. Xoá bớt board không dùng nữa rồi thử lại.
        </Trans>
      ) : code === "too_many_boards" ? (
        <Trans>
          Bạn vừa tạo quá nhiều board trong một giờ. Chờ một lát rồi thử lại.
        </Trans>
      ) : code === "BOARD_NOT_FOUND" ? (
        // Server trả 404 cho cả board không tồn tại lẫn board mình không phải
        // thành viên (cố tình không lộ board nào có thật), nên câu chữ phải phủ
        // được cả hai trường hợp.
        <Trans>
          Không mở được board này. Có thể board đã bị xoá, hoặc bạn chưa được mời vào board.
        </Trans>
      ) : (
        <Trans>
          Không tải được dữ liệu. Kiểm tra server đã chạy chưa (npm run dev trong thư mục server) và biến MONGODB_URI đã đúng chưa.
        </Trans>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-dim)" }}>{code}</div>
    </div>
  );
}
