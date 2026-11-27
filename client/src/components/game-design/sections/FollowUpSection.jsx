import { ListEditor } from "./ListEditor.jsx";
import { RelatedCards } from "./RelatedCards.jsx";

function newFollowUpTask() {
  return { id: globalThis.crypto?.randomUUID?.() || `follow-up-${Date.now()}`, text: "", owner: "", deadline: "", done: false, cardIds: [] };
}

export function FollowUpSection({ tasks, nodes, canEdit, collapsed, onToggle, onChange }) {
  return (
    <ListEditor
      title="Follow-up tasks"
      count={tasks.filter((task) => !task.done).length}
      items={tasks}
      itemLabel="Việc"
      emptyText="Chưa có việc follow-up."
      addLabel="Thêm việc"
      limit={20}
      newItem={newFollowUpTask}
      canEdit={canEdit}
      collapsed={collapsed}
      onToggle={onToggle}
      onChange={onChange}
      renderItem={(task, patch) => <>
        <label className="gd-review-resolved">
          <input type="checkbox" checked={task.done} disabled={!canEdit} onChange={(event) => patch({ done: event.target.checked })} /> Hoàn thành
        </label>
        <label>
          Công việc
          <input maxLength={4000} value={task.text} disabled={!canEdit} onChange={(event) => patch({ text: event.target.value })} />
        </label>
        <label>
          Owner
          <input maxLength={4000} value={task.owner} disabled={!canEdit} onChange={(event) => patch({ owner: event.target.value })} />
        </label>
        <label>
          Deadline
          <input type="date" value={task.deadline} disabled={!canEdit} onChange={(event) => patch({ deadline: event.target.value })} />
        </label>
        <RelatedCards value={task.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => patch({ cardIds })} label="Thẻ liên quan" />
      </>}
    />
  );
}
