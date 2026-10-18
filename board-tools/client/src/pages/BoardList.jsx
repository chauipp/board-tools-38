import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { listBoards, createBoard, deleteBoard } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import LocaleToggle from "../components/LocaleToggle.jsx";

export default function BoardList() {
  const [boards, setBoards] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const toggleTheme = useTheme();
  const { t } = useLingui();
  // Dựng trong component: ngoài component `t` chưa có nên chuỗi không vào được
  // catalog và bản tiếng Anh sẽ hiện nguyên tiếng Việt (xem InviteModal.jsx).
  const ROLE_LABEL = {
    owner: t`Chủ sở hữu`,
    editor: t`Có thể sửa`,
    viewer: t`Chỉ xem`
  };

  useEffect(() => {
    let cancelled = false;
    listBoards()
      .then((data) => { if (!cancelled) setBoards(data); })
      .catch((e) => setLoadError(e.code || "UNKNOWN"));
    return () => { cancelled = true; };
  }, []);

  async function handleCreate() {
    const name = window.prompt(t`Tên board mới`, t`Board mới`);
    if (name == null) return;            // bấm Huỷ
    setCreating(true);
    try {
      const { id } = await createBoard(name.trim() || t`Board mới`);
      navigate(`/idea-map/${id}`);
    } catch (e) {
      setLoadError(e.code || "UNKNOWN");
      setCreating(false);
    }
  }

  // Xoá board là không hoàn tác được và server chỉ cho phép chủ sở hữu, nên nút
  // chỉ hiện với role === "owner" và luôn phải xác nhận trước.
  async function handleDelete(board) {
    if (!window.confirm(t`Xoá board "${board.name}"? Thao tác này không hoàn tác được.`)) return;
    setDeletingId(board.id);
    try {
      await deleteBoard(board.id);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (e) {
      setLoadError(e.code || "UNKNOWN");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 20px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 32 }}>
        <div>
          <div className="eyebrow"><Trans>Bản đồ ý tưởng</Trans></div>
          <h1 className="display" style={{ fontSize: "clamp(24px, 5vw, 32px)", margin: "6px 0 0" }}>
            <Trans>Board của bạn</Trans>
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <LocaleToggle />
          <button className="btn ghost icon" onClick={toggleTheme} title={t`Đổi giao diện sáng/tối`}>◐</button>
        </div>
      </div>

      <button type="button" className="btn" onClick={handleCreate} disabled={creating} style={{ marginBottom: 20 }}>
        <Trans>+ Board mới</Trans>
      </button>

      {loadError && (
        <p style={{ color: "#c33" }}><Trans>Có lỗi xảy ra, thử tải lại trang.</Trans></p>
      )}
      {boards == null && !loadError && <p><Trans>Đang tải…</Trans></p>}
      {boards != null && boards.length === 0 && (
        <p style={{ color: "var(--ink-dim)" }}>
          <Trans>Chưa có board nào — bấm "+ Board mới" để bắt đầu.</Trans>
        </p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {boards?.map((b) => (
          <div
            key={b.id}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
              padding: "14px 16px", boxShadow: "var(--shadow)"
            }}
          >
            {/* Nút xoá không lồng được trong <Link> (thẻ tương tác lồng nhau), nên
                link chiếm phần còn lại của hàng và nút đứng cạnh nó. */}
            <Link
              to={`/idea-map/${b.id}`}
              style={{
                flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 12, textDecoration: "none", color: "var(--ink)"
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--ink-dim)", textTransform: "uppercase" }}>
                {ROLE_LABEL[b.role] || b.role}
              </span>
            </Link>
            {b.role === "owner" && (
              <button
                type="button"
                className="btn ghost icon"
                onClick={() => handleDelete(b)}
                disabled={deletingId === b.id}
                title={t`Xoá board`}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
