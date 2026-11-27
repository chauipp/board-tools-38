import { useMemo } from "react";
import { Trans } from "@lingui/react/macro";
import { formatConflictValue } from "../lib/card-edit.js";
import { rebaseBoard } from "../lib/rebase.js";

export default function BoardSaveConflict({ server, base, draft, onResolve, onRefresh, onDownloadServer }) {
  const { conflicts, canUseServer, canUseDraft } = useMemo(() => {
    const conflicts = [];
    const serverResult = rebaseBoard(server, base, draft, { resolveConflict: (item) => {
      conflicts.push(item);
      return "server";
    } });
    const draftResult = rebaseBoard(server, base, draft, { resolveConflict: () => "draft" });
    return { conflicts, canUseServer: Boolean(serverResult), canUseDraft: Boolean(draftResult) };
  }, [server, base, draft]);

  if (!server) {
    return <button type="button" onClick={onRefresh}><Trans id="board.conflict.refresh">Tải bản server mới nhất</Trans></button>;
  }

  return (
    <details className="board-save-conflict">
      <summary><Trans id="board.conflict.review">Xem và xử lý xung đột</Trans></summary>
      <time dateTime={server.updatedAt}>{new Date(server.updatedAt).toLocaleString()}</time>
      {conflicts.length > 0 && (
        <ul className="board-conflict-list">
          {conflicts.map(({ collection, id, field, server: current, draft: proposed }) => (
            <li key={JSON.stringify([collection, id, field])}>
              <strong>{[collection, id, field].filter((value) => value != null).join(" / ")}</strong>
              <div><Trans id="board.conflict.server.value">Server</Trans> · {formatConflictValue(current)}</div>
              <div><Trans id="board.conflict.draft.value">Bản nháp</Trans> · {formatConflictValue(proposed)}</div>
            </li>
          ))}
        </ul>
      )}
      {(canUseServer || canUseDraft) && conflicts.length > 0 && (
        <p><Trans id="board.conflict.merge.help">Các chỉnh sửa ở phần khác vẫn được ghép.</Trans></p>
      )}
      {!canUseServer && !canUseDraft && (
        <p role="alert"><Trans id="board.conflict.unmergeable">Chưa thể ghép hai bản. Bạn có thể tải cả hai bản JSON.</Trans></p>
      )}
      <div className="board-conflict-actions">
        <button type="button" onClick={onDownloadServer}><Trans id="board.conflict.download.server">Tải bản server JSON</Trans></button>
        {canUseServer && conflicts.length === 0 && (
          <button type="button" onClick={() => onResolve("server", server.updatedAt)}><Trans id="board.conflict.merge">Ghép và lưu</Trans></button>
        )}
        {canUseServer && conflicts.length > 0 && (
          <button type="button" onClick={() => onResolve("server", server.updatedAt)}><Trans id="board.conflict.keep.server">Giữ phần trùng của server</Trans></button>
        )}
        {canUseDraft && conflicts.length > 0 && (
          <button type="button" onClick={() => onResolve("draft", server.updatedAt)}><Trans id="board.conflict.keep.draft">Giữ phần trùng của bản nháp</Trans></button>
        )}
      </div>
    </details>
  );
}
