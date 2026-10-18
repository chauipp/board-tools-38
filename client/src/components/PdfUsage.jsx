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

  const you = usage.you;
  // Phần của mình mới là thứ người ta chặn phải trước, vì trần riêng nhỏ hơn
  // trần chung rất nhiều — nên nó đứng trên, còn kho chung thành dòng phụ.
  const youHot = you && you.percent >= 80;

  return (
    <div className="pdf-usage">
      {you && (
        <div className={youHot ? "hot" : ""}>
          <div className="pdf-usage-row">
            <Trans>PDF của bạn</Trans>
            <span className="mono">{you.usedText} / {you.limitText}</span>
          </div>
          {/* Chặn ở 100%: khi đã tràn thì percent vượt 100 và thanh sẽ lòi ra
              khỏi khung nếu đổ thẳng vào width. */}
          <div className="pdf-usage-bar"><i style={{ width: `${Math.min(100, you.percent)}%` }} /></div>
          {you.percent >= 100 && (
            <div className="pdf-usage-note">
              <Trans>Hết phần của bạn — xoá bớt thẻ PDF bạn đã tải lên.</Trans>
            </div>
          )}
        </div>
      )}
      <div className={"pdf-usage-row pdf-usage-sub" + (usage.level === "ok" ? "" : " hot")}>
        <Trans>Kho chung</Trans>
        <span className="mono">{usage.usedText} / {usage.limitText}</span>
      </div>
    </div>
  );
}
