import { Trans, useLingui } from "@lingui/react/macro";
import { IconUndo, IconRedo } from "./icons.jsx";

// Đảo Hoàn tác / Làm lại ở góc dưới trái. Trước là một khối JSX trong
// IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function HistoryIsland({ future, past, redo, saveError, undo }) {
  const { t } = useLingui();
  return (
    <>
      {/* ĐẢO HOÀN TÁC — góc dưới trái, đối xứng với nút zoom ở góc dưới phải:
          cả hai đều là thao tác lên TRẠNG THÁI khung nhìn/bảng chứ không tạo ra
          nội dung, nên chúng thuộc về đáy màn hình, không phải mặt tiền.
          Chỗ này trước đây trống hoàn toàn. */}
      <div className="island bl">
        <div className="island-row">
          <button type="button" className="island-btn" data-mutating onClick={undo} disabled={past.length === 0} title={t`Hoàn tác (Ctrl+Z)`}><IconUndo /></button>
          <button type="button" className="island-btn" data-mutating onClick={redo} disabled={future.length === 0} title={t`Làm lại (Ctrl+Shift+Z)`}><IconRedo /></button>
          {saveError && (
            <span style={{ fontSize: 11, color: "var(--danger)", paddingRight: 4 }}>
              <Trans>Không lưu được lên server.</Trans>
            </span>
          )}
        </div>
      </div>
    </>
  );
}
