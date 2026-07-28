// Icon của bậc thẻ: vẽ ĐÚNG cái mà bậc đó tạo ra — một hình thẻ nhỏ và nhạt dần
// theo bậc, bậc 1 đội vương miện, bậc 5 viền đứt. Không dùng chữ "1..5": nhìn
// dãy icon là thấy ngay thang bậc, còn con số thì phải đọc mới hiểu.
//
// Nằm riêng một file vì dùng ở hai chỗ: khu 4 (lúc tạo thẻ mới) và menu chuột
// phải (lúc đổi bậc cho thẻ đã có).

// Khung thẻ theo bậc, trong hệ toạ độ viewBox 20 đơn vị chiều cao. `y` ở bậc 1
// đẩy xuống 6 để chừa chỗ cho vương miện phía trên.
const LEVEL_BOX = {
  1: { w: 34, h: 12, y: 6, sw: 2.2 },
  2: { w: 29, h: 12.5, y: 3.75, sw: 2 },
  3: { w: 24, h: 11, y: 4.5, sw: 1.5 },
  4: { w: 19, h: 9, y: 5.5, sw: 1.2 },
  5: { w: 14, h: 8, y: 6, sw: 1 }
};

export default function CardLevelIcon({ level }) {
  const box = LEVEL_BOX[level] ?? LEVEL_BOX[3];
  return (
    <svg viewBox="0 0 40 20" width="30" height="15">
      {level === 1 && (
        <path d="M12 6 L14 1.8 L17 4.8 L20 1.4 L23 4.8 L26 1.8 L28 6 Z" fill="currentColor" />
      )}
      <rect
        x={(40 - box.w) / 2}
        y={box.y}
        width={box.w}
        height={box.h}
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={box.sw}
        strokeDasharray={level === 5 ? "2.6 2" : undefined}
      />
    </svg>
  );
}
