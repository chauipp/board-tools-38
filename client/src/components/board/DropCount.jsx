// Nhãn "cú thả này ăn vào mấy đối tượng", bay theo chuột cùng badge/màu đang
// kéo. Chỉ hiện khi từ hai trở lên: thả vào đúng một thẻ là việc thường ngày,
// đếm ở đó chỉ thêm nhiễu. Không dịch — chỉ có dấu × và một con số.
export default function DropCount({ targetId, idsFor }) {
  if (!targetId || (targetId.kind !== "node" && targetId.kind !== "edge")) return null;
  const n = idsFor(targetId.kind, targetId.id).length;
  if (n < 2) return null;
  return <span className="ghost-n mono">×{n}</span>;
}
