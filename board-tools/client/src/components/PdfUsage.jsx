import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";

// Dung lượng kho PDF chung, hiện trong menu.
//
// Đọc lúc MỞ MENU chứ không lúc mở bảng: component này chỉ được dựng khi menu
// bung ra (TopMenu unmount nội dung khi đóng), nên fetch nằm trong useEffect là
// vừa đúng nhịp — con số này đổi rất chậm, không đáng một request cho mỗi lần ai
// đó vào board.
//
// Không hiện gì khi lỗi hoặc chưa có dữ liệu: đây là thông tin phụ, một dòng
// "không đọc được dung lượng" trong menu chỉ làm người ta lo mà không làm được gì.
export default function PdfUsage() {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/pdf-usage", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data && !data.error) setUsage(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!usage) return null;

  return (
    <div className={"pdf-usage" + (usage.level === "ok" ? "" : " hot")}>
      <div className="pdf-usage-row">
        <Trans>Kho PDF</Trans>
        <span className="mono">{usage.usedText} / {usage.limitText}</span>
      </div>
      {/* Chặn ở 100%: khi kho đã tràn thì percent vượt 100 và thanh sẽ lòi ra
          khỏi khung nếu đổ thẳng vào width. */}
      <div className="pdf-usage-bar"><i style={{ width: `${Math.min(100, usage.percent)}%` }} /></div>
      {usage.level !== "ok" && (
        <div className="pdf-usage-note">
          {usage.level === "full"
            ? <Trans>Đã đầy — không tải PDF mới lên được cho tới khi xoá bớt.</Trans>
            : <Trans>Sắp đầy — xoá bớt thẻ PDF cũ để khỏi bị chặn khi tải lên.</Trans>}
        </div>
      )}
    </div>
  );
}
