import { useEffect, useState, useRef } from "react";
import { loadPenPrefs, savePenPrefs } from "./pen.js";
import { loadCardLevel, saveCardLevel } from "./card-levels.js";
import { loadLaserPrefs, saveLaserPrefs } from "./laser.js";
import { loadWheelMode, saveWheelMode } from "./pointer-input.js";

// State giao diện thuần của bảng: mode và tool đang cầm, tuỳ chọn
// bút/laser/cuộn/bậc thẻ (lưu localStorage), các menu và popover đang mở,
// nhập/xuất, nhập nhanh, kích thước khung nhìn. Không có logic nào ở đây — chỉ
// là chỗ chứa. Trước nằm trong IdeaMap.jsx.
export function useBoardUiState({
  
}) {
  const depsRef = useRef({});

  const [editingId, setEditingId] = useState(null);
  const [ioOpen, setIoOpen] = useState(false);
  const [ioMode, setIoMode] = useState("export");
  const [ioText, setIoText] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const [dropTargetId, setDropTargetId] = useState(null);
  // mode: "select" (thao tác thẻ như cũ) | "draw" (vẽ lên bảng) | "place" (đã
  // lên nòng một việc ở khu 3, đang chờ người dùng chỉ chỗ trên bảng) | "laser"
  // (bút laser — vệt sáng chạy theo con trỏ rồi tan, không ghi gì vào board).
  //
  // Laser là MODE chứ không phải một tool nữa của mode Sửa, dù bề ngoài nó
  // giống vẽ: tool của mode Sửa đều ghi vào board nên đều bị khoá với người chỉ
  // xem và đều đi kèm bảng tuỳ chọn ở khu 4, còn laser thì không cái nào cả.
  // KHÔNG nhớ qua lần mở sau: mở board ra mà con trỏ đang là cây bút là điều
  // gây bất ngờ vô cớ. Riêng màu bút, độ dày và bậc thẻ thì nhớ.
  const [mode, setMode] = useState("select");
  const [tool, setTool] = useState("pen");
  // Việc đang lên nòng ở mode "place": "node" (bấm để đặt thẻ) | "group" (tô
  // để vẽ khung). Khác tool vẽ ở một điểm: làm xong MỘT lần là tự về mode Chuột.
  const [placeTool, setPlaceTool] = useState(null);
  const [penPrefs, setPenPrefs] = useState(() => loadPenPrefs(window.localStorage));
  // Khoá localStorage riêng, không nhét chung với penPrefs: `w` của laser là
  // pixel MÀN HÌNH còn `w` của bút là đơn vị canvas — dùng chung một ô là đổi
  // độ đậm laser sẽ đổi luôn độ dày nét bút.
  const [laserPrefs, setLaserPrefs] = useState(() => loadLaserPrefs(window.localStorage));
  // Cuộn hai ngón / lăn chuột nghĩa là gì: "auto" | "pan" | "zoom". Riêng từng
  // máy (localStorage) chứ không theo board — nó là chuyện thiết bị đang cầm,
  // không phải chuyện bảng đang mở.
  const [wheelMode, setWheelMode] = useState(() => loadWheelMode(window.localStorage));
  const [cardLevelPref, setCardLevelPref] = useState(() => loadCardLevel(window.localStorage));
  const [snapGuides, setSnapGuides] = useState([]);
  const [colorMenu, setColorMenu] = useState(null); // { kind: "card"|"group", id, x, y }
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null); // { id, x, y } | null
  const [flashId, setFlashId] = useState(null);
  const [spotlightPeerId, setSpotlightPeerId] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [initialCardParam] = useState(() => new URLSearchParams(window.location.search).get("card"));
  // Kích thước khung nhìn, để minimap biết vẽ ô "đang xem ở đây" to bằng nào.
  // Giữ trong state chứ không đo lúc render: đo DOM giữa lượt render là ép trình
  // duyệt tính lại layout, mà minimap render lại ở MỌI nhịp lia bảng.
  // ResizeObserver có thể vắng mặt (jsdom trong smoke test) — đo một lần rồi
  // thôi, vẫn đúng vì ở đó cửa sổ không đổi kích thước.
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  useEffect(() => { savePenPrefs(window.localStorage, penPrefs); }, [penPrefs]);
  useEffect(() => { saveLaserPrefs(window.localStorage, laserPrefs); }, [laserPrefs]);
  useEffect(() => { saveWheelMode(window.localStorage, wheelMode); }, [wheelMode]);
  useEffect(() => { saveCardLevel(window.localStorage, cardLevelPref); }, [cardLevelPref]);

  return {
    editingId, setEditingId, ioOpen, setIoOpen, ioMode, setIoMode, ioText, setIoText, captureOpen, setCaptureOpen, captureText, setCaptureText, isPanning, setIsPanning, dropTargetId, setDropTargetId, mode, setMode, tool, setTool, placeTool, setPlaceTool, penPrefs, setPenPrefs, laserPrefs, setLaserPrefs, wheelMode, setWheelMode, cardLevelPref, setCardLevelPref, snapGuides, setSnapGuides, colorMenu, setColorMenu, hoveredEdgeId, setHoveredEdgeId, commentsFor, setCommentsFor, flashId, setFlashId, spotlightPeerId, setSpotlightPeerId, snapshots, setSnapshots, snapshotsLoading, setSnapshotsLoading, inviteOpen, setInviteOpen, initialCardParam, viewportSize, setViewportSize,
    bind: (d) => { depsRef.current = d; }
  };
}
