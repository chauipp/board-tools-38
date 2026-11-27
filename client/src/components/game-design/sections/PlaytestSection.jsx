import { CollapsibleSection, ItemFields } from "./ListEditor.jsx";
import { RelatedCards } from "./RelatedCards.jsx";

const PLAYTEST_FIELDS = [
  ["objective", "Mục tiêu test", "textarea"],
  ["hypothesis", "Giả thuyết", "textarea"],
  ["buildVersion", "Build / version", "input"],
  ["playerGroup", "Nhóm người chơi", "input"],
  ["testDate", "Ngày test", "input"],
  ["observations", "Quan sát", "textarea"],
  ["metrics", "Metrics", "textarea"],
  ["playerFeedback", "Player feedback", "textarea"],
  ["problemsFound", "Problems found", "textarea"]
];

export function PlaytestSection({ session, nodes, canEdit, collapsed, onToggle, onChange }) {
  return (
    <CollapsibleSection title="Playtest session" collapsed={collapsed} onToggle={onToggle}>
      <p className="gd-detail-empty">Một thẻ Playtest tương ứng với một lần test.</p>
      <ItemFields fields={PLAYTEST_FIELDS} item={session} canEdit={canEdit} onPatch={(patch) => onChange({ ...session, ...patch })} />
      <RelatedCards value={session.cardIds} nodes={nodes} canEdit={canEdit} onChange={(cardIds) => onChange({ ...session, cardIds })} />
    </CollapsibleSection>
  );
}
