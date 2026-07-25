import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { listBoards, createBoard } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import LocaleToggle from "../components/LocaleToggle.jsx";

const ROLE_LABEL = { owner: "Chủ sở hữu", editor: "Có thể sửa", viewer: "Chỉ xem" };

export default function BoardList() {
  const [boards, setBoards] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const toggleTheme = useTheme();
  const { t } = useLingui();

  useEffect(() => {
    let cancelled = false;
    listBoards()
      .then((data) => { if (!cancelled) setBoards(data); })
      .catch((e) => setLoadError(e.code || "UNKNOWN"));
    return () => { cancelled = true; };
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const { id } = await createBoard(t`Board mới`);
      navigate(`/idea-map/${id}`);
    } catch (e) {
      setLoadError(e.code || "UNKNOWN");
      setCreating(false);
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
          <Link
            key={b.id}
            to={`/idea-map/${b.id}`}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              textDecoration: "none", color: "var(--ink)",
              background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
              padding: "14px 16px", boxShadow: "var(--shadow)"
            }}
          >
            <span>{b.name}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-dim)", textTransform: "uppercase" }}>
              {ROLE_LABEL[b.role] || b.role}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
