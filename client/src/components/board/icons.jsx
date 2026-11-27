// Icon SVG của bảng ý tưởng (đảo nổi, menu dây). Vẽ theo currentColor nên tự
// đúng ở nền sáng và nền tối.

// Nét bút lượn — cùng ngôn ngữ icon với ToolRail.jsx: inline SVG theo
// currentColor nên tự đúng ở nền sáng và nền tối.
export function IconSketch() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" style={{ display: "block" }}>
      <path d="M3 13.5 C6 13.5 5 7 8.5 7 C12 7 10.5 13.5 14 13.5 C15.8 13.5 16.6 12.3 17 11"
            fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Icon của HUD đảo nổi. Cùng luật với ToolRail.jsx: vẽ path theo currentColor,
// không dùng emoji hay ký tự — emoji không đổi màu theo nền sáng/tối, còn ký tự
// thì đổi hình theo font nên skin vẽ tay sẽ bóp méo cả nút bấm.
export function IconMenu() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M3.5 6 L16.5 6 M3.5 10 L16.5 10 M3.5 14 L16.5 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

// Khung to là cả bảng, khung nhỏ đặc là chỗ đang nhìn — vẽ đúng cái mà minimap
// hiển thị, nên nút không cần nhãn chữ.
export function MiniMapIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16">
      <rect x="2.5" y="4" width="15" height="12" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="6.5" width="6.5" height="5" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function IconSearch() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12.3 12.3 L16.5 16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

export function IconStatus() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="10" cy="10" r="2.8" fill="currentColor" /></svg>;
}

export function IconTag() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M10.6 2.5 L17.5 2.5 L17.5 9.4 L9.4 17.5 L2.5 10.6 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="14" cy="6" r="1.5" fill="currentColor" /></svg>;
}

export function IconPalette() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16">
      <rect x="2.5" y="2.5" width="6.6" height="6.6" rx="1.4" fill="currentColor" opacity="0.85" />
      <rect x="10.9" y="2.5" width="6.6" height="6.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="10.9" width="6.6" height="6.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.9" y="10.9" width="6.6" height="6.6" rx="1.4" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

// Panel "Giao diện" chỉnh nền bảng + bộ màu, nên icon là mặt bàn vẽ có lưới chấm
// — cố ý KHÁC ◐ của nút sáng/tối, hai thứ đó không được đọc nhầm thành một.
export function IconBoardStyle() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="8" r="1.05" fill="currentColor" /><circle cx="13" cy="8" r="1.05" fill="currentColor" />
      <circle cx="7" cy="12.5" r="1.05" fill="currentColor" /><circle cx="13" cy="12.5" r="1.05" fill="currentColor" />
    </svg>
  );
}

export function IconStar() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 2.6 L12.3 7.5 L17.6 8.2 L13.7 11.9 L14.7 17.2 L10 14.6 L5.3 17.2 L6.3 11.9 L2.4 8.2 L7.7 7.5 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

export function IconUndo() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M6.5 5 L3 8.5 L6.5 12 M3 8.5 L12 8.5 A4.5 4.5 0 0 1 12 17.5 L8 17.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function IconRedo() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M13.5 5 L17 8.5 L13.5 12 M17 8.5 L8 8.5 A4.5 4.5 0 0 0 8 17.5 L12 17.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function LineSolidIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function LineDashedIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" /></svg>;
}

export function LineUndirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3" cy="6" r="1.8" fill="currentColor" />
      <circle cx="17" cy="6" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function LineDirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 2l5 4-5 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReverseIcon() {
  return (
    <svg viewBox="0 0 20 16" width="20" height="16">
      <path d="M2 5h13M11 2l3 3-3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 11H5M9 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
