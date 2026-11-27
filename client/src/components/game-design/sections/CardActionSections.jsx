// Hai khối chỉ hiện khi sửa được, không thu gọn: tạo biến thể và tạo card nối tiếp.
function ActionSection({ title, children }) {
  return (
    <section className="gd-detail-section">
      <div className="gd-detail-section-head"><strong className="gd-detail-collapse">{title}</strong></div>
      <div className="gd-detail-list">{children}</div>
    </section>
  );
}

export function CardVariantSection({ onDuplicate }) {
  return (
    <ActionSection title="Biến thể card">
      <p className="gd-detail-empty">Sao chép toàn bộ spec để thử phương án khác. Bản sao không giữ status hoặc dây nối.</p>
      <button className="btn ghost" type="button" onClick={onDuplicate}>Nhân bản thẻ</button>
    </ActionSection>
  );
}

// State loại/quan hệ do panel giữ (không reset khi đổi thẻ hay quyền sửa), ở đây chỉ hiển thị.
export function RelatedCardSection({ relatedType, relatedRelation, setRelatedType, setRelatedRelation, onCreateRelated }) {
  return (
    <ActionSection title="Tạo card liên quan">
      <label>
        Loại card
        <select value={relatedType} onChange={(event) => setRelatedType(event.target.value)}>
          <option value="mechanic">Mechanic</option>
          <option value="ui-ux">UI / UX</option>
          <option value="quest-level">Quest / Level</option>
          <option value="playtest">Playtest</option>
        </select>
      </label>
      <label>
        Quan hệ
        <select value={relatedRelation} onChange={(event) => setRelatedRelation(event.target.value)}>
          <option value="depends-on">Phụ thuộc</option>
          <option value="unlocks">Mở khóa</option>
          <option value="replaces">Thay thế</option>
        </select>
      </label>
      <button className="btn ghost" type="button" onClick={() => onCreateRelated(relatedType, relatedRelation)}>+ Tạo & nối</button>
    </ActionSection>
  );
}
