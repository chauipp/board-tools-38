import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { getMembers, inviteMember, updateMemberRole, removeMember } from "../lib/api.js";

export default function InviteModal({ boardId, onClose }) {
  const { t } = useLingui();
  // Dựng trong component: chuỗi phải đi qua t`` mới vào được catalog, ngoài
  // component thì `t` chưa có và bản tiếng Anh sẽ hiện nguyên tiếng Việt.
  const ERROR_MESSAGES = {
    not_allowed: t`Email này chưa được cấp quyền đăng nhập vào hệ thống.`,
    already_owner: t`Email này đã là chủ sở hữu board.`,
    invalid_input: t`Email hoặc vai trò không hợp lệ.`
  };
  const [members, setMembers] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    getMembers(boardId).then(setMembers).catch(() => setMembers([]));
  }

  useEffect(() => { reload(); }, [boardId]);

  async function handleInvite(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await inviteMember(boardId, email.trim(), role);
      setEmail("");
      reload();
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || t`Không mời được thành viên.`);
    } finally {
      setSubmitting(false);
    }
  }

  // api.js ném lỗi cho mọi phản hồi không OK; không bắt ở đây thì PATCH/DELETE
  // hỏng chỉ thành unhandled rejection: reload() không chạy, <select> lặng lẽ
  // nhảy về giá trị cũ và người dùng không hiểu vì sao.
  async function handleRoleChange(memberEmail, newRole) {
    setError(null);
    try {
      await updateMemberRole(boardId, memberEmail, newRole);
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || t`Không đổi được vai trò thành viên.`);
    }
    reload();
  }

  async function handleRemove(memberEmail) {
    setError(null);
    try {
      await removeMember(boardId, memberEmail);
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || t`Không xoá được thành viên khỏi board.`);
    }
    reload();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 20, width: 380, maxWidth: "90vw", boxShadow: "var(--shadow)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 className="display" style={{ fontSize: 15, margin: 0 }}><Trans>Mời thành viên</Trans></h2>
          <button type="button" className="btn ghost icon" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleInvite} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            type="email"
            required
            placeholder={t`Email`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: 0, padding: "7px 9px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 12.5 }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ padding: "7px 9px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 12.5 }}
          >
            <option value="editor">{t`Có thể sửa`}</option>
            <option value="viewer">{t`Chỉ xem`}</option>
          </select>
          <button type="submit" className="btn" disabled={submitting}><Trans>Mời</Trans></button>
        </form>

        {error && <p style={{ color: "#c33", fontSize: 12, margin: "0 0 10px" }}>{error}</p>}

        {members == null && <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></p>}
        {members?.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-dim)" }}><Trans>Chưa mời ai vào board này.</Trans></p>}

        <div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto" }}>
          {members?.map((m) => (
            <div key={m.email} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              {m.picture
                ? <img src={m.picture} alt="" referrerPolicy="no-referrer" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                : <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--line)", display: "inline-block" }} />}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.name || m.email}
              </span>
              <select
                value={m.role}
                onChange={(e) => handleRoleChange(m.email, e.target.value)}
                style={{ fontSize: 11.5, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
              >
                <option value="editor">{t`Có thể sửa`}</option>
                <option value="viewer">{t`Chỉ xem`}</option>
              </select>
              <button type="button" className="btn ghost icon" onClick={() => handleRemove(m.email)} title={t`Xoá khỏi board`}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
