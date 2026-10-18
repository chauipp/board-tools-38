import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { createBoardSnapshot, getBoard, listBoardSnapshots, restoreBoardSnapshot, saveBoard } from "../lib/api.js";
import { useTheme } from "../lib/useTheme.js";
import { useSkin } from "../lib/useSkin.js";
import {
  drawingsHitBy, drawingsInRect, moveDrawing, drawingBox,
  shapeHandles, moveShapeHandle, HANDLE_EDGE
} from "../lib/shape.js";
import { textLines, textBox, TEXT_LINE_H } from "../lib/text-el.js";
import { BADGE_PALETTE, colorVar, statusById, tagById } from "../lib/badges.js";
import { RELATION_OPTIONS, relationDefinition, isGameDesignRelation, createRelatedGameDesignCard, duplicateGameDesignCard, exportPackage, exportVersion, normalizeABTests, normalizeAcceptanceCriteria, normalizeAnalyticsEvents, normalizeFollowUpTasks, normalizeGameDesignBrief, normalizeGameDesignDetails, normalizeGameDesignFlow, normalizeGameDesignBalance, normalizeLiveOps, normalizePostLaunchReview, normalizeTechnicalNotes, normalizePlaytestSession, normalizeDecisionLog, normalizeTeamHandoff, normalizeReview, normalizeDelivery, createGameDesignNode, dependencyAnalysis, gameDesignMarkdown } from "../lib/game-design.js";
import { paletteCss, applyColorTo, applyColorToMany, removePaletteColor } from "../lib/palette.js";
import { BOARD_BGS, BOARD_GRIDS, COLOR_PACKS, isBoardBg, isBoardGrid, isColorPack } from "../lib/board-theme.js";
import FilterPanel from "../components/FilterPanel.jsx";
import TreePanel from "../components/TreePanel.jsx";
import MiniMap from "../components/MiniMap.jsx";
import { rectsOf, panForCenter } from "../lib/minimap.js";
import LoadError from "../components/LoadError.jsx";
import LocaleToggle from "../components/LocaleToggle.jsx";
import InviteModal from "../components/InviteModal.jsx";
import PresenceBar from "../components/PresenceBar.jsx";
import FollowBanner from "../components/FollowBanner.jsx";
import BadgeEditor from "../components/BadgeEditor.jsx";
import ColorMenu from "../components/ColorMenu.jsx";
import FrameBox from "../components/FrameBox.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import GameDesignPanel from "../components/GameDesignPanel.jsx";
import GameDesignBriefPanel from "../components/GameDesignBriefPanel.jsx";
import GameDesignFlowPanel from "../components/GameDesignFlowPanel.jsx";
import DevHandoffPanel from "../components/DevHandoffPanel.jsx";
import GameDesignBalancePanel from "../components/GameDesignBalancePanel.jsx";
import DecisionTimelinePanel from "../components/DecisionTimelinePanel.jsx";
import BoardSnapshotsPanel from "../components/BoardSnapshotsPanel.jsx";
import GameDesignInsightsPanel from "../components/GameDesignInsightsPanel.jsx";
import GameDesignReportsPanel from "../components/GameDesignReportsPanel.jsx";
import GameDesignImpactPanel from "../components/GameDesignImpactPanel.jsx";
import PlaytestComparisonPanel from "../components/PlaytestComparisonPanel.jsx";
import EdgeLayer from "../components/EdgeLayer.jsx";
import PeerLayer from "../components/PeerLayer.jsx";
import ToolRail from "../components/ToolRail.jsx";
import PdfUsage from "../components/PdfUsage.jsx";
import ToolOptions from "../components/ToolOptions.jsx";
import { nodesInFrame, edgesMatch, rectForEndpoint, clipToRect, segmentIntersectsRect } from "../lib/board-geometry.js";
import { computeSnap } from "../lib/snap.js";
import { CLICK_DRAG_TOL, createMultiClick } from "../lib/multi-click.js";
import { placeLinkedNode, parentNodeId } from "../lib/place-node.js";
import { buildOutline, outlineToMarkdown } from "../lib/outline.js";
import { gridLayout, layerLayout } from "../lib/layout.js";
import { treeLayout, buildTree, edgeKey, carryGroupMembers } from "../lib/tree-layout.js";
import { useAuth } from "../context/AuthContext.jsx";
import { usePresence } from "../lib/usePresence.js";
import { useFollow } from "../lib/useFollow.js";
import { useLiveSync, applyGeomOverlay, mergeRemoteBoard } from "../lib/useLiveSync.js";
import { rebaseBoard } from "../lib/rebase.js";
import { useCardSizes } from "../lib/card-sizes.js";
import { rafThrottle } from "../lib/raf-throttle.js";
import { replaceIdSet, toggleId, unionIdSet } from "../lib/selection.js";
import { loadCamera, saveCamera } from "../lib/camera.js";
import { useCloseOnOutside } from "../lib/useCloseOnOutside.js";
import { readImageFile } from "../lib/image-utils.js";
import { canAddImage, formatMB } from "../lib/image-budget.js";
import { usePopoverPosition } from "../lib/usePopoverPosition.js";
import { drawBoardToCanvas } from "../lib/png-export.js";
import { loadPenPrefs, savePenPrefs, penVar } from "../lib/pen.js";

function normalizeGameDesignBoard(board) {
  if (!board || board.kind !== "game-design") return board;
  return {
    ...board,
    gameDesignBrief: normalizeGameDesignBrief(board.gameDesignBrief),
    gameDesignFlow: normalizeGameDesignFlow(board.gameDesignFlow, board.nodes),
    gameDesignBalance: normalizeGameDesignBalance(board.gameDesignBalance, board.nodes),
    nodes: (board.nodes || []).map((node) => node?.design ? {
      ...node,
      design: {
        ...node.design,
        technicalNotes: normalizeTechnicalNotes(node.design.technicalNotes),
        acceptanceCriteria: normalizeAcceptanceCriteria(node.design.acceptanceCriteria),
        ...normalizeGameDesignDetails(node.design),
        playtestSession: normalizePlaytestSession(node.design.playtestSession, board.nodes),
        decisionLog: normalizeDecisionLog(node.design.decisionLog, board.nodes),
        teamHandoff: normalizeTeamHandoff(node.design.teamHandoff),
        review: normalizeReview(node.design.review),
        delivery: normalizeDelivery(node.design.delivery),
        analyticsEvents: normalizeAnalyticsEvents(node.design.analyticsEvents),
        followUpTasks: normalizeFollowUpTasks(node.design.followUpTasks, board.nodes),
        abTests: normalizeABTests(node.design.abTests),
        liveOps: normalizeLiveOps(node.design.liveOps),
        postLaunchReview: normalizePostLaunchReview(node.design.postLaunchReview, board.nodes)
      }
    } : node)
  };
}
import { ERASE_PART } from "../lib/erase.js";
import { CARD_LEVEL_W, cardLevel, levelPatch, loadCardLevel, saveCardLevel } from "../lib/card-levels.js";
import InkLayer from "../components/InkLayer.jsx";
import { useInk } from "../lib/useInk.js";
import { useInkLive } from "../lib/useInkLive.js";
import { applyInkMoves } from "../lib/ink-live.js";
import LaserLayer from "../components/LaserLayer.jsx";
import { useLaser } from "../lib/useLaser.js";
import { loadLaserPrefs, saveLaserPrefs } from "../lib/laser.js";
import { createWheelReader, loadWheelMode, saveWheelMode } from "../lib/pointer-input.js";
import {
  selectionBounds, pointInBounds, cornerPoint, anchorFor, scaleFactorFor, scaleSelection,
  SELECTION_CORNERS
} from "../lib/selection-box.js";
import "../styles/idea-map.css";

const CARD_W = 210;
// Cỡ nhỏ nhất của một cái khung. Dùng chung cho cả tay cầm kéo giãn LẪN cú tô ra
// khung mới — tô được một cái khung 70x60 rồi kéo giãn không thu lại được nữa là
// hai luật đá nhau; và khung bé hơn thế thì nút ×, tiêu đề, bốn dấu + chồng chất
// lên nhau, không bấm trúng cái nào.
// Di dưới ngưỡng này (đơn vị toạ độ canvas) thì cú bấm lên text được hiểu là
// "mở ra sửa" chứ không phải "kéo đi". Đủ rộng để tay run không thành cú kéo,
// đủ hẹp để một cú kéo thật không bị nuốt thành cú bấm.
const TEXT_DRAG_THRESHOLD = 3;
// Nới vùng cầm của hộp bao vùng chọn ra ngoài mép, tính bằng pixel MÀN HÌNH
// (chia cho scale trước khi so). Nhắm cho trúng một đường viền 1px là việc không
// ai làm nổi, và mép chính là chỗ tay hay đặt vào nhất.
const SEL_GRAB_PAD = 6;
// Đích thả màu "cả vùng chọn". Object hằng dùng chung: dựng mới ở mỗi nhịp chuột
// thì mọi thẻ trên bảng render lại theo (dropTargetId là prop của IdeaCard).
const SELECTION_DROP = { kind: "selection", id: null };
// Ngưỡng chạm khi bấm chọn nét vẽ / hình / chữ, tính bằng đơn vị canvas. Rộng
// hơn cục gôm một chút: gôm là việc quét cả một vùng nên bắt hụt còn quét lại
// được, còn bấm chọn mà trượt thì mất cả vùng chọn, phải gom lại từ đầu.
const PICK_RADIUS = 6;
const MIN_GROUP_W = 160, MIN_GROUP_H = 120;
const MIN_SCALE = 0.3, MAX_SCALE = 2.4;

// Ba panel LỌC ở thanh đáy. Giao diện không nằm đây: nó là thiết lập, và nó bung
// ra ngay dưới nút của mình trên đảo trên trái.
// Liệt kê ra một chỗ để "có panel nào đang bật không" không phải viết tay ba
// phép hoặc là một Object.keys trên state.
const PANEL_KEYS = ["status", "tag", "palette"];

// Tuỳ chọn khởi điểm của bảng Xếp cây. depth 110 (chứ không 70 như hướng ngang)
// vì hướng dọc lấy CHIỀU CAO thẻ làm khoảng cách tầng — xem ghi chú trong
// arrangeAsTree. breadth và leaf bằng nhau: mặc định là cây đều, người dùng tự
// bó hàng lá lại nếu muốn.
const TREE_OPTS = { directions: ["down"], depth: 110, breadth: 56, leaf: 56 };
const EMPTY_ARRAY = [];
const EMPTY_MAP = new Map();
const EMPTY_SET = new Set();

// Nhãn "cú thả này ăn vào mấy đối tượng", bay theo chuột cùng badge/màu đang
// kéo. Chỉ hiện khi từ hai trở lên: thả vào đúng một thẻ là việc thường ngày,
// đếm ở đó chỉ thêm nhiễu. Không dịch — chỉ có dấu × và một con số.
function DropCount({ targetId, idsFor }) {
  if (!targetId || (targetId.kind !== "node" && targetId.kind !== "edge")) return null;
  const n = idsFor(targetId.kind, targetId.id).length;
  if (n < 2) return null;
  return <span className="ghost-n mono">×{n}</span>;
}

// Một nhãn (chữ hoặc icon), bấm mở khối nội dung ngay dưới nó. Đảo trên trái
// dùng hai cái: ☰ (việc thỉnh thoảng mới làm — về danh sách board, xuất/nhập
// JSON, trình chiếu, mục lục) và nút Giao diện (ngôn ngữ, sáng/tối, kiểu vẽ,
// nền bảng, bộ màu).
//
// `closeOnClick` phải tắt được: menu hành động thì bấm một mục là xong việc, nên
// đóng lại là đúng; còn bảng thiết lập thì người ta bấm "Tối" rồi bấm tiếp
// "Pastel" — đóng sau mỗi cú bấm là bắt mở lại năm lần.
// `wide` cho khối nội dung rộng hơn 190px của menu hành động: hàng swatch nền
// bảng và bốn nút bộ màu không vừa bề ngang đó.
function TopMenu({ label, title, active, align = "left", wide, closeOnClick = true, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useCloseOnOutside(ref, () => setOpen(false));
  return (
    <div className="menubar-item" ref={ref}>
      <button
        type="button"
        className={"menubar-trigger" + (active ? " active" : "") + (open ? " open" : "")}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        // onClick (bubble), không phải onClickCapture: bubble chạy sau khi nút con
        // đã xử lý xong click của chính nó — capture đóng menu (unmount) trước khi
        // click kịp bubble tới nút, khiến hành động không chạy (vd bấm "+ Ý tưởng"
        // không tạo thẻ nào).
        <div
          className={"menubar-dropdown" + (align === "right" ? " align-right" : "") + (wide ? " wide" : "")}
          onClick={closeOnClick ? () => setOpen(false) : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function computeZoom(currentBoard, rect, screenX, screenY, factor) {
  const mx = screenX - rect.left, my = screenY - rect.top;
  const oldScale = currentBoard.view.scale;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor));
  const cx = (mx - currentBoard.view.panX) / oldScale;
  const cy = (my - currentBoard.view.panY) / oldScale;
  return { ...currentBoard, view: { panX: mx - newScale * cx, panY: my - newScale * cy, scale: newScale } };
}

// Nét bút lượn — cùng ngôn ngữ icon với ToolRail.jsx: inline SVG theo
// currentColor nên tự đúng ở nền sáng và nền tối.
function IconSketch() {
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
function IconMenu() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M3.5 6 L16.5 6 M3.5 10 L16.5 10 M3.5 14 L16.5 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
// Khung to là cả bảng, khung nhỏ đặc là chỗ đang nhìn — vẽ đúng cái mà minimap
// hiển thị, nên nút không cần nhãn chữ.
function MiniMapIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16">
      <rect x="2.5" y="4" width="15" height="12" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="6.5" width="6.5" height="5" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
function IconSearch() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12.3 12.3 L16.5 16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
function IconStatus() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="10" cy="10" r="2.8" fill="currentColor" /></svg>;
}
function IconTag() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M10.6 2.5 L17.5 2.5 L17.5 9.4 L9.4 17.5 L2.5 10.6 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="14" cy="6" r="1.5" fill="currentColor" /></svg>;
}
function IconPalette() {
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
function IconBoardStyle() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7" cy="8" r="1.05" fill="currentColor" /><circle cx="13" cy="8" r="1.05" fill="currentColor" />
      <circle cx="7" cy="12.5" r="1.05" fill="currentColor" /><circle cx="13" cy="12.5" r="1.05" fill="currentColor" />
    </svg>
  );
}
function IconStar() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M10 2.6 L12.3 7.5 L17.6 8.2 L13.7 11.9 L14.7 17.2 L10 14.6 L5.3 17.2 L6.3 11.9 L2.4 8.2 L7.7 7.5 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}
function IconUndo() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M6.5 5 L3 8.5 L6.5 12 M3 8.5 L12 8.5 A4.5 4.5 0 0 1 12 17.5 L8 17.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconRedo() {
  return <svg viewBox="0 0 20 20" width="16" height="16"><path d="M13.5 5 L17 8.5 L13.5 12 M17 8.5 L8 8.5 A4.5 4.5 0 0 0 8 17.5 L12 17.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function IdeaMap() {
  const { theme, setTheme } = useTheme();
  const { skin, toggle: toggleSkin } = useSkin();
  const { t } = useLingui();
  // Tên preset nằm ở đây chứ không ở lib/board-theme.js: module đó là dữ liệu
  // thuần, test bằng node:test, không kéo được `t` của lingui vào.
  const BG_LABEL = {
    paper: t`Giấy kraft`, white: t`Trắng`, slate: t`Xám đá`,
    mint: t`Bạc hà`, blush: t`Hồng phấn`, sky: t`Xanh trời`,
    sand: t`Cát`, lavender: t`Oải hương`, blueprint: t`Bản vẽ`
  };
  const GRID_LABEL = {
    dots: t`Lưới chấm`, lines: t`Lưới ô`, plain: t`Không lưới`
  };
  const PACK_LABEL = {
    pastel: t`Pastel`, vivid: t`Rực`, mono: t`Đơn sắc`,
    earth: t`Đất`, neon: t`Neon`
  };
  const [board, setBoard] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [linkMode, setLinkMode] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);
  const [filterStatus, setFilterStatus] = useState({});
  const [filterTags, setFilterTags] = useState({});
  const [filterFav, setFilterFav] = useState(false);
  const [search, setSearch] = useState("");
  const [outlineOpen, setOutlineOpen] = useState(false);
  // Bản đồ thu nhỏ ở góc dưới phải. Mặc định BẬT: nó chỉ có nghĩa khi luôn ở
  // đó — thứ phải bật lên mới xem được thì lúc lạc đường đã không nhớ là có.
  const [miniOpen, setMiniOpen] = useState(true);
  // Bảng Xếp cây bên phải: { kind, id } của thẻ/khung đang làm gốc. Tuỳ chọn
  // sống riêng để đóng bảng rồi mở lại cây khác vẫn giữ nguyên cách xếp vừa dò
  // được. treeBaseRef giữ board TRƯỚC khi mở bảng: mọi lần kéo thanh trượt đều
  // tính lại từ đó chứ không chồng lên kết quả lần trước, nên kéo qua kéo lại
  // không làm cây trôi dần đi.
  const [treeUI, setTreeUI] = useState(null);
  const [treeOpts, setTreeOpts] = useState(TREE_OPTS);
  const treeBaseRef = useRef(null);
  const treeLastRef = useRef(null);
  const [ioOpen, setIoOpen] = useState(false);
  const [ioMode, setIoMode] = useState("export");
  const [ioText, setIoText] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [isPanning, setIsPanning] = useState(false);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [linkDraft, setLinkDraft] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [chipDrag, setChipDrag] = useState(null);
  // Mặc định mở Trạng thái + Nhãn để giữ đúng hành vi cũ khi mới vào; Bảng màu
  // đóng. Chỉ giữ trong state — không lưu qua reload.
  const [panels, setPanels] = useState({ status: true, tag: true, palette: false });
  // Ô tìm kiếm thu về một nút: 170px + nhãn là chỗ thường trực cho việc thỉnh
  // thoảng mới dùng. Đóng lại thì XOÁ luôn từ khoá — từ khoá còn sống mà ô nhập
  // biến mất là một bộ lọc vô hình, thẻ bị làm mờ mà không thấy vì sao.
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [placeDraft, setPlaceDraft] = useState(null); // khung đang tô: {x,y,w,h}
  // Ô nhập text đang mở: { id: number|null, x, y, value, size, color }. id null
  // = đang tạo mới. Chỉ có MỘT ô mở tại một thời điểm.
  const [textEdit, setTextEdit] = useState(null);
  // Text đang được kéo: { id, x, y }. Chỉ là bản NHÁP để vẽ lại theo con trỏ;
  // board chỉ được ghi một lần lúc nhả chuột.
  const [textDrag, setTextDrag] = useState(null);
  // Bản sao của textEdit trong một ref, để commitText CHỐT ĐƯỢC MỘT LẦN. Nó là
  // handler của onBlur đồng thời được gọi tường minh khi bấm sang chỗ khác; hai
  // đường cùng đọc `textEdit` từ closure của một lượt vẽ nên gọi hai lần sẽ lưu
  // ra hai phần tử giống hệt nhau. Ref bị xoá ngay trong lời gọi đầu, lời gọi
  // thứ hai thành lệnh rỗng.
  const textEditRef = useRef(null);
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
  const [paletteUI, setPaletteUI] = useState(null); // { mode: "create"|"edit", id?, hex, x, y } | null
  const [colorDrag, setColorDrag] = useState(null); // { token, x, y } | null
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState(new Set());
  // Khung (nhóm) cũng là một thứ chọn được, quét trúng là vào đây. Kéo một khung
  // luôn kéo theo thẻ nằm trong nó, nên tập này KHÔNG chứa sẵn các thẻ thành
  // viên — chúng được tính lại tại chỗ (selectionDragSet), vì thẻ có thể ra vào
  // khung bất cứ lúc nào.
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  // Nét bút, hình khối và chữ — cả ba nằm chung trong board.drawings nên chung
  // một tập chọn. Chúng không có nút DOM riêng (cả lớp vẽ là một thẻ <svg>
  // pointer-events: none), nên mọi phép bắt chuột ở đây đều là hit-test hình học
  // trên toạ độ canvas, không phải elementFromPoint như thẻ.
  const [selectedDrawingIds, setSelectedDrawingIds] = useState(new Set());
  const [marquee, setMarquee] = useState(null);
  const [snapGuides, setSnapGuides] = useState([]);
  const [badgeUI, setBadgeUI] = useState(null); // { mode: "create"|"edit", kind, def?, x, y }
  const [colorMenu, setColorMenu] = useState(null); // { kind: "card"|"group", id, x, y }
  const [edgeMenu, setEdgeMenu] = useState(null); // { id, x, y } | null
  const [hoveredEdgeId, setHoveredEdgeId] = useState(null);
  const [edgeDrag, setEdgeDrag] = useState(null); // { edgeId, end: "from"|"to", fixedKind, fixedId, x, y } | null
  const [commentsFor, setCommentsFor] = useState(null); // { id, x, y } | null
  const [editingGroupTitleId, setEditingGroupTitleId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [spotlightPeerId, setSpotlightPeerId] = useState(null);
  const [matchIdx, setMatchIdx] = useState(-1);
  const [presentIndex, setPresentIndex] = useState(null); // null = không trình chiếu
  const [designEditId, setDesignEditId] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [decisionTimelineOpen, setDecisionTimelineOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactCardId, setImpactCardId] = useState(null);
  const [playtestsOpen, setPlaytestsOpen] = useState(false);
  const [initialCardParam] = useState(() => new URLSearchParams(window.location.search).get("card"));

  const { user, logout } = useAuth();
  const { boardId } = useParams();
  const [role, setRole] = useState(null);
  const [boardName, setBoardName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const { sendCursor, sendSelection, sendEdgeDraft, sendView, sendFollow, socket } = usePresence(user, boardId);
  const inkLive = useInkLive(socket);
  const laser = useLaser(socket);
  // Kích thước thẻ đo bằng ResizeObserver thay cho querySelector + offsetWidth
  // tại chỗ (xem lib/card-sizes.js). `frameCardSize` giữ nguyên tên cũ vì nó là
  // tham số `sizeOf` của rất nhiều hàm hình học.
  const { cardSize: frameCardSize, observeCard } = useCardSizes();

  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const editDockRef = useRef(null);
  const searchInputRef = useRef(null);
  const saveTimerRef = useRef(null);
  const boardRef = useRef(null);
  // Listener "paste" gắn-một-lần (deps: []) đóng gói `role` lúc mount, khi đó
  // board chưa tải xong nên role vẫn là null — phải đọc qua ref mới đúng.
  const roleRef = useRef(null);
  const editingIdRef = useRef(null);
  // socket.id gửi kèm mỗi lần lưu để server loại chính mình khỏi broadcast
  // board:update; updatedAt của lần lưu/nhận gần nhất để so sánh gói đến
  // sau có mới hơn không (useLiveSync.js: isStaleUpdate).
  const socketRef = useRef(null);
  const lastUpdatedAtRef = useRef(null);
  // Bản board mà ta TIN là server đang giữ. Không phải `board`: board còn chứa
  // những thay đổi mình vừa làm và chưa chắc đã lưu xong. Khi server từ chối một
  // lần lưu vì có người chen vào, đây là mốc để tính "từ lần đồng bộ cuối tới
  // giờ mình đã đổi những gì" rồi đắp đúng chừng ấy lên bản của họ
  // (lib/rebase.js). Cập nhật ở ba chỗ: lúc tải xong, lúc lưu thành công, và
  // lúc áp một board:update của người khác.
  const serverBaseRef = useRef(null);
  // true khi có một cú PUT đang bay. Không cho cú saveNow() thứ hai bay chồng
  // lên: nó sẽ chốt `base`/`baseUpdatedAt` TỪ TRƯỚC khi cú thứ nhất về, nên nếu
  // cú thứ nhất vừa thêm một thẻ (ví dụ dán ảnh) thì `base` của cú thứ hai vẫn
  // chưa biết thẻ đó tồn tại. Khi đó cú thứ hai đụng conflict, rebaseBoard thấy
  // thẻ đó có trên server nhưng không có trong base của mình → tưởng lầm là
  // thẻ CỦA NGƯỜI KHÁC trùng id, tự cấp cho nó một id mới rồi giữ lại CẢ HAI —
  // đúng hiện tượng "dán ảnh xong kéo rộng ra thì hiện thêm 1 ảnh cỡ gốc ở vị
  // trí cũ". Xếp hàng ở đây để `base` luôn phản ánh đúng lần lưu gần nhất của
  // CHÍNH MÌNH trước khi tính delta tiếp.
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const selectedIdsRef = useRef(selectedIds);
  const suppressContextMenuRef = useRef(false);
  const nudgeTimerRef = useRef(null);
  const nudgeBaseRef = useRef(null);
  const spacePanRef = useRef(false);
  // Cử chỉ bấm nhiều lần lên một nét vẽ (2 lần đổi nét liền ↔ nét đứt). Phần
  // việc nằm ở handleViewportClickCapture bên dưới; hai cái ref phải khai ở đây
  // vì component có nhánh `if (!board) return` ở giữa.
  const multiClickRef = useRef(null);
  if (!multiClickRef.current) multiClickRef.current = createMultiClick();
  const clickAnchorRef = useRef(null);
  // Đang giữ chuột trái ở mode Laser. Ref chứ không state: nó đổi ở mỗi lần bấm
  // và chỉ được đọc trong handler chuột, không có gì trên màn hình phụ thuộc nó.
  const laserDownRef = useRef(false);
  const pendingJumpRef = useRef(null);
  const prePresentViewRef = useRef(null);
  // Ngữ cảnh 2d dùng để đo bề rộng chữ, dựng một lần rồi dùng lại.
  // undefined = chưa dò; null = đã dò và môi trường không có canvas 2d.
  const measureCtxRef = useRef(undefined);
  // Bộ đọc sự kiện wheel có NHỚ: điểm tin cậy "đây là touchpad hay nút lăn"
  // sống qua các sự kiện, nên nó không lật qua lật lại giữa một dòng cuộn. Phải
  // là ref, không phải biến trong effect: effect gắn lại khi board tải xong và
  // khi stopFollow đổi, mà mất trí nhớ giữa dòng cuộn là bảng nhảy giữa lia và
  // phóng ngay dưới ngón tay.
  const wheelReaderRef = useRef(null);
  if (!wheelReaderRef.current) wheelReaderRef.current = createWheelReader();

  const ink = useInk({
    tool, penPrefs, boardRef, viewportRef,
    onStrokeDone: commitStroke,
    onEraseDone: commitErase,
    onPick: pickDrawingWhileDrawing,
    onSwapTool: swapPenEraser,
    live: inkLive
  });

  useEffect(() => {
    let cancelled = false;
    // Không reset state ở đây: IdeaMapRoute (main.jsx) truyền key={boardId} nên
    // đổi board là remount hẳn — board/role/past/future/selectedIds đều mới.
    // Reset thủ công chỉ xoá được vài ô state và bỏ sót lịch sử undo.
    getBoard(boardId)
      .then((data) => {
        if (cancelled) return;
        if (initialCardParam && data.nodes.some((n) => n.id === Number(initialCardParam))) {
          pendingJumpRef.current = Number(initialCardParam);
        }
        const { id, name, role: r, updatedAt, ...boardData } = data;
        setRole(r);
        setBoardName(name);
        lastUpdatedAtRef.current = updatedAt;
        // Camera riêng từng người: ưu tiên vị trí đã lưu local của chính
        // trình duyệt này, bỏ qua `view` server trả về (giá trị cũ, không
        // còn được ghi từ khi camera tách riêng — xem lib/camera.js).
        const camera = loadCamera(window.localStorage, boardId);
        // Board cũ chưa có palette → mặc định rỗng, để mọi chỗ đọc board.palette
        // không phải ?? [] khắp nơi.
        const loaded = normalizeGameDesignBoard({ kind: "idea", palette: [], nextPaletteId: 1, drawings: [], nextDrawingId: 1, bg: null, grid: null, pack: null, ...boardData, ...(camera ? { view: camera } : {}) });
        setBoard(loaded);
        serverBaseRef.current = loaded;
      })
      .catch((e) => { if (!cancelled) setLoadError(e.code || "UNKNOWN"); });
    return () => { cancelled = true; };
  }, [boardId]);

  // Mở ô tìm là để gõ ngay, không phải để rồi bấm thêm một cú vào nó. Đặt ở
  // effect chứ không ở toggleSearch: Ctrl+F lúc ô đang đóng thì ô nhập chưa nằm
  // trong cây, không có gì để focus tại thời điểm xử lý phím.
  useEffect(() => {
    if (!searchOpen) return;
    const el = searchInputRef.current;
    if (el) { el.focus(); el.select(); }
  }, [searchOpen]);

  useEffect(() => { savePenPrefs(window.localStorage, penPrefs); }, [penPrefs]);
  useEffect(() => { saveLaserPrefs(window.localStorage, laserPrefs); }, [laserPrefs]);
  useEffect(() => { saveWheelMode(window.localStorage, wheelMode); }, [wheelMode]);
  useEffect(() => { saveCardLevel(window.localStorage, cardLevelPref); }, [cardLevelPref]);

  // Kích thước khung nhìn, để minimap biết vẽ ô "đang xem ở đây" to bằng nào.
  // Giữ trong state chứ không đo lúc render: đo DOM giữa lượt render là ép trình
  // duyệt tính lại layout, mà minimap render lại ở MỌI nhịp lia bảng.
  // ResizeObserver có thể vắng mặt (jsdom trong smoke test) — đo một lần rồi
  // thôi, vẫn đúng vì ở đó cửa sổ không đổi kích thước.
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      // Lùi về cỡ cửa sổ khi đo ra 0: khung nhìn vốn phủ kín cửa sổ, mà môi
      // trường không có layout thật (jsdom) trả về đúng 0×0 — không có bước lùi
      // này thì minimap không bao giờ dựng được ở đó.
      const w = r.width || window.innerWidth;
      const h = r.height || window.innerHeight;
      setViewportSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board != null]);

  // Camera đổi từ nhiều chỗ (lăn chuột, kéo nền, zoom vừa khung, thoát trình
  // chiếu). Lưu ở một effect theo board.view — rải saveCamera vào từng handler
  // thì sót, mà `view` cũng không còn được PUT lên server nữa (api.js bỏ nó).
  // Hoãn một nhịp: lăn chuột đổi view liên tục.
  useEffect(() => {
    if (!board?.view) return;
    const id = setTimeout(() => saveCamera(window.localStorage, boardId, board.view), 200);
    return () => clearTimeout(id);
  }, [board?.view, boardId]);

  // Gán ngay trong lúc render, không qua useEffect: các handler kéo đọc
  // boardRef.current để biết trạng thái MỚI NHẤT, mà effect thì chạy sau khi
  // render xong — có một khoảng ref còn giữ board của lượt trước, đủ để một
  // phép tính kéo hoặc một gói realtime lấy nhầm toạ độ cũ.
  boardRef.current = board;
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { sendSelection(Array.from(selectedIds)); }, [selectedIds, sendSelection]);
  useEffect(() => {
    const draft = linkDraft
      ? { fromKind: linkDraft.fromKind || "node", fromId: linkDraft.fromId, x: linkDraft.x, y: linkDraft.y }
      : edgeDrag
      ? { fromKind: edgeDrag.fixedKind, fromId: edgeDrag.fixedId, x: edgeDrag.x, y: edgeDrag.y }
      : null;
    sendEdgeDraft(draft);
  }, [linkDraft, edgeDrag, sendEdgeDraft]);

  // Đường ghi camera dành RIÊNG cho vòng bám khi ghim màn hình. Cố ý không đi
  // qua setCamera: setCamera là "người dùng chủ động đổi camera" nên nó huỷ
  // ghim, mà vòng bám cũng đổi camera — dùng chung một cửa thì vòng bám tự huỷ
  // mình ngay khung hình đầu tiên.
  const applyFollowCamera = useCallback((view) => {
    setBoard((prev) => (prev ? { ...prev, view: { ...prev.view, ...view } } : prev));
  }, []);

  const { followingId, pendingId, followError, watcherCount, follow, stopFollow } = useFollow({
    socket, sendFollow, viewportSize,
    applyCamera: applyFollowCamera,
    minScale: MIN_SCALE, maxScale: MAX_SCALE
  });

  // Chỉ phát camera khi THỰC SỰ có người đang xem. Ghim là tính năng dùng theo
  // đợt (lúc họp), nên mặc định phải là im lặng tuyệt đối: không ai ghim thì
  // không một gói nào rời máy, dù người dùng có cuộn cả buổi.
  useEffect(() => {
    if (!board || watcherCount === 0) return;
    // Kích thước khung nhìn đi kèm camera, vì người xem cần biết mình đang thấy
    // VÙNG nào chứ không phải pan/zoom bao nhiêu — hai màn hình khác cỡ thì hai
    // con số đó nghĩa khác nhau (lib/follow.js).
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return;
    sendView({
      panX: board.view.panX, panY: board.view.panY, scale: board.view.scale,
      w: viewportSize.w, h: viewportSize.h
    });
  }, [board?.view, viewportSize, watcherCount, sendView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overlay nào đã được board thật bắt kịp phải bỏ NGAY. Giữ lại nghĩa là tiếp
  // tục vẽ một bản tạm đè lên dữ liệu thật vừa nhận — nét nhấp nháy.
  const applyRemoteBoard = useCallback((next) => {
    const normalized = normalizeGameDesignBoard(next);
    setBoard(normalized);
    // Vừa áp bản của người khác → đó là bản mới nhất ta biết server đang giữ.
    // Thiếu dòng này thì lần va chạm sau sẽ tính delta từ một mốc quá cũ và đắp
    // lại cả những thay đổi đã được lưu từ lâu.
    serverBaseRef.current = normalized;
    inkLive.reconcile(normalized);
  }, [inkLive.reconcile]);

  const { geomOverlay, textOverlay, sendLiveText, publishGeom, finishGeom } =
    useLiveSync(socket, boardRef, editingIdRef, lastUpdatedAtRef, applyRemoteBoard);

  // Toạ độ dùng để VẼ: board thật + vị trí tạm của người khác đang kéo. Mọi thứ
  // hiển thị (thẻ, khung, dây, tay cầm dây) phải đọc từ đây, còn handler tương
  // tác vẫn đọc `board` gốc — nếu không, phép tính kéo sẽ lấy vị trí tạm của
  // người khác làm mốc.
  const liveNodes = useMemo(
    () => (board ? applyGeomOverlay(board.nodes, geomOverlay, "node:") : EMPTY_ARRAY),
    [board, geomOverlay]
  );
  const liveGroups = useMemo(
    () => (board ? applyGeomOverlay(board.groups, geomOverlay, "group:") : EMPTY_ARRAY),
    [board, geomOverlay]
  );
  // Chỉ mục tra cứu O(1) cho lớp dây và lớp peer. Trước đây mỗi đầu dây quét
  // lại cả mảng thẻ ở mỗi lần render: bảng 150 cạnh × 100 thẻ là 30.000 phép so
  // sánh cho một khung hình, nhân với 60 khung hình mỗi giây lúc kéo.
  const nodeById = useMemo(() => new Map(liveNodes.map((n) => [n.id, n])), [liveNodes]);
  const groupById = useMemo(() => new Map(liveGroups.map((g) => [g.id, g])), [liveGroups]);
  const statusDefById = useMemo(
    () => (board ? new Map(board.statuses.map((s) => [s.id, s])) : EMPTY_MAP),
    [board?.statuses]
  );
  const tagDefById = useMemo(
    () => (board ? new Map(board.tags.map((tg) => [tg.id, tg])) : EMPTY_MAP),
    [board?.tags]
  );
  // Dependency chỉ là một lớp thông tin dẫn đường trên canvas: giữ phân tích
  // thuần theo snapshot board để card, dây và dock luôn nói cùng một sự thật.
  const dependency = useMemo(
    () => (board?.kind === "game-design" ? dependencyAnalysis(board) : null),
    [board]
  );
  const paletteStyle = useMemo(() => paletteCss(board?.palette ?? EMPTY_ARRAY), [board?.palette]);

  // Text đang kéo vẽ ở vị trí NHÁP, board vẫn giữ vị trí cũ cho tới lúc nhả
  // chuột. Cùng cách applyGeomOverlay phủ vị trí thẻ của người khác lên board.
  // Đồng bộ ref với state ở mỗi lượt vẽ. Đặt trong thân component (không phải
  // effect) để nó đúng NGAY trong lượt đó: handler mousedown có thể chạy trước
  // khi effect kịp chạy.
  textEditRef.current = textEdit;

  const inkDrawings = useMemo(() => {
    const list = board?.drawings ?? EMPTY_ARRAY;
    const dragged = !textDrag
      ? list
      : list.map((d) => (d.id === textDrag.id ? { ...d, pts: [textDrag.x, textDrag.y] } : d));
    // Nét người KHÁC đang dời / co giãn / sửa hình. Đắp ở đây chứ không trong
    // InkLayer, để đối xứng với liveNodes/liveGroups: mọi thứ hiển thị đọc từ
    // bản đã đắp overlay, còn handler tương tác vẫn đọc `board` gốc.
    return applyInkMoves(dragged, inkLive.liveStrokes);
  }, [board?.drawings, textDrag, inkLive.liveStrokes]);

  // Trạng thái HIỆN TẠI của các nét đang bị thao tác, dạng gói live. Chỉ mang
  // phần hình học — kiểu dáng thì người nhận đã có trong board của họ.
  function movingPayload(b, ids) {
    const out = [];
    for (const d of b?.drawings || []) {
      if (!ids.has(d.id)) continue;
      const m = { id: d.id, pts: d.pts };
      // kind chỉ đổi khi kéo tay cầm một góc; gửi luôn cho mọi nét thì gói to ra
      // vô ích, nên chỉ gửi khi nó thật sự khác bản người nhận đang có... mà
      // "bản người nhận đang có" thì mình không biết. Gửi cho hình khối là đủ:
      // nét bút và chữ không bao giờ đổi kind.
      if (d.kind && d.kind !== "pen" && d.kind !== "text") m.kind = d.kind;
      if (d.kind === "text") {
        if (Number.isFinite(d.size)) m.size = d.size;
        if (Number.isFinite(d.w)) m.w = d.w;
        if (Number.isFinite(d.h)) m.h = d.h;
      }
      out.push(m);
    }
    return out;
  }

  // Vùng chọn gói lại thành MỘT object để truyền xuống lib/selection-box.js —
  // ba Set rời nhau là ba tham số phải bê theo qua từng hàm.
  const selectionSet = useMemo(
    () => ({ nodeIds: selectedIds, groupIds: selectedGroupIds, drawingIds: selectedDrawingIds }),
    [selectedIds, selectedGroupIds, selectedDrawingIds]
  );

  // Hộp bao của cả vùng chọn. Có nó thì: cầm chỗ nào TRONG vùng cũng kéo được cả
  // cụm (không phải nhắm đúng vào một cái thẻ hay một cái nét), thả màu vào chỗ
  // trống trong vùng là cả cụm đổi màu, và bốn góc trở thành tay cầm co giãn.
  //
  // Phụ thuộc cả `frameCardSize`: chiều cao thẻ do ResizeObserver đo, thẻ vừa
  // được đo lại (ảnh tải xong, chữ xuống dòng) thì hộp phải ôm lại theo.
  const selBounds = useMemo(
    () => selectionBounds(board, selectionSet, frameCardSize),
    [board?.nodes, board?.groups, board?.drawings, selectionSet, frameCardSize]
  );

  // Hình đang được sửa từng góc/cạnh: chọn ĐÚNG MỘT hình khối, không kèm thẻ hay
  // khung nào. Chỉ một hình mới có tay cầm — chọn hai hình thì tay cầm của chúng
  // chen vào nhau và không ai biết cái nào của cái nào; ở đó việc cần làm là kéo
  // cả cụm, mà hộp bao vùng chọn đã lo (xem selBounds).
  const editShape = useMemo(() => {
    if (!board || selectedDrawingIds.size !== 1) return null;
    if (selectedIds.size || selectedGroupIds.size) return null;
    const id = Array.from(selectedDrawingIds)[0];
    const d = (board.drawings || []).find((x) => x.id === id);
    if (!d) return null;
    const handles = shapeHandles(d);
    return handles.length ? { d, handles } : null;
  }, [board?.drawings, selectedDrawingIds, selectedIds, selectedGroupIds]);

  // Hình khối cho minimap. Tính lại khi NỘI DUNG đổi, không phải khi camera đổi:
  // lia bảng là chuyện xảy ra liên tục, mà lia thì mấy cái hộp này không hề khác.
  const miniShapes = useMemo(
    () => (board ? rectsOf(board, CARD_W, drawingBox) : null),
    [board?.nodes, board?.groups, board?.drawings]
  );

  // Nền và bộ màu là DỮ LIỆU BOARD, nhưng thuộc tính lại đặt trên <html> — cùng
  // chỗ với data-theme (thiết lập của người dùng). Hai lý do: chip nhãn/trạng
  // thái nằm trong đảo to, ngoài .viewport, mà vẫn phải đổi màu theo bộ màu;
  // và exportPng() đang đọc getComputedStyle của documentElement, để ở đây thì
  // nó không phải đổi cách lấy giá trị.
  useEffect(() => {
    const el = document.documentElement;
    // Lọc trước khi đặt: giá trị này có thể tới từ "Nhập JSON", không phải lúc
    // nào cũng từ cú bấm trong panel.
    const bg = isBoardBg(board?.bg) ? board?.bg : null;
    const grid = isBoardGrid(board?.grid) ? board?.grid : null;
    const pack = isColorPack(board?.pack) ? board?.pack : null;
    if (bg) el.setAttribute("data-bg", bg); else el.removeAttribute("data-bg");
    if (grid) el.setAttribute("data-grid", grid); else el.removeAttribute("data-grid");
    if (pack) el.setAttribute("data-pack", pack); else el.removeAttribute("data-pack");
    // Gỡ khi rời trang: sang danh sách board mà còn nền của board vừa xem thì
    // trông như lỗi hiển thị.
    return () => {
      el.removeAttribute("data-bg");
      el.removeAttribute("data-grid");
      el.removeAttribute("data-pack");
    };
  }, [board?.bg, board?.grid, board?.pack]);

  // Bộ lọc dựng MỘT lần cho mỗi lần đổi điều kiện, thay vì tính lại
  // Object.keys(...).filter(...) bên trong mỗi thẻ ở mỗi lần render.
  const passesFilter = useMemo(() => {
    const statusKeys = Object.keys(filterStatus).filter((k) => filterStatus[k]);
    const tagKeys = Object.keys(filterTags).filter((k) => filterTags[k]);
    const q = search.trim().toLowerCase();
    return function passes(node) {
      if (statusKeys.length && !filterStatus[node.statusId == null ? "none" : String(node.statusId)]) return false;
      if (tagKeys.length && !filterTags[node.tagId == null ? "none" : String(node.tagId)]) return false;
      if (filterFav && !(node.favorites?.length > 0)) return false;
      if (q && (node.title + " " + node.desc).toLowerCase().indexOf(q) === -1) return false;
      return true;
    };
  }, [filterStatus, filterTags, filterFav, search]);

  const focusSet = useMemo(() => {
    if (!board || focusId == null || !board.nodes.some((n) => n.id === focusId)) return null;
    // BFS ≤2 hop trên edge node↔node (bỏ qua edge dính group)
    const adj = new Map();
    board.edges.forEach((e) => {
      if ((e.fromKind || "node") !== "node" || (e.toKind || "node") !== "node") return;
      if (!adj.has(e.from)) adj.set(e.from, []);
      if (!adj.has(e.to)) adj.set(e.to, []);
      adj.get(e.from).push(e.to);
      adj.get(e.to).push(e.from);
    });
    const seen = new Set([focusId]);
    let frontier = [focusId];
    for (let hop = 0; hop < 2; hop++) {
      const nextFrontier = [];
      frontier.forEach((id) => (adj.get(id) || []).forEach((nb) => {
        if (!seen.has(nb)) { seen.add(nb); nextFrontier.push(nb); }
      }));
      frontier = nextFrontier;
    }
    return seen;
  }, [board?.nodes, board?.edges, focusId]);

  const matches = useMemo(
    () => (board ? board.nodes.filter(passesFilter).sort((a, b) => a.y - b.y || a.x - b.x) : EMPTY_ARRAY),
    [board?.nodes, passesFilter]
  );

  // Điều kiện để React.memo trên IdeaCard/FrameBox/EdgeLayer có tác dụng: prop
  // hàm phải giữ nguyên định danh giữa các lần render. Các hàm xử lý thật thì
  // được định nghĩa lại ở mỗi lần render (chúng đóng gói `board`, `selectedIds`
  // …), nên ta cất bản mới nhất vào một ref và cho component nhận một lớp vỏ
  // bất biến gọi xuyên qua ref. Không có lớp vỏ này, kéo MỘT thẻ vẫn dựng lại
  // toàn bộ thẻ, khung và dây trên bảng ở từng khung hình.
  const actionsRef = useRef({});
  const cardHandlers = useMemo(() => ({
    mouseDown: (e, id) => actionsRef.current.nodeMouseDown(e, id),
    click: (id) => actionsRef.current.cardClick(id),
    contextMenu: (e, id) => actionsRef.current.openColorMenu(e, "card", id),
    connectorMouseDown: (e, id, direction) => actionsRef.current.connectorMouseDown(e, id, direction),
    edit: (id) => setEditingId(id),
    cancelEdit: () => setEditingId(null),
    remove: (id) => actionsRef.current.deleteNode(id),
    toggleFavorite: (id) => actionsRef.current.toggleFavorite(id),
    openComments: (e, id) => actionsRef.current.openComments(e, id),
    liveText: (id, field, value) => actionsRef.current.liveText(id, field, value),
    save: (id, fields) => actionsRef.current.saveNodeEdit(id, fields),
    saveAndNext: (id, fields) => actionsRef.current.saveNodeEditAndNext(id, fields),
    dropImage: (e, id) => actionsRef.current.dropImage(e, id),
    removeImage: (id) => actionsRef.current.removeImage(id),
    imageResize: (e, id) => actionsRef.current.imageResize(e, id),
    pdfResize: (e, id) => actionsRef.current.pdfResize(e, id)
  }), []);
  const groupHandlers = useMemo(() => ({
    mouseDown: (e, id) => actionsRef.current.groupMouseDown(e, id),
    contextMenu: (e, id) => actionsRef.current.openColorMenu(e, "group", id),
    remove: (id) => actionsRef.current.deleteGroup(id),
    editTitle: (id) => setEditingGroupTitleId(id),
    cancelTitle: () => setEditingGroupTitleId(null),
    saveTitle: (id, title) => actionsRef.current.saveGroupTitle(id, title),
    resizeMouseDown: (e, id) => actionsRef.current.groupResizeMouseDown(e, id),
    connectorMouseDown: (e, id) => actionsRef.current.groupConnectorMouseDown(e, id)
  }), []);
  const onEdgeEnter = useMemo(() => (id) => setHoveredEdgeId(id), []);
  const onEdgeLeave = useMemo(() => (id) => setHoveredEdgeId((cur) => (cur === id ? null : cur)), []);
  // Chuột TRÁI trên dây = chọn, y như bấm vào thẻ: một mình nó, hoặc Ctrl để
  // cộng dồn. Chuột PHẢI mới mở menu sửa dây — cùng luật với thẻ và khung, nên
  // không phải nhớ riêng cho dây một kiểu bấm khác.
  const onEdgeClick = useMemo(() => (e, id) => {
    setColorMenu(null);
    setCommentsFor(null);
    setEdgeMenu(null);
    setDesignEditId(null);
    if (e.ctrlKey || e.metaKey) {
      setSelectedEdgeIds((prev) => toggleId(prev, id));
      return;
    }
    setSelectedEdgeIds(new Set([id]));
    setSelectedIds(EMPTY_SET);
    setSelectedGroupIds(EMPTY_SET);
    setSelectedDrawingIds(EMPTY_SET);
  }, [board?.kind]);

  const onEdgeContextMenu = useMemo(() => (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setColorMenu(null);
    setCommentsFor(null);
    if (board?.kind === "game-design") {
      setDesignEditId(null);
      setSelectedEdgeIds(new Set([id]));
      setSelectedIds(EMPTY_SET);
      setSelectedGroupIds(EMPTY_SET);
      setSelectedDrawingIds(EMPTY_SET);
      setEdgeMenu(null);
      return;
    }
    setEdgeMenu({ id, x: e.clientX, y: e.clientY });
  }, [board?.kind]);

  // Chip danh tính được render ở AuthGate, ngoài `.shell`, nên selector
  // `.shell.presenting` không với tới được. Đánh dấu trên body để ẩn nó khi
  // trình chiếu, giống mọi thứ chrome khác của board.
  useEffect(() => {
    document.body.classList.toggle("presenting", presentIndex != null);
    return () => document.body.classList.remove("presenting");
  }, [presentIndex]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const want = selectedIds.size === 1 ? String(Array.from(selectedIds)[0]) : null;
    const have = url.searchParams.get("card");
    if (want === have) return;
    if (want != null) url.searchParams.set("card", want);
    else url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  }, [selectedIds]);

  useEffect(() => {
    if (!board || pendingJumpRef.current == null) return;
    const id = pendingJumpRef.current;
    pendingJumpRef.current = null;
    setSelectedIds(new Set([id]));
    setFlashId(id);
    zoomToNodes([id]);
    setTimeout(() => setFlashId(null), 1600);
  }, [board != null]);

  useEffect(() => { setMatchIdx(-1); }, [search]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function wheelHandler(e) {
      // Dock/phần panel có vùng cuộn riêng: nếu canvas bắt wheel ở đây rồi
      // preventDefault thì scrollbar vẫn hiện nhưng người dùng không thể cuộn
      // form. Mọi panel nổi đều cùng luật này — di chuột trên panel chỉ cuộn
      // nội dung của nó, không lia/zoom sa bàn nằm dưới.
      if (e.target.closest(".outline-panel, .io-drawer, .tree-panel, .edit-dock")) return;
      e.preventDefault();
      const current = boardRef.current;
      if (!current) return;
      // Cuộn/zoom là người dùng tự lái camera → thôi bám theo người khác.
      stopFollow();
      // MỘT chỗ duy nhất quyết định "cú này là lia hay là phóng": lib/pointer-input.js.
      // Trước đây chỗ này tự xử, và nó xử cùng một kiểu cho nút lăn với touchpad —
      // nên trên laptop chỉ trượt nhẹ hai ngón là bảng phóng to vọt lên. Xem ghi
      // chú đầu file đó về từng dấu hiệu nhận thiết bị.
      const cmd = wheelReaderRef.current.read(e, wheelMode);
      if (cmd.intent === "pan") {
        const next = {
          ...current,
          view: { ...current.view, panX: current.view.panX - cmd.dx, panY: current.view.panY - cmd.dy }
        };
        setBoard(next);
        return;
      }
      setBoard(computeZoom(current, el.getBoundingClientRect(), e.clientX, e.clientY, cmd.factor));
    }
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
    // stopFollow là useCallback ổn định (chỉ phụ thuộc sendFollow, cũng ổn
    // định), nên thêm vào deps không làm listener gắn lại thêm lần nào.
    // Re-chạy khi board tải xong: lúc mount đầu board còn null nên viewport
    // chưa render (return "Đang tải…"), viewportRef.current == null và listener
    // sẽ không được gắn nếu chỉ phụ thuộc [].
    // wheelMode chỉ đổi khi người dùng bấm trong panel Giao diện — gắn lại
    // listener khi đó thì rẻ, và rẻ hơn hẳn một ref nữa phải đồng bộ tay.
  }, [board != null, stopFollow, wheelMode]);

  // Đọc roleRef chứ không đọc `role`: saveNow là chốt chặn cuối, nó phải đúng kể
  // cả khi được gọi từ một closure cũ. Handler nào gắn với deps [] (listener
  // paste, .then() của readImageFile…) đóng gói `role` lúc mount — khi đó board
  // chưa tải xong nên role vẫn null và chốt chặn sẽ hở. Ref thì luôn mới.
  // Trần số lần ghép lại. Mỗi vòng đều tiến (mốc mới hơn, delta nhỏ đi), nên
  // chạm trần nghĩa là có ai đó đang lưu liên tục nhanh hơn mình — lúc đó đi
  // đường dự phòng còn hơn quay vòng mãi.
  const MAX_REBASE_TRIES = 3;

  // Cú lưu hiện tại (kể cả các vòng ghép lại của riêng nó) vừa xong — cho nó
  // chạy tiếp cú đang xếp hàng, nếu có, với `base` giờ đã mới nhất.
  function settleSave() {
    savingRef.current = false;
    if (pendingSaveRef.current == null) return;
    const queued = pendingSaveRef.current;
    pendingSaveRef.current = null;
    saveNow(queued);
  }

  function saveNow(next, tries = 0) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (roleRef.current === "viewer") return;
    // Đang có một cú PUT bay (kể cả đang ghép lại): không bắn cú mới đè lên nó.
    // `base` chốt bên dưới sẽ là bản NGAY LÚC NÀY, mà cú đang bay có thể sắp
    // thêm một thẻ mà `base` chưa biết — bắn chồng lên là hạt giống của đúng
    // bug "dán ảnh rồi kéo rộng ra thì hiện thêm 1 ảnh cỡ gốc ở vị trí cũ" (xem
    // ghi chú ở savingRef). Chỉ giữ lại BẢN MỚI NHẤT cần lưu; những state ở giữa
    // không cần lưu riêng.
    if (tries === 0) {
      if (savingRef.current) { pendingSaveRef.current = next; return; }
      savingRef.current = true;
    }
    // Mốc và bản nền được CHỐT ngay đây, trước khi cú PUT rời máy: nếu đọc lại ở
    // trong .catch thì lúc đó chúng có thể đã bị một gói board:update chen vào
    // sửa mất, và delta sẽ tính từ nhầm mốc.
    const base = serverBaseRef.current;
    const baseUpdatedAt = lastUpdatedAtRef.current;
    saveBoard(boardId, next, socketRef.current?.id, baseUpdatedAt)
      .then((res) => {
        lastUpdatedAtRef.current = res.updatedAt;
        serverBaseRef.current = next;
        setSaveError(null);
        settleSave();
      })
      .catch((e) => {
        if (e.code !== "CONFLICT") { setSaveError(true); settleSave(); return; }
        // Có người lưu chen vào giữa. Bản của họ đi kèm ngay trong lỗi; đắp
        // những gì mình đã đổi (base → next) lên đó rồi lưu lại.
        const server = e.board;
        const rebased = server ? rebaseBoard(server, base, next) : null;
        if (!rebased || tries >= MAX_REBASE_TRIES) {
          // Đường dự phòng = đúng hành vi trước khi có chốt này: ghi đè. Không
          // đẹp, nhưng nó bảo đảm việc thêm chốt không bao giờ làm mọi thứ TỆ
          // HƠN trước — trường hợp xấu nhất chỉ là quay về mức cũ.
          // Tới đây nghĩa là ghép ra một board không lành lặn (id trùng, dây mất
          // đầu) hoặc đã thử quá số lần.
          saveBoard(boardId, next, socketRef.current?.id)
            .then((res) => {
              lastUpdatedAtRef.current = res.updatedAt;
              serverBaseRef.current = next;
              setSaveError(null);
              settleSave();
            })
            .catch(() => { setSaveError(true); settleSave(); });
          return;
        }
        // Giữ nguyên camera của mình và giữ nguyên đúng cái thẻ đang gõ dở —
        // cùng luật với lúc áp một board:update, nên không có hai cách trộn
        // khác nhau để lệch nhau.
        const local = boardRef.current;
        const merged = normalizeGameDesignBoard(local ? mergeRemoteBoard(local, rebased, editingIdRef.current) : rebased);
        lastUpdatedAtRef.current = server.updatedAt;
        serverBaseRef.current = server;
        setBoard(merged);
        boardRef.current = merged;
        inkLive.reconcile(merged);
        saveNow(merged, tries + 1);
      });
  }

  function saveDebounced(next) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNow(next), 500);
  }

  async function openSnapshots() {
    setSnapshotsOpen(true);
    setSnapshotsLoading(true);
    try {
      const result = await listBoardSnapshots(boardId);
      setSnapshots(result.snapshots || []);
    } catch {
      setSaveError(true);
    } finally {
      setSnapshotsLoading(false);
    }
  }

  async function createSnapshot(label) {
    try {
      const result = await createBoardSnapshot(boardId, label);
      setSnapshots((current) => [result.snapshot, ...current].slice(0, 30));
      setSaveError(null);
    } catch (error) {
      setSaveError(true);
      throw error;
    }
  }

  async function restoreSnapshot(snapshotId) {
    try {
      const result = await restoreBoardSnapshot(boardId, snapshotId);
      const restored = normalizeGameDesignBoard({ ...result.board, view: boardRef.current?.view });
      setBoard(restored);
      boardRef.current = restored;
      serverBaseRef.current = restored;
      lastUpdatedAtRef.current = restored.updatedAt;
      setPast([]);
      setFuture([]);
      inkLive.reconcile(restored);
      setSaveError(null);
    } catch (error) {
      setSaveError(true);
      throw error;
    }
  }

  const MAX_HISTORY = 50;
  function recordHistoryRaw(prevBoard) {
    setPast((p) => {
      const nextPast = [...p, prevBoard];
      return nextPast.length > MAX_HISTORY ? nextPast.slice(nextPast.length - MAX_HISTORY) : nextPast;
    });
    setFuture([]);
  }

  function flushNudgeBurst() {
    if (nudgeBaseRef.current == null) return;
    const base = nudgeBaseRef.current;
    nudgeBaseRef.current = null;
    if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
    recordHistoryRaw(base);
  }

  function recordHistory(prevBoard) {
    flushNudgeBurst();
    recordHistoryRaw(prevBoard);
  }

  function commitAndSave(next, opts) {
    if (!opts || opts.historical !== false) recordHistory(board);
    setBoard(next);
    saveNow(next);
  }

  // Hoàn tác / làm lại chỉ trả lại NỘI DUNG bảng, KHÔNG trả lại chỗ đang xem.
  //
  // `view` (pan + zoom) nằm chung trong board vì nó cũng được lưu lên server,
  // nhưng nó không phải thứ vừa được sửa — nó là chỗ mình đang đứng nhìn. Trả
  // lại nó cùng với nội dung thì lùi một bước là màn hình nhảy về chỗ đứng lúc
  // làm việc đó, và người dùng mất phương hướng đúng vào lúc cần nhìn rõ nhất
  // cái vừa bị lùi. Lùi vài bước liên tiếp thì mỗi bước nhảy một chỗ.
  //
  // Áp cho cả `undo` lẫn `redo`, và cả nhánh gộp phím mũi tên — ba đường vào
  // cùng một chỗ ra, không để đường nào sót lại hành vi cũ.
  function keepView(snapshot) {
    return board?.view ? { ...snapshot, view: board.view } : snapshot;
  }

  function undo() {
    if (nudgeBaseRef.current != null) {
      const base = keepView(nudgeBaseRef.current);
      nudgeBaseRef.current = null;
      if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
      setFuture((f) => [board, ...f]);
      setEditingId(null);
      setBoard(base);
      saveNow(base);
      return;
    }
    if (past.length === 0) return;
    const prev = keepView(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [board, ...f]);
    setEditingId(null);
    setBoard(prev);
    saveNow(prev);
  }

  function redo() {
    if (nudgeBaseRef.current != null) { flushNudgeBurst(); return; }
    if (future.length === 0) return;
    const nextState = keepView(future[0]);
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, board]);
    setEditingId(null);
    setBoard(nextState);
    saveNow(nextState);
  }

  useEffect(() => {
    function onKeyDown(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      const key = e.key.toLowerCase();
      // Đang trình chiếu: ←/→/Esc được ưu tiên, mọi phím tắt khác tạm tắt.
      if (presentIndex != null) {
        if (key === "arrowright") { e.preventDefault(); stepPresentation(1); }
        else if (key === "arrowleft") { e.preventDefault(); stepPresentation(-1); }
        else if (key === "escape") { exitPresentation(); }
        // `k` là ngoại lệ duy nhất trong danh sách phím tắt bị tắt khi trình
        // chiếu, vì đang trình chiếu MỚI là lúc cần cây laser nhất. Nó cũng
        // không đụng gì tới slide: chỉ đổi mode, không ghi, không lia bảng.
        else if (key === "k") { e.preventDefault(); enterMode(mode === "laser" ? "select" : "laser"); }
        return;
      }
      // Undo/redo/nhân bản đều ghi dữ liệu. Với người chỉ xem chúng không lưu
      // được (saveNow chặn) nhưng vẫn làm thẻ nhảy trên màn hình rồi biến mất
      // khi tải lại — nên chặn thẳng ở đây.
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+F chỉ dời con trỏ vào ô tìm kiếm, không ghi gì — người chỉ xem
        // vẫn phải dùng được, nên xử lý TRƯỚC guard viewer bên dưới.
        if (key === "f") {
          e.preventDefault();
          setSearchOpen(true);
          // Đang mở sẵn thì focus ngay tại đây; đang đóng thì ô nhập chưa có
          // trong cây, useEffect theo `searchOpen` bên dưới lo nốt.
          const el = searchInputRef.current;
          if (el) { el.focus(); el.select(); }
          return;
        }
        if (role === "viewer") return;
        if (key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
        else if (key === "z") { e.preventDefault(); undo(); }
        else if (key === "y") { e.preventDefault(); redo(); }
        else if (key === "d") { e.preventDefault(); duplicateSelection(); }
        return;
      }
      if (key === "delete" || key === "backspace") {
        if (role === "viewer") return;
        e.preventDefault();
        deleteSelection();
      }
      else if (key === "escape") {
        if (mode === "draw" || mode === "place" || mode === "laser") enterMode("select");
        else if (colorMenu) setColorMenu(null);
        else if (badgeUI) setBadgeUI(null);
        else if (edgeMenu) setEdgeMenu(null);
        else if (commentsFor) setCommentsFor(null);
        else if (linkMode) { setLinkMode(false); setPendingSource(null); }
        else if (focusId != null) setFocusId(null);
        else if (selectedIds.size > 0 || selectedEdgeIds.size > 0 || selectedGroupIds.size > 0 || selectedDrawingIds.size > 0) clearSelection();
      }
      // Enter trên thẻ đang chọn = tạo thẻ con bên phải, Shift+Enter = tạo thẻ
      // cùng cấp bên dưới. Handler đã thoát sớm khi con trỏ nằm trong
      // input/textarea, nên thẻ đang mở ô sửa không rơi vào đây.
      else if (key === "enter") {
        if (role === "viewer") return;
        if (editingId != null || selectedIds.size !== 1) return;
        if (colorMenu || badgeUI || edgeMenu || commentsFor) return;
        e.preventDefault();
        const [id] = selectedIds;
        if (e.shiftKey) createSiblingNode(id);
        else createLinkedNode(id, "right");
      }
      // `n` không còn thả thẳng một thẻ ra giữa màn hình: nó lên nòng nút "thêm
      // ý tưởng" y như bấm nút đó, rồi chờ bấm chỉ chỗ. Shift+N lên nòng luôn ở
      // bậc 1 (thẻ gốc) — thay cho nút "thêm thẻ gốc" đã rời khỏi khu 3.
      else if (key === "n") {
        if (role === "viewer") return;
        e.preventDefault();
        // Shift+N luôn LÊN nòng, không bao giờ hạ: nó mang thêm ý "đổi sang bậc
        // 1", nên bấm nó lúc đang lên nòng sẵn mà lại tắt đi là ngược ý.
        if (e.shiftKey) { setCardLevelPref(1); setPlaceTool("node"); enterMode("place"); }
        else armPlace("node");
      }
      // v chỉ đổi mode, không ghi gì — người chỉ xem vẫn dùng được.
      else if (key === "v") { e.preventDefault(); enterMode("select"); }
      // `p` = Pen. Trước đây là `b` (brush) — đổi vì tool này tên là Bút.
      else if (key === "p") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("pen"); }
      else if (key === "e") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("eraser"); }
      else if (key === "s") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("shape"); }
      else if (key === "t") { if (role === "viewer") return; e.preventDefault(); enterMode("draw"); setTool("text"); }
      else if (key === "l") { if (role === "viewer") return; e.preventDefault(); toggleLinkMode(); }
      // `k` — chữ cái Excalidraw dùng cho laser. Bấm lần nữa là tắt: laser là
      // thứ bật lên trong dăm câu nói rồi tắt, khác bút (chọn xong vẽ cả buổi),
      // nên nó cần một phím BẬT/TẮT chứ không phải một phím chọn.
      // Không có chốt viewer: laser không ghi gì vào board.
      else if (key === "k") { e.preventDefault(); enterMode(mode === "laser" ? "select" : "laser"); }
      // `f` (vừa khung theo lựa chọn) chỉ đổi view — người chỉ xem vẫn dùng được.
      else if (key === "f") { e.preventDefault(); zoomToSelection(); }
      else if (key === "arrowleft") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(e.shiftKey ? -10 : -1, 0); }
      else if (key === "arrowright") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(e.shiftKey ? 10 : 1, 0); }
      else if (key === "arrowup") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(0, e.shiftKey ? -10 : -1); }
      else if (key === "arrowdown") { if (role === "viewer") return; e.preventDefault(); nudgeSelection(0, e.shiftKey ? 10 : 1); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // selectedDrawingIds PHẢI có trong danh sách này: chọn riêng mấy nét vẽ mà
    // không đụng tới thẻ/khung thì effect không chạy lại, và handler còn giữ
    // closure của lượt render cũ — Delete sẽ đọc một vùng chọn rỗng và không
    // xoá gì. Cùng lý do với mọi state khác trong hàm này.
  }, [board, past, future, selectedIds, selectedEdgeIds, selectedGroupIds, selectedDrawingIds, linkMode, colorMenu, badgeUI, edgeMenu, commentsFor, focusId, presentIndex, role, editingId, mode, placeTool]);

  useEffect(() => {
    function down(e) {
      if (e.code !== "Space") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      e.preventDefault();            // chặn page scroll
      spacePanRef.current = true;
    }
    function up(e) { if (e.code === "Space") spacePanRef.current = false; }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Ảnh dán/thả vào thẻ: applyImageToNode phải đọc boardRef.current (không phải
  // `board`) vì nó được gọi từ readImageFile().then() bên trong listener "paste"
  // gắn-một-lần (deps: []), nơi `board` luôn là giá trị đóng gói lúc mount (stale).
  // commitAndSave cũng không dùng được ở đây vì nó tự gọi recordHistory(board) —
  // cùng vấn đề đóng gói cũ; nên trình tự ghi lịch sử/lưu được lặp lại thủ công.
  // Một board là một document MongoDB, trần 16MB. Ảnh giữ nguyên chất lượng gốc
  // nên trần đó với tới được — báo ngay tại chỗ dán, đừng để cú lưu chết ở server
  // rồi người dùng chỉ thấy "không lưu được".
  function imageFitsBoard(dataUrl, replaceNodeId = null) {
    const current = boardRef.current;
    if (!current) return false;
    const check = canAddImage(current.nodes, dataUrl, replaceNodeId);
    if (check.ok) return true;
    window.alert(t`Ảnh này ${formatMB(check.adding)}MB, mà bảng đã dùng ${formatMB(check.used)}MB trên ${formatMB(check.budget)}MB dành cho ảnh. Xoá bớt ảnh cũ hoặc tách sang board khác.`);
    return false;
  }

  function applyImageToNode(nodeId, dataUrl) {
    const current = boardRef.current;
    if (!current) return;
    if (!current.nodes.some((n) => n.id === nodeId)) return;
    if (!imageFitsBoard(dataUrl, nodeId)) return;
    const next = { ...current, nodes: current.nodes.map((n) => (n.id === nodeId ? { ...n, image: dataUrl } : n)) };
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
  }

  // Cùng kỷ luật refs-only như applyImageToNode: được gọi từ listener "paste"
  // gắn-một-lần và từ .then() của readImageFile.
  function createImageNode(dataUrl, pos) {
    const current = boardRef.current;
    if (!current || !viewportRef.current) return;
    if (!imageFitsBoard(dataUrl)) return;
    let x, y;
    if (pos) {
      ({ x, y } = pos);
    } else {
      const rect = viewportRef.current.getBoundingClientRect();
      x = Math.round((rect.width / 2 - current.view.panX) / current.view.scale - CARD_W / 2);
      y = Math.round((rect.height / 2 - current.view.panY) / current.view.scale - 80);
    }
    const id = current.nextNodeId;
    const node = { id, title: t`Ảnh`, desc: "", tagId: null, statusId: null, x, y, image: dataUrl };
    const next = { ...current, nodes: [...current.nodes, node], nextNodeId: id + 1 };
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
    setSelectedIds(new Set([id]));
  }

  useEffect(() => {
    function onPaste(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (roleRef.current === "viewer") return;
      const current = boardRef.current;
      if (!current) return;
      const sel = selectedIdsRef.current;
      if (sel.size > 1) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      const file = item.getAsFile();
      if (sel.size === 1) readImageFile(file).then((dataUrl) => applyImageToNode(Array.from(sel)[0], dataUrl)).catch(() => {});
      else readImageFile(file).then((dataUrl) => createImageNode(dataUrl)).catch(() => {});
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // ── Chặn thao tác mặc định của trình duyệt trên cả trang bảng ──────────────
  //
  // BÔI ĐEN và KÉO-THẢ GỐC là thao tác dành cho một trang TÀI LIỆU. Đây là một
  // cái bàn vẽ: mỗi cú bấm, cú kéo trên nền đều đã có nghĩa riêng, nên hai thứ
  // đó chỉ chen vào. Cụ thể chúng làm hỏng những việc này:
  //
  //   Bấm 3 lần để làm lại — trình duyệt hiểu là "chọn cả đoạn văn", bôi đen
  //     nguyên vùng rồi bật thanh công cụ chọn-chữ của nó đè lên bảng.
  //   Kéo một cái thẻ, một cái chip — trình duyệt dựng bóng kéo-thả gốc của nó
  //     đi kèm, trong khi cú kéo thật đã được xử lý bằng sự kiện chuột.
  //   Quét chọn một vùng — vệt bôi đen xanh chạy theo dưới khung quét.
  //
  // Nghe ở `document` chứ không rắc user-select: none vào từng khối CSS: chặn ở
  // một chỗ thì không có góc nào sót, và cái cần giữ lại chỉ là MỘT ngoại lệ —
  // ô nhập liệu. Trong ô nhập thì bôi đen là thao tác đúng và cần thiết (chọn
  // một từ để sửa, bấm 3 lần để chọn cả dòng), nên chúng đi qua nguyên vẹn.
  // Cùng ngoại lệ mà handlePageContextMenu đang dùng cho menu chuột phải.
  useEffect(() => {
    function blockNativeDefault(e) {
      const el = e.target;
      const tag = (el?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable === true) return;
      e.preventDefault();
    }
    document.addEventListener("selectstart", blockNativeDefault);
    document.addEventListener("dragstart", blockNativeDefault);
    return () => {
      document.removeEventListener("selectstart", blockNativeDefault);
      document.removeEventListener("dragstart", blockNativeDefault);
    };
  }, []);

  if (loadError) {
    return <LoadError code={loadError} />;
  }
  if (!board) {
    return <div style={{ padding: 40, color: "var(--ink-dim)" }}><Trans>Đang tải…</Trans></div>;
  }

  const currentUser = user.name;

  function handlePresenceMouseMove(e) {
    sendCursor(() => {
      const rect = viewportRef.current.getBoundingClientRect();
      const view = boardRef.current.view;
      return {
        x: (e.clientX - rect.left - view.panX) / view.scale,
        y: (e.clientY - rect.top - view.panY) / view.scale
      };
    });
  }

  function entityAtPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el && el.closest(".idea-card");
    if (card) return { id: Number(card.getAttribute("data-id")), kind: "node" };
    const frame = el && el.closest(".frame-box");
    if (frame) return { id: Number(frame.getAttribute("data-group-id")), kind: "group" };
    return null;
  }

  function createNode(x, y, extra) {
    const id = board.nextNodeId;
    const node = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: null, x: Math.round(x), y: Math.round(y), ...extra };
    const next = { ...board, nodes: [...board.nodes, node], nextNodeId: id + 1 };
    setEditingId(id);
    commitAndSave(next);
  }

  function addGameDesignCard(type = "mechanic") {
    if (board.kind !== "game-design" || role === "viewer") return;
    const rect = viewportRef.current.getBoundingClientRect();
    const p = toCanvasPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const node = createGameDesignNode(board.nextNodeId, p.x - CARD_W / 2, p.y - 55, type);
    const next = { ...board, nodes: [...board.nodes, node], nextNodeId: node.id + 1 };
    recordHistory(board); setBoard(next); boardRef.current = next; saveNow(next); setDesignEditId(node.id);
  }

  function saveDesignNode(nextNode) {
    const current = boardRef.current;
    const next = { ...current, nodes: current.nodes.map((n) => n.id === nextNode.id ? nextNode : n) };
    // Panel là inspector của thẻ đang chọn, không phải modal dùng một lần. Giữ
    // nó mở sau khi lưu để người thiết kế nhìn ngay phần vừa điền và chuyển qua
    // thẻ khác bằng một cú bấm trên canvas.
    recordHistory(current); setBoard(next); boardRef.current = next; saveNow(next);
  }
  function createRelatedDesignNode(sourceId, type, relation) {
    const current = boardRef.current; const next = createRelatedGameDesignCard(current, sourceId, type, relation);
    if (next === current) return; recordHistory(current); setBoard(next); boardRef.current = next; saveNow(next); setDesignEditId(next.nextNodeId - 1);
  }
  function duplicateDesignNode(sourceId) {
    const current = boardRef.current; const next = duplicateGameDesignCard(current, sourceId);
    if (next === current) return; recordHistory(current); setBoard(next); boardRef.current = next; saveNow(next); setDesignEditId(next.nextNodeId - 1);
  }

  function saveGameDesignBrief(nextBrief) {
    const current = boardRef.current;
    if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignBrief: normalizeGameDesignBrief(nextBrief) };
    recordHistory(current); setBoard(next); boardRef.current = next; saveNow(next);
  }

  function saveGameDesignFlow(nextFlow) {
    const current = boardRef.current;
    if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignFlow: normalizeGameDesignFlow(nextFlow, current.nodes) };
    recordHistory(current); setBoard(next); boardRef.current = next; saveNow(next);
  }
  function saveGameDesignBalance(nextBalance) {
    const current = boardRef.current; if (!current || current.kind !== "game-design") return;
    const next = { ...current, gameDesignBalance: normalizeGameDesignBalance(nextBalance, current.nodes) };
    recordHistory(current); setBoard(next); boardRef.current = next; saveNow(next);
  }

  // Điểm trên bảng (toạ độ canvas) ứng với một điểm trên màn hình. Đọc qua
  // boardRef chứ không phải `board`: hàm này được gọi từ trong listener của một
  // cú kéo dài vài giây, mà closure của listener giữ `board` của lượt render lúc
  // mousedown — camera có thể đã đổi từ lúc đó.
  function toCanvasPoint(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = boardRef.current.view;
    return {
      x: (clientX - rect.left - view.panX) / view.scale,
      y: (clientY - rect.top - view.panY) / view.scale
    };
  }

  // Cùng kỷ luật refs-only như commitStroke (xem ghi chú dài ở đó): tô một cái
  // khung mất vài giây, board:update của người khác về giữa chừng mà mình dựng
  // `next` từ `board` đóng gói lúc mousedown thì cú PUT sau đó đè mất thay đổi
  // của họ.
  function createGroupAt({ x, y, w, h }) {
    const current = boardRef.current;
    if (!current) return;
    const id = current.nextGroupId;
    const group = {
      id, title: t`Khung mới`, color: null,
      x: Math.round(x), y: Math.round(y),
      w: Math.max(MIN_GROUP_W, Math.round(w)), h: Math.max(MIN_GROUP_H, Math.round(h))
    };
    const next = { ...current, groups: [...current.groups, group], nextGroupId: id + 1 };
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
  }

  // Khu 3 lên nòng một việc rồi chờ người dùng chỉ chỗ. Bấm lại đúng nút đang
  // sáng thì hạ nòng — không có nút nào để "thoát" ngoài Esc thì nút đang sáng
  // phải tự làm được việc đó.
  function armPlace(next) {
    if (mode === "place" && placeTool === next) { enterMode("select"); return; }
    setPlaceTool(next);
    enterMode("place");
  }

  // Thẻ canh giữa theo con trỏ chứ không lấy điểm bấm làm góc trên-trái: bậc 1
  // rộng 260px, nếu neo góc thì thẻ mọc lệch hẳn sang phải chỗ vừa bấm.
  // `- 40` là nửa chiều cao ước lượng của thẻ, giữ nguyên con số mà nút "thêm ở
  // giữa màn hình" cũ đang dùng.
  function placeNodeAt(clientX, clientY) {
    const p = toCanvasPoint(clientX, clientY);
    createNode(p.x - CARD_LEVEL_W[cardLevelPref] / 2, p.y - 40, levelPatch(cardLevelPref));
    enterMode("select");
  }

  // Tô một vùng để ra khung. Bấm-không-tô (hoặc tô một vệt bé tí vì trượt tay)
  // vẫn ra khung, nhưng ở cỡ mặc định và lấy chỗ bấm làm tâm — không ai muốn
  // một cái khung 4x6 pixel. Vệt tô lớn hơn ngưỡng này thì lấy đúng vùng đã tô,
  // nhưng vẫn bị createGroupAt kẹp lên cỡ nhỏ nhất cho phép.
  const MIN_DRAWN_GROUP = 60;
  function startPlaceGroup(e) {
    e.preventDefault();
    const a = toCanvasPoint(e.clientX, e.clientY);
    let last = null;
    // Chỉ việc VẼ khung nháp bị bóp theo khung hình; `last` cập nhật ở mọi nhịp
    // chuột nên lúc thả không mất vị trí cuối dù có cancel() lần vẽ còn treo.
    const paint = rafThrottle((rect) => setPlaceDraft(rect));
    function onMove(ev) {
      const b = toCanvasPoint(ev.clientX, ev.clientY);
      last = {
        x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y)
      };
      paint(last);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      paint.cancel();
      setPlaceDraft(null);
      const drawn = last && last.w >= MIN_DRAWN_GROUP && last.h >= MIN_DRAWN_GROUP;
      createGroupAt(drawn ? last : { x: a.x - 240, y: a.y - 160, w: 480, h: 320 });
      enterMode("select");
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Nhường đường cho lia bảng TRƯỚC khi nghĩ tới việc đặt — cùng thứ tự mà
  // handleInkCaptureMouseDown dùng, nên chuột phải và Space+trái vẫn lia bảng
  // bình thường trong lúc đang lên nòng.
  function handlePlaceCaptureMouseDown(e) {
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (placeTool === "node") placeNodeAt(e.clientX, e.clientY);
    else if (placeTool === "group") startPlaceGroup(e);
  }

  // Trả về id đã cấp để useInk gửi kèm vào gói live `done` — người xem cần id
  // thật mới đối chiếu được overlay với board:update sắp về.
  //
  // Cùng kỷ luật refs-only như applyImageToNode (xem ghi chú ở đó): finish()
  // trong useInk.js gắn listener "mouseup" vào window NGAY LÚC mousedown, nên
  // closure của nó giữ commitStroke/commitErase của lượt render tại thời điểm
  // đó. Vẽ một nét mất vài giây; nếu board:update của người khác về TRONG lúc
  // đang vẽ, `board` đóng gói sẽ là bản cũ — build `next` từ nó rồi PUT cả bản
  // cũ sẽ đè mất thay đổi của người kia, cả cục bộ, cả trên server, cả trên
  // màn hình họ khi gói phát lại về tới. Phải đọc boardRef.current, và không
  // dùng commitAndSave được vì nó tự gọi recordHistory(board) — cùng vấn đề
  // đóng gói cũ; nên trình tự ghi lịch sử/lưu được lặp lại thủ công.
  function commitStroke(stroke) {
    const current = boardRef.current;
    // Không có board thì không có gì để commit — nhưng vẫn phải trả về một id
    // hợp lệ cho useInk gọi live?.endStroke(drawingId): endStroke đã chịu được
    // id null/undefined (`drawingId ?? null`), nên trả undefined ở đây là an
    // toàn, không làm useInk hay useInkLive vỡ.
    if (!current) return undefined;
    const id = current.nextDrawingId;
    const next = {
      ...current,
      drawings: [...current.drawings, { id, ...stroke }],
      nextDrawingId: id + 1
    };
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
    return id;
  }

  // `adds` là các MẢNH còn lại sau khi cục tẩy theo độ rộng cắt ngang một nét:
  // nét cũ nằm trong `ids` (bỏ đi), mỗi mảnh vào làm một nét mới. Cục tẩy kiểu
  // "cả nét" không bao giờ truyền tham số này, nên nó đi đúng đường cũ.
  //
  // Xoá và thêm phải nằm trong CÙNG MỘT bản ghi: tách làm hai lượt commit thì
  // có một khoảnh khắc nét đã mất mà mảnh chưa có, và quan trọng hơn là hoàn tác
  // sẽ phải bấm hai lần mới về được chỗ cũ — trong khi người dùng chỉ làm đúng
  // một việc.
  function commitErase(ids, adds) {
    const current = boardRef.current;
    if (!current) return;
    const kill = new Set(ids);
    let nextId = current.nextDrawingId;
    // Gom mảnh theo nét gốc, rồi đặt chúng ĐÚNG CHỖ nét đó đang đứng trong mảng
    // thay vì nối vào cuối. Thứ tự trong `drawings` chính là thứ tự trên/dưới
    // khi vẽ: nối vào cuối thì một nét nằm dưới hình tô đặc, cắt xong lại nhảy
    // lên nằm trên nó — người dùng vừa tẩy một tí mà cả bức đổi tầng.
    const byFrom = new Map();
    for (const { from, ...part } of adds || []) {
      const list = byFrom.get(from) || [];
      list.push({ id: nextId++, ...part });
      byFrom.set(from, list);
    }
    const drawings = [];
    for (const d of current.drawings) {
      if (!kill.has(d.id)) { drawings.push(d); continue; }
      const parts = byFrom.get(d.id);
      if (parts) drawings.push(...parts);
    }
    const next = { ...current, drawings, nextDrawingId: nextId };
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
  }

  // Rời mode Chuột thì bỏ lựa chọn và tắt nối dây: để lại một thẻ đang chọn
  // trong lúc vẽ nghĩa là bấm Delete sẽ xoá thẻ đó, trong khi người dùng đang
  // nghĩ mình xoá nét vẽ. Mode "place" cũng vậy — lớp bắt chuột của nó phủ kín
  // viewport nên thẻ đang chọn không còn bấm tới được.
  function enterMode(next) {
    setMode(next);
    // Hạ nòng khu 3 khi đi sang mode khác. KHÔNG đụng tới placeTool khi vào
    // chính mode "place": armPlace() đặt nó ngay trước lời gọi này.
    if (next !== "place") setPlaceTool(null);
    if (next !== "select") {
      clearSelection();
      setLinkMode(false);
      setPendingSource(null);
    }
  }

  // Bật "Nối ý tưởng" mà vẫn còn ở mode Sửa thì vô dụng: `.ink-capture` phủ
  // kín viewport ở mode Sửa và nuốt hết click lên thẻ, nên không bấm chọn
  // được thẻ nguồn/đích nào — bật lên rồi coi như chết. Bật link mode phải
  // kéo về mode Chuột (select) trước; tắt link mode thì giữ nguyên mode hiện
  // tại. Dùng chung cho cả phím tắt `l` và nút trên ToolRail.
  function toggleLinkMode() {
    const turningOn = !linkMode;
    if (turningOn) enterMode("select");
    setLinkMode(turningOn);
    setPendingSource(null);
  }

  function groupSelectedCards() {
    const PAD = 28, TITLE_ROOM = 20;
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ids.forEach((id) => {
      const n = board.nodes.find((nn) => nn.id === id);
      if (!n) return;
      const { w, h } = frameCardSize(id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    if (minX === Infinity) return;
    const id = board.nextGroupId;
    const group = {
      id, title: t`Khung mới`, color: null,
      x: Math.round(minX - PAD), y: Math.round(minY - PAD - TITLE_ROOM),
      w: Math.round(maxX - minX + PAD * 2), h: Math.round(maxY - minY + PAD * 2 + TITLE_ROOM)
    };
    setColorMenu(null);
    commitAndSave({ ...board, groups: [...board.groups, group], nextGroupId: id + 1 });
  }

  function duplicateNodes(ids, offset = 24) {
    let nextId = board.nextNodeId;
    const idMap = new Map();
    const clones = [];
    ids.forEach((id) => {
      const n = board.nodes.find((nn) => nn.id === id);
      if (!n) return;
      idMap.set(id, nextId);
      const { locked, ...rest } = n;
      clones.push({ ...rest, id: nextId, x: n.x + offset, y: n.y + offset });
      nextId++;
    });
    let nextEdgeId = board.nextEdgeId;
    const clonedEdges = [];
    board.edges.forEach((e) => {
      if ((e.fromKind || "node") !== "node" || (e.toKind || "node") !== "node") return;
      if (idMap.has(e.from) && idMap.has(e.to)) {
        clonedEdges.push({ ...e, id: nextEdgeId++, from: idMap.get(e.from), to: idMap.get(e.to) });
      }
    });
    return {
      next: {
        ...board,
        nodes: [...board.nodes, ...clones],
        edges: [...board.edges, ...clonedEdges],
        nextNodeId: nextId,
        nextEdgeId
      },
      cloneIds: Array.from(idMap.values())
    };
  }

  function handleGroupMouseDown(e, groupId) {
    if (e.button === 2) { e.stopPropagation(); startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { e.stopPropagation(); startPan(e); return; }
    if (e.button !== 0) return;
    const group = board.groups.find((g) => g.id === groupId);
    if (!group) return;
    e.stopPropagation();

    // Ctrl/Cmd+click = thêm/bớt khung khỏi vùng chọn, và KHÔNG kéo — cùng luật
    // với thẻ (xem handleNodeMouseDown). Đặt TRƯỚC nhánh `locked`: khung khoá
    // vẫn phải cộng/trừ được khỏi vùng chọn, khoá chỉ chặn di chuyển.
    if (e.ctrlKey || e.metaKey) {
      setSelectedGroupIds((prev) => toggleId(prev, group.id));
      return;
    }
    if (group.locked) { setSelectedGroupIds(new Set([group.id])); setSelectedIds(new Set()); return; }

    // Kéo một khung ĐANG nằm trong vùng chọn nhiều thứ thì mang cả vùng chọn đi;
    // kéo một khung ngoài vùng chọn thì thu vùng chọn về đúng khung đó, y như
    // cách bấm vào một cái thẻ đang làm.
    const inSelection = selectedGroupIds.has(group.id);
    const many = inSelection && (selectedGroupIds.size > 1 || selectedIds.size > 0);
    const dragSet = many
      ? selectionDragSet(board, selectedGroupIds, selectedIds)
      : selectionDragSet(board, new Set([group.id]), EMPTY_SET);
    if (!many) { setSelectedGroupIds(new Set([group.id])); setSelectedIds(new Set()); setSelectedEdgeIds(new Set()); }

    const dragGroupIds = dragSet.groupIds;
    const memberIds = dragSet.nodeIds;
    if (dragGroupIds.length === 0) return;

    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const movingGroupIds = new Set(dragGroupIds);
    const startGroupPositions = new Map(
      dragGroupIds.map((id) => {
        const g = board.groups.find((gg) => gg.id === id);
        return [id, { x: g.x, y: g.y, w: g.w, h: g.h }];
      })
    );
    const startNodePositions = new Map(
      memberIds.map((id) => {
        const n = board.nodes.find((nn) => nn.id === id);
        return [id, { x: n.x, y: n.y }];
      })
    );
    // Kích thước thẻ trong khung và các hình chữ nhật để bắt dính đều KHÔNG đổi
    // trong suốt cú kéo — dựng sẵn một lần thay vì dựng lại ở mỗi nhịp chuột.
    const memberSizes = new Map(memberIds.map((id) => [id, frameCardSize(id)]));
    const nodeWidths = new Map(board.nodes.map((n) => [n.id, n.w]));
    const otherRects = [
      ...board.nodes.filter((n) => !startNodePositions.has(n.id)).map((n) => {
        const { w, h } = frameCardSize(n.id);
        return { x: n.x, y: n.y, w, h };
      }),
      ...board.groups.filter((g) => !movingGroupIds.has(g.id)).map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }))
    ];
    let latest = board;
    let moved = false;

    const onMove = rafThrottle((ev) => {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      startGroupPositions.forEach((start) => {
        const gx = start.x + dx, gy = start.y + dy;
        minX = Math.min(minX, gx); minY = Math.min(minY, gy);
        maxX = Math.max(maxX, gx + start.w); maxY = Math.max(maxY, gy + start.h);
      });
      memberIds.forEach((id) => {
        const start = startNodePositions.get(id);
        const { w, h } = memberSizes.get(id);
        const nx = start.x + dx, ny = start.y + dy;
        minX = Math.min(minX, nx); minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx + w); maxY = Math.max(maxY, ny + h);
      });
      const movingRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

      if (ev.altKey) {
        setSnapGuides(EMPTY_ARRAY);
      } else {
        const snap = computeSnap(movingRect, otherRects, 6 / scale);
        dx += snap.dx; dy += snap.dy;
        setSnapGuides(snap.guides);
      }

      setBoard((prev) => {
        const next = {
          ...prev,
          groups: prev.groups.map((g) => {
            const start = startGroupPositions.get(g.id);
            if (!start) return g;
            return { ...g, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
          }),
          nodes: prev.nodes.map((n) => {
            const start = startNodePositions.get(n.id);
            if (!start) return n;
            return { ...n, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
          })
        };
        latest = next;
        return next;
      });
      // Chỉ phát khi thật sự có dịch chuyển: bấm-không-kéo không được sinh
      // ra gói nào, để bên người xem không phải dựng overlay rồi lại nhả ra.
      if (moved) publishGeom(movingItems(dx, dy));
    });

    function movingItems(dx, dy) {
      return {
        groups: dragGroupIds.map((id) => {
          const start = startGroupPositions.get(id);
          return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: start.w, h: start.h };
        }),
        nodes: memberIds.map((id) => {
          const start = startNodePositions.get(id);
          return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: nodeWidths.get(id) };
        })
      };
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.flush();
      setSnapGuides(EMPTY_ARRAY);
      // Bấm vào khung mà không kéo thì không có gì để ghi: lần PUT ở đây đẩy cả
      // board (kèm ảnh) lên server rồi phát board:update cho mọi người, chỉ để
      // lưu lại đúng trạng thái cũ.
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({
        groups: latest.groups.filter((g) => movingGroupIds.has(g.id)),
        nodes: latest.nodes.filter((n) => startNodePositions.has(n.id))
      });
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleGroupResizeMouseDown(e, groupId) {
    const group = board.groups.find((g) => g.id === groupId);
    if (!group || group.locked) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const startW = group.w, startH = group.h;
    const MIN_W = MIN_GROUP_W, MIN_H = MIN_GROUP_H;
    let latest = board;
    let moved = false;

    const onMove = rafThrottle((ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
      const w = Math.max(MIN_W, Math.round(startW + dx));
      const h = Math.max(MIN_H, Math.round(startH + dy));
      setBoard((prev) => {
        const next = {
          ...prev,
          groups: prev.groups.map((g) => (g.id === group.id ? { ...g, w, h } : g))
        };
        latest = next;
        return next;
      });
      if (moved) publishGeom({ groups: [{ id: group.id, x: group.x, y: group.y, w, h }] });
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.flush();
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({ groups: latest.groups.filter((g) => g.id === group.id) });
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function saveGroupTitle(groupId, title) {
    setEditingGroupTitleId(null);
    commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, title: title.trim() || t`Khung` } : g)) });
  }

  function deleteGroup(id) {
    commitAndSave({
      ...board,
      groups: board.groups.filter((g) => g.id !== id),
      edges: board.edges.filter((e) => !(
        (e.from === id && (e.fromKind || "node") === "group") ||
        (e.to === id && (e.toKind || "node") === "group")
      ))
    });
  }

  function applyGroupColor(groupId, color) {
    commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === groupId ? { ...g, color } : g)) });
    setColorMenu(null);
  }

  // Chỗ nào thì tay cầm sửa hình có hiệu lực. MỘT nguồn sự thật cho cả phần vẽ
  // ra (JSX) lẫn phần bắt chuột (shapeHandleAt): hai chỗ lệch nhau thì hoặc là
  // tay cầm hiện ra mà bấm không được, hoặc là có một vùng vô hình cướp chuột.
  const canGrabShapeHandles = mode === "select" || (mode === "draw" && tool === "pen");

  // Giữ tay ở CHỖ TRỐNG: đổi qua lại giữa bút và cục gôm. useInk lo toàn bộ
  // phần cử chỉ (đo thời gian, vòng báo, bỏ lượt vẽ dở); ở đây chỉ còn đúng
  // việc lật một ô state.
  //
  // Vẽ rồi xoá rồi vẽ tiếp là nhịp làm việc thường xuyên nhất trên một cái bảng,
  // mà cho tới giờ mỗi lần đổi đều phải với tay lên thanh công cụ bên trái hoặc
  // nhớ phím tắt — cả hai đều bắt rời mắt khỏi chỗ đang vẽ.
  // Con trỏ của CỤC TẨY THEO ĐỘ RỘNG: một vòng tròn đúng bằng cục tẩy thật, vẽ
  // thẳng vào con trỏ bằng data-URI. Không có nó thì bề rộng là một con số vô
  // hình — người dùng chọn cỡ "to" rồi phải quét thử vài lần mới đoán ra nó với
  // tới đâu, mà mỗi lần thử là một lần cắt nhầm phải hoàn tác.
  //
  // Chỉ ở kiểu "theo độ rộng". Kiểu "cả nét" giữ crosshair vì ở đó cục tẩy là
  // một cái que chỉ, vẽ một vòng tròn to quanh nó là nói dối về tầm với.
  const eraseCursor = (() => {
    if (mode !== "draw" || tool !== "eraser" || penPrefs.erase !== ERASE_PART) return undefined;
    // Trình duyệt bỏ qua HẲN con trỏ tuỳ biến quá lớn (Chrome: 128px) — không
    // phải thu nhỏ mà là mất luôn cả con trỏ. Kẹp lại: ở mức phóng cao thì vòng
    // tròn nhỏ hơn cục tẩy thật, vẫn hơn là không có con trỏ nào.
    const d = Math.max(6, Math.min(120, Math.round(penPrefs.ew * board.view.scale)));
    const box = d + 4;
    const c = box / 2;
    const r = d / 2;
    // Hai vòng chồng nhau, trắng dày dưới đen mảnh trên: con trỏ phải đọc được
    // trên cả nền sáng lẫn nền tối, mà con trỏ thì không nghe được prefers-color.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}">`
      + `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="white" stroke-width="3" opacity="0.9"/>`
      + `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="black" stroke-width="1.2"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(c)} ${Math.round(c)}, crosshair`;
  })();

  function swapPenEraser() {
    if (role === "viewer") return;
    setTool(tool === "eraser" ? "pen" : "eraser");
  }

  // Bấm-mà-không-di khi đang cầm BÚT: chọn cái nét dưới tay, hoặc bỏ chọn nếu
  // bấm vào chỗ trống. useInk gọi hàm này từ nhánh "cú bấm không tạo ra nét nào"
  // — xem ghi chú dài ở đó về việc vì sao cú bấm này rảnh.
  //
  // Chọn xong thì mọi thứ vốn chỉ có ở mode Chuột đều dùng được ngay mà không
  // phải rời cây bút: tay cầm sửa hình, hai nút nét liền/đứt trên thanh vùng
  // chọn, phím Delete, phím mũi tên để nhích.
  function pickDrawingWhileDrawing(id, additive) {
    if (role === "viewer") return;
    if (id == null) { if (!additive) clearSelection(); return; }
    setSelectedDrawingIds(additive ? toggleId(selectedDrawingIds, id) : new Set([id]));
    // Cú bấm này chọn MỘT nét vẽ, nên vùng chọn cũ của thẻ/khung/dây phải nhường
    // chỗ — không thì thanh vùng chọn báo "3 thẻ · 1 nét vẽ" sau một cú bấm mà
    // người dùng chỉ định chỉ vào đúng một cái nét.
    if (!additive) {
      setSelectedIds(EMPTY_SET);
      setSelectedEdgeIds(EMPTY_SET);
      setSelectedGroupIds(EMPTY_SET);
    }
  }

  // Đặt nét liền / nét đứt cho một TẬP nét. Text bị bỏ qua dù có nằm trong vùng
  // chọn: nó vẽ bằng `fill`, không có nét nào để làm đứt.
  function setDrawingsDashed(ids, dashed) {
    const list = board.drawings || [];
    if (!ids.size || !list.some((d) => ids.has(d.id) && d.kind !== "text")) return;
    commitAndSave({
      ...board,
      drawings: list.map((d) => (ids.has(d.id) && d.kind !== "text" ? { ...d, dashed } : d))
    });
  }

  // Bấm hai lần lên một nét đã vẽ: đổi nét liền ↔ nét đứt.
  //
  // Nét được nhắm nằm TRONG vùng chọn thì cả vùng chọn đổi theo — cùng luật với
  // cú thả màu vào vùng chọn, và cùng luật với việc bấm vào một nét trong cụm là
  // kéo cả cụm. Quét chọn chục cái nét xong mà vẫn phải nhắm lại từng cái một
  // thì vùng chọn coi như không tồn tại.
  //
  // Cả cụm nhận CÙNG một giá trị lấy từ cái nét được nhắm, chứ không phải mỗi
  // nét tự lật lấy: vùng chọn lẫn lộn nửa liền nửa đứt mà lật từng cái thì nó
  // vẫn lẫn lộn mãi mãi, chỉ đảo vai. Lấy một giá trị chung thì một cử chỉ là cả
  // cụm về cùng một kiểu — thứ người ta thật sự muốn khi bôi cả đám rồi bấm.
  //
  // `dashed` vắng mặt nghĩa là nét liền, nên `!d.dashed` là phép lật đúng cho cả
  // những nét đã lưu từ trước khi có tính năng này.
  function toggleDrawingDash(id) {
    const target = (board.drawings || []).find((d) => d.id === id);
    if (!target) return;
    setDrawingsDashed(selectedDrawingIds.has(id) ? selectedDrawingIds : new Set([id]), !target.dashed);
  }

  // Vùng chọn có ít nhất một thứ ĐỔI ĐƯỢC nét hay không. Không phải cứ
  // `selectedDrawingIds.size >= 1` là đủ: quét trúng đúng một đoạn chữ thì hai
  // nút nét liền/nét đứt hiện ra nhưng bấm vào không có gì xảy ra.
  const hasDashableSelected = (board.drawings || [])
    .some((d) => selectedDrawingIds.has(d.id) && d.kind !== "text");

  // Nét nằm ngay dưới cú bấm, hoặc null nếu cú bấm rơi vào chỗ trống.
  //
  // Trả null luôn ở cục gôm và ở tool Text, dù có nét ở dưới: ở hai chỗ đó CÚ BẤM
  // ĐÃ CÓ VIỆC RỒI — cục gôm xoá nét ngay từ cú bấm đầu, tool Text mở ô nhập tại
  // chỗ bấm. Chồng thêm cử chỉ này lên là vừa xoá vừa đổi nét, hoặc vừa mở ô nhập
  // vừa đổi một nét mà người dùng còn không nhắm tới.
  function dashTargetAt(e) {
    if (mode === "draw" && (tool === "eraser" || tool === "text")) return null;
    const list = board.drawings || [];
    const hits = drawingsHitBy(list, clientToCanvas(e.clientX, e.clientY), PICK_RADIUS);
    // Nét vẽ sau cùng nằm trên, nên trúng nhiều thì lấy cái trên — cùng luật với
    // cú bấm chọn ở mode Chuột. Text bị bỏ qua: nó vẽ bằng `fill`, không có nét
    // nào để làm đứt.
    for (let i = hits.length - 1; i >= 0; i--) {
      const d = list.find((x) => x.id === hits[i]);
      if (d && d.kind !== "text") return d.id;
    }
    return null;
  }

  // ── Bấm nhiều lần lên một nét vẽ: 2 lần đổi nét liền ↔ nét đứt ─────────────
  //
  // Luật đếm và các hằng số nằm ở lib/multi-click.js; ở đây chỉ là phần nối
  // chuột: lọc ra đúng những cú bấm TRÊN NỀN, và tách bấm khỏi kéo. Hai cái ref
  // của cử chỉ này khai ở đầu component cùng mọi hook khác — dưới đây đã qua
  // nhánh `if (!board) return`, gọi hook ở đây là gọi có điều kiện.

  // Nền trống của bảng, kể cả những lớp phủ kín khung nhìn của từng mode. KHÔNG
  // gồm lớp của mode Đặt: ở đó mỗi cú bấm là một cái thẻ mới, đếm chồng lên
  // thành ra vừa tạo thẻ vừa hoàn tác nó.
  function isBoardBackground(el) {
    if (el === viewportRef.current || el === canvasRef.current) return true;
    return el instanceof Element
      && (el.classList.contains("ink-capture") || el.classList.contains("laser-capture"));
  }

  // Ghi mốc ở pha BẮT (capture): nó chạy trước mọi handler con, nên một lớp phủ
  // gọi stopPropagation cũng không giấu được cú bấm khỏi bộ đếm.
  function handleViewportMouseDownCapture(e) {
    clickAnchorRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleViewportClickCapture(e) {
    const mc = multiClickRef.current;
    const anchor = clickAnchorRef.current;
    const dragged = !anchor || Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) > CLICK_DRAG_TOL;
    // Kéo, bấm trúng một vật thể, hoặc không có quyền sửa: chuỗi đứt tại đây.
    if (role === "viewer" || dragged || !isBoardBackground(e.target)) { mc.cancel(); return; }

    // Đích của cú bấm đi vào bộ đếm: một nét vẽ, hay nền trống (null). Đổi đích
    // là chuỗi bắt đầu lại, nên bấm một cái lên nét rồi một cái lên nền không
    // cộng thành cú đổi nét nào.
    const hitId = dashTargetAt(e);
    const count = mc.click(Date.now(), hitId);
    if (hitId == null) return;

    // Làm NGAY ở lần thứ hai. Đóng chuỗi ngay sau khi làm: bấm thêm hai lần
    // nữa là đổi ngược lại, chứ không phải lần thứ ba lại lật thêm một phát.
    if (count >= 2) { mc.cancel(); toggleDrawingDash(hitId); }
  }

  // Suppress the browser's native context menu across the whole page, so
  // right-click is free for our own gestures (chip → badge editor, drag to
  // pan). Text inputs keep the native menu so Copy/Paste still works there.
  function handlePageContextMenu(e) {
    const tag = (e.target.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    e.preventDefault();
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // `sourceId` quyết định dây nối, `anchorId` quyết định chỗ đặt. Hai thứ này
  // tách nhau vì Shift+Enter tạo thẻ CÙNG CẤP: dây đi từ thẻ cha, nhưng vị trí
  // phải nằm ngay dưới thẻ đang chọn chứ không phải dưới cha.
  function createLinkedNode(sourceId, direction, base = board, { anchorId = sourceId } = {}) {
    const source = base.nodes.find((n) => n.id === sourceId);
    const anchor = base.nodes.find((n) => n.id === anchorId);
    if (!source || !anchor) return;

    // Thẻ chưa tồn tại nên chưa đo được: 180 là chiều cao ước lượng của một thẻ
    // có tiêu đề + mô tả, dùng làm ô giữ chỗ khi kiểm va chạm.
    const NEW_SIZE = { w: CARD_W, h: 180 };
    const MARGIN = 24;

    const rect = viewportRef.current.getBoundingClientRect();
    const view = base.view;
    const { x, y, panTo } = placeLinkedNode({
      anchor: { x: anchor.x, y: anchor.y, ...frameCardSize(anchor.id) },
      size: NEW_SIZE,
      direction,
      obstacles: base.nodes.map((n) => ({ x: n.x, y: n.y, ...frameCardSize(n.id) })),
      viewport: {
        x0: (-view.panX + MARGIN) / view.scale,
        y0: (-view.panY + MARGIN) / view.scale,
        x1: (rect.width - view.panX - MARGIN) / view.scale,
        y1: (rect.height - view.panY - MARGIN) / view.scale
      }
    });

    // Chỗ trống rơi ra ngoài màn hình là chuyện thường khi board dày — dời
    // camera theo thẻ mới thay vì đặt thẻ ở chỗ khác cho vừa khung nhìn.
    const nextView = panTo
      ? {
          scale: view.scale,
          panX: rect.width / 2 - panTo.x * view.scale,
          panY: rect.height / 2 - panTo.y * view.scale
        }
      : base.view;

    const id = base.nextNodeId;
    const newNode = { id, title: t`Ý tưởng mới`, desc: "", tagId: null, statusId: null, x, y };
    const next = {
      ...base,
      nodes: [...base.nodes, newNode],
      edges: [...base.edges, { id: base.nextEdgeId, from: sourceId, to: id }],
      nextNodeId: id + 1,
      nextEdgeId: base.nextEdgeId + 1,
      view: nextView
    };
    setEditingId(id);
    commitAndSave(next);
  }

  // Thẻ cùng cấp = cùng cha. Không có cha (thẻ gốc) thì không có "cùng cấp"
  // nào để tạo — bỏ qua, chứ không âm thầm tạo thẻ rời.
  function createSiblingNode(nodeId) {
    const parentId = parentNodeId(board.edges, nodeId);
    if (parentId == null) return;
    createLinkedNode(parentId, "bottom", board, { anchorId: nodeId });
  }

  function handleConnectorMouseDown(e, nodeId, direction) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.kind === "node" && t.id === nodeId) return null;
      return t;
    }

    // rAF: mỗi nhịp gọi document.elementFromPoint — một phép hit-test buộc
    // trình duyệt tính lại layout. Ở tần số chuột thô đó là vài trăm lần/giây.
    const onMove = rafThrottle((ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const p = toCanvas(ev.clientX, ev.clientY);
      setLinkDraft({ fromId: nodeId, fromKind: "node", x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    });
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.cancel();
      if (dragging) {
        setLinkDraft(null);
        const t = targetAt(ev.clientX, ev.clientY);
        setDropTargetId(null);
        if (t) toggleEdge(nodeId, "node", t.id, t.kind);
      } else {
        createLinkedNode(nodeId, direction);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleGroupConnectorMouseDown(e, groupId) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.kind === "group" && t.id === groupId) return null;
      return t;
    }

    const onMove = rafThrottle((ev) => {
      const p = toCanvas(ev.clientX, ev.clientY);
      setLinkDraft({ fromId: groupId, fromKind: "group", x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    });
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.cancel();
      setLinkDraft(null);
      setDropTargetId(null);
      const t = targetAt(ev.clientX, ev.clientY);
      if (t) toggleEdge(groupId, "group", t.id, t.kind);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Cầm một đầu dây có sẵn và kéo sang thẻ/khung khác để đổi hướng nối. Khung
  // (group) là điểm đến hợp lệ y hệt thẻ — cả hai đi qua entityAtPoint chung.
  function handleEdgeEndpointMouseDown(e, edge, end) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setEdgeMenu(null);
    const rect = viewportRef.current.getBoundingClientRect();
    const fixedKind = end === "from" ? (edge.toKind || "node") : (edge.fromKind || "node");
    const fixedId = end === "from" ? edge.to : edge.from;

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }
    function targetAt(clientX, clientY) {
      const t = entityAtPoint(clientX, clientY);
      if (!t) return null;
      if (t.id === fixedId && t.kind === fixedKind) return null;
      return t;
    }

    const onMove = rafThrottle((ev) => {
      const p = toCanvas(ev.clientX, ev.clientY);
      setEdgeDrag({ edgeId: edge.id, end, fixedKind, fixedId, x: p.x, y: p.y });
      const t = targetAt(ev.clientX, ev.clientY);
      setDropTargetId(t ? { id: t.id, kind: t.kind } : null);
    });
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.cancel();
      setEdgeDrag(null);
      setDropTargetId(null);
      const t = targetAt(ev.clientX, ev.clientY);
      if (t) updateEdge(edge.id, end === "from" ? { from: t.id, fromKind: t.kind } : { to: t.id, toKind: t.kind });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Thả badge/màu vào một thẻ ĐANG nằm trong vùng chọn nhiều thì cả vùng chọn
  // nhận — cùng quy tắc với menu màu chuột phải (xem chỗ dựng ColorMenu bên
  // dưới). Thả vào thẻ NGOÀI vùng chọn thì chỉ thẻ đó, và vùng chọn để nguyên:
  // ở đó ý người dùng rõ ràng là gán cho đúng cái thẻ mình vừa nhắm.
  function dropIdsFor(kind, id) {
    const sel = kind === "edge" ? selectedEdgeIds : (kind === "drawing" ? selectedDrawingIds : selectedIds);
    return sel.size > 1 && sel.has(id) ? Array.from(sel) : [id];
  }

  // Viền "sắp thả vào đây" phải sáng ở MỌI thẻ sắp nhận, không chỉ thẻ dưới con
  // trỏ: thả badge vào một thẻ trong vùng chọn nhiều thì cả vùng đổi, mà chỉ tô
  // một thẻ thì hình ảnh nói sai việc sắp xảy ra.
  // Chỉ nới cho cú kéo badge/màu. `dropTargetId` còn được cú kéo dây dùng, và ở
  // đó đích thật sự chỉ có một thẻ.
  function isNodeDropTarget(nodeId) {
    if (!dropTargetId || dropTargetId.kind !== "node") return false;
    if (dropTargetId.id === nodeId) return true;
    if (!chipDrag && !colorDrag) return false;
    return selectedIds.size > 1 && selectedIds.has(dropTargetId.id) && selectedIds.has(nodeId);
  }

  function applyChipToNodes(nodeIds, kind, value) {
    const ids = new Set(nodeIds.filter((id) => board.nodes.some((n) => n.id === id)));
    if (ids.size === 0) return;
    const nextVal = value === "none" ? null : Number(value);
    const field = kind === "status" ? "statusId" : "tagId";
    // Mọi thẻ đã đúng giá trị thì không ghi gì: một cú thả vô nghĩa không nên
    // sinh ra một bước hoàn tác và một lượt PUT cả bảng.
    if (!board.nodes.some((n) => ids.has(n.id) && (n[field] ?? null) !== nextVal)) return;
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (ids.has(n.id) ? { ...n, [field]: nextVal } : n))
    });
  }

  // Chip trạng thái/nhãn: click = lọc (đọc, người chỉ xem vẫn dùng được), nhưng
  // kéo = gán badge vào thẻ và chuột phải = sửa badge, cả hai đều ghi dữ liệu.
  // CSS không tách được ba cử chỉ trên cùng một phần tử nên chặn ở đây.
  function handleChipMouseDown(e, kind, value) {
    if (role === "viewer") return;
    if (e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    function targetCardIdAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      const card = el && el.closest(".idea-card");
      return card ? Number(card.getAttribute("data-id")) : null;
    }

    const onMove = rafThrottle((ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      setChipDrag({ kind, value, x: ev.clientX, y: ev.clientY });
      const id = targetCardIdAt(ev.clientX, ev.clientY);
      setDropTargetId(id != null ? { id, kind: "node" } : null);
    });
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.cancel();
      if (!dragging) return;
      const targetId = targetCardIdAt(ev.clientX, ev.clientY);
      setChipDrag(null);
      setDropTargetId(null);
      if (targetId !== null) applyChipToNodes(dropIdsFor("node", targetId), kind, value);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function deleteNode(id) {
    commitAndSave({
      ...board,
      nodes: board.nodes.filter((n) => n.id !== id),
      edges: board.edges.filter((e) => !(
        (e.from === id && (e.fromKind || "node") === "node") ||
        (e.to === id && (e.toKind || "node") === "node")
      ))
    });
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function saveNodeEdit(id, fields) {
    setEditingId(null);
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)) });
  }

  function saveNodeEditAndNext(id, fields) {
    setEditingId(null);
    const edited = { ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)) };
    createLinkedNode(id, "right", edited);
  }

  function handleImageDrop(e, nodeId) {
    e.preventDefault();
    e.stopPropagation();
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
    if (f) readImageFile(f).then((d) => applyImageToNode(nodeId, d)).catch(() => {});
  }

  // Thả file ảnh lên chỗ trống canvas → tạo thẻ ảnh tại điểm thả (thả lên thẻ
  // có sẵn do handleImageDrop xử lý và đã stopPropagation).
  function handleViewportImageDrop(e) {
    if (role === "viewer") return;
    const f = Array.from(e.dataTransfer?.files ?? []).find((x) => x.type.startsWith("image/") || x.type === "application/pdf");
    if (!f) return;
    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - board.view.panX) / board.view.scale - CARD_W / 2);
    const y = Math.round((e.clientY - rect.top - board.view.panY) / board.view.scale - 40);
    if (f.type === "application/pdf") {
      uploadPdfFile(f, { x, y });
    } else {
      readImageFile(f).then((d) => createImageNode(d, { x, y })).catch(() => {});
    }
  }

  async function uploadPdfFile(file, pos) {
    if (!boardRef.current) return;
    const data = new FormData();
    data.append("file", file);
    try {
      const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/files`, {
        method: "POST", credentials: "include", body: data
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        let msg = t`Không thể tải PDF lên.`;
        if (body.error === "file_too_large") msg = t`PDF vượt giới hạn 30MB.`;
        // Ba lỗi dưới đây dẫn tới ba việc phải làm khác nhau, nên không gộp
        // chung: kho chung đầy là chuyện cả nhóm; phần riêng đầy thì tự xoá là
        // xong; còn quá tay thì chỉ cần chờ.
        else if (body.error === "storage_full") {
          msg = t`Kho PDF chung đã đầy (${body.used} / ${body.limit}). Xoá vài thẻ PDF không cần nữa rồi thử lại — dung lượng được trả lại sau khoảng một ngày.`;
        } else if (body.error === "user_quota_full") {
          msg = t`Bạn đã dùng hết phần dung lượng PDF của mình (${body.used} / ${body.limit}). Xoá vài thẻ PDF bạn đã tải lên rồi thử lại — dung lượng được trả lại sau khoảng một ngày.`;
        } else if (body.error === "too_many_uploads") {
          msg = t`Bạn vừa tải lên quá nhiều PDF trong một giờ. Chờ một lát rồi thử lại.`;
        }
        window.alert(msg);
        return;
      }
      const pdf = await res.json();
      const current = boardRef.current;
      if (!current) return;
      const id = current.nextNodeId;
      const node = {
        id, title: pdf.name, desc: "", tagId: null, statusId: null,
        x: pos.x, y: pos.y, w: 420, pdfH: 500,
        pdf: { fileId: pdf.fileId, name: pdf.name, size: pdf.size }
      };
      const next = { ...current, nodes: [...current.nodes, node], nextNodeId: id + 1 };
      recordHistory(current);
      setBoard(next);
      boardRef.current = next;
      saveNow(next);
      setSelectedIds(new Set([id]));
    } catch {
      window.alert(t`Không thể tải PDF lên.`);
    }
  }

  // Kéo góc ảnh đổi bề rộng thẻ (node.w); chiều cao ảnh theo tỉ lệ. Cùng
  // pattern với handleGroupResizeMouseDown: live update, 1 history entry lúc thả.
  function handleImageResizeMouseDown(e, nodeId) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (e.button !== 0 || !node || node.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const startW = node.w || CARD_W;
    // Không có trần: kéo to tới đâu cũng được. Trần 560px cũ vô nghĩa từ khi ảnh
    // giữ nguyên độ phân giải gốc — ảnh 3000px vẫn nét ở 2000px, chặn ở 560 chỉ
    // là vứt đi phần dữ liệu đã lưu. MIN_W giữ lại để thẻ không co về 0 rồi mất
    // luôn chỗ để bấm vào.
    const MIN_W = 140;
    let latest = board;
    let moved = false;

    const onMove = rafThrottle((ev) => {
      const dx = (ev.clientX - startX) / scale;
      if (Math.abs(dx) > 0.5) moved = true;
      const w = Math.max(MIN_W, Math.round(startW + dx));
      setBoard((prev) => {
        const next = { ...prev, nodes: prev.nodes.map((n) => (n.id === node.id ? { ...n, w } : n)) };
        latest = next;
        return next;
      });
      if (moved) publishGeom({ nodes: [{ id: node.id, x: node.x, y: node.y, w }] });
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.flush();
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({ nodes: latest.nodes.filter((n) => n.id === node.id) });
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Khung PDF cần kéo cả hai chiều: chiều rộng quyết định cỡ trang, chiều cao
  // là cửa sổ đọc/scroll của tài liệu. Khác ảnh (giữ tỉ lệ), nên không dùng lại
  // tay cầm ảnh chỉ kéo ngang.
  function handlePdfResizeMouseDown(e, nodeId) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (e.button !== 0 || !node?.pdf || node.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const boardBeforeDrag = board;
    const startW = node.w || 420, startH = node.pdfH || 500;
    let latest = board;
    let moved = false;
    const onMove = rafThrottle((ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;
      const w = Math.max(260, Math.round(startW + dx));
      const pdfH = Math.max(220, Math.round(startH + dy));
      setBoard((prev) => {
        const next = { ...prev, nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, w, pdfH } : n)) };
        latest = next;
        return next;
      });
      if (moved) publishGeom({ nodes: [{ id: node.id, x: node.x, y: node.y, w, h: pdfH }] });
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.flush();
      if (!moved) return;
      recordHistory(boardBeforeDrag);
      finishGeom({
        nodes: latest.nodes
          .filter((n) => n.id === node.id)
          .map((n) => ({ ...n, h: n.pdfH }))
      });
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function removeNodeImage(id) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => {
        if (n.id !== id) return n;
        const { image, ...rest } = n;
        return rest;
      })
    });
  }

  function toggleEdge(a, aKind, b, bKind) {
    const existing = board.edges.find((e) => edgesMatch(e, a, aKind, b, bKind));
    if (existing) {
      commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== existing.id) });
    } else {
      const edge = { id: board.nextEdgeId, from: a, fromKind: aKind, to: b, toKind: bKind, ...(board.kind === "game-design" ? { relation: "depends-on" } : {}) };
      commitAndSave({ ...board, edges: [...board.edges, edge], nextEdgeId: board.nextEdgeId + 1 });
    }
  }

  function updateEdge(id, patch) {
    commitAndSave({ ...board, edges: board.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  function deleteEdge(id) {
    commitAndSave({ ...board, edges: board.edges.filter((e) => e.id !== id) });
    setEdgeMenu(null);
    setSelectedEdgeIds((prev) => { if (!prev.has(id)) return prev; const next = new Set(prev); next.delete(id); return next; });
  }

  function handleCardClick(nodeId) {
    if (!linkMode) return;
    if (pendingSource === null) setPendingSource(nodeId);
    else if (pendingSource === nodeId) setPendingSource(null);
    else { toggleEdge(pendingSource, "node", nodeId, "node"); setPendingSource(null); }
  }

  function handleNodeMouseDown(e, nodeId) {
    const node = board.nodes.find((n) => n.id === nodeId);
    if (!node || linkMode || editingId === node.id) return;
    if (e.button === 2) { e.stopPropagation(); startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { e.stopPropagation(); startPan(e); return; }
    if (e.button !== 0) return;
    e.stopPropagation();

    // Ctrl/Cmd+click = thêm/bớt thẻ khỏi vùng chọn, và KHÔNG kéo: không gắn
    // mousemove/mouseup nào, nên nhích tay lúc bấm cũng không xê dịch thẻ.
    // Nhận cả Cmd vì trên macOS, Ctrl+click bị hệ điều hành biến thành chuột
    // phải (button 2) và nhánh này không bao giờ chạy tới.
    // Đặt TRƯỚC nhánh `locked`: thẻ khoá vẫn chọn được (khoá chỉ chặn di
    // chuyển), nên nó cũng phải cộng/trừ được khỏi vùng chọn như thẻ thường.
    // Alt được ưu tiên hơn, vì Alt-kéo là nhân bản — một việc khác hẳn.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      setSelectedIds((prev) => toggleId(prev, node.id));
      return;
    }

    if (node.locked && !e.altKey) { setSelectedIds(new Set([node.id])); setSelectedDrawingIds(EMPTY_SET); return; }

    const boardBeforeDrag = board;
    let dragIds, baseBoard, isAlt = false, selectedIdsBeforeDrag;
    // Khung cùng đi theo khi kéo một thẻ nằm trong vùng chọn có cả khung. Riêng
    // Alt-kéo (nhân bản) thì KHÔNG: nhân bản là việc của thẻ, kéo theo một cái
    // khung không được nhân bản sẽ làm khung rời khỏi ruột của nó.
    let dragGroupIds = [];
    // Nét vẽ đi theo cú kéo này. Phải là biến riêng chứ không đọc thẳng
    // `selectedDrawingIds` ở dưới: nhánh "bấm vào thẻ ngoài vùng chọn" gọi
    // setSelectedDrawingIds(rỗng), mà setState chỉ có hiệu lực ở lượt render
    // sau — đọc thẳng là vẫn thấy vùng chọn cũ và kéo theo nét không liên quan.
    let carryDrawingIds = EMPTY_SET;

    if (e.altKey) {
      isAlt = true;
      selectedIdsBeforeDrag = selectedIds;
      const cloneSourceIds = selectedIds.has(node.id) && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [node.id];
      const dup = duplicateNodes(cloneSourceIds, 0);
      setBoard(dup.next);
      boardRef.current = dup.next;
      setSelectedIds(new Set(dup.cloneIds));
      dragIds = dup.cloneIds;
      baseBoard = dup.next;
    } else {
      // "Nhiều" tính cả nét vẽ: quét trúng một thẻ và một hình vẽ chú thích rồi
      // kéo cái thẻ — nếu chỉ đếm thẻ với khung thì đây là "một mình một thẻ",
      // vùng chọn bị đặt lại và cái hình bị bỏ lại phía sau.
      const many = selectedIds.has(node.id)
        && (selectedIds.size > 1 || selectedGroupIds.size > 0 || selectedDrawingIds.size > 0);
      if (many) {
        const set = selectionDragSet(board, selectedGroupIds, selectedIds);
        dragIds = set.nodeIds;
        dragGroupIds = set.groupIds;
        carryDrawingIds = selectedDrawingIds;
      } else {
        dragIds = [node.id];
        setSelectedIds(new Set([node.id]));
        setSelectedGroupIds(new Set());
        // Cả nét vẽ nữa: bấm vào một thẻ ngoài vùng chọn là bắt đầu lại từ đầu.
        // Bỏ sót dòng này thì một nét còn sót trong vùng chọn cũ sẽ lặng lẽ đi
        // theo cú kéo thẻ này, dù người dùng không hề thấy nó liên quan.
        setSelectedDrawingIds(EMPTY_SET);
      }
      baseBoard = board;
    }

    const startX = e.clientX, startY = e.clientY;
    const scale = board.view.scale;
    const startPositions = new Map(
      dragIds.map((id) => {
        const n = baseBoard.nodes.find((nn) => nn.id === id);
        return [id, { x: n.x, y: n.y }];
      })
    );
    // Ba bảng tra dựng SẴN một lần cho cả cú kéo. Bản cũ dựng lại `otherRects`
    // — một mảng chứa MỌI thẻ khác, mỗi phần tử kèm một phép đo DOM — ở mỗi
    // nhịp chuột; với bảng 100 thẻ đó là 100 lần buộc trình duyệt tính lại
    // layout cho một lần nhích chuột, và là nguyên nhân giật nặng nhất khi bảng
    // to. Không có gì trong số đó đổi giữa chừng: thẻ khác đứng yên.
    const dragSizes = new Map(dragIds.map((id) => [id, frameCardSize(id)]));
    const dragWidths = new Map(dragIds.map((id) => [id, baseBoard.nodes.find((n) => n.id === id)?.w]));
    const movingGroupIds = new Set(dragGroupIds);
    const startGroupPositions = new Map(
      dragGroupIds.map((id) => {
        const g = baseBoard.groups.find((gg) => gg.id === id);
        return [id, { x: g.x, y: g.y, w: g.w, h: g.h }];
      })
    );
    // Nét vẽ / hình / chữ quét trúng cùng vùng chọn thì phải đi theo cú kéo:
    // quét một cụm gồm thẻ và mấy hình vẽ chú thích quanh nó rồi kéo, mà chỉ
    // thẻ chạy còn chú thích ở lại, là hỏng đúng cái cụm vừa gom. Chốt toạ độ
    // gốc một lần ở đây, mỗi nhịp chuột tính lại TỪ MỐC ĐÓ (không cộng dồn) —
    // cùng kỷ luật với startPositions của thẻ.
    // Alt+kéo (nhân bản) không có nét nào trong carryDrawingIds: nhân bản là
    // việc của thẻ, không nhân nét vẽ.
    const startDrawingPts = new Map(
      (baseBoard.drawings || [])
        .filter((d) => carryDrawingIds.has(d.id))
        .map((d) => [d.id, d.pts])
    );
    const otherRects = [
      ...baseBoard.nodes.filter((n) => !startPositions.has(n.id)).map((n) => {
        const { w, h } = frameCardSize(n.id);
        return { x: n.x, y: n.y, w, h };
      }),
      // Khung đang bị kéo theo không được tự làm mốc bắt dính cho chính nó.
      ...baseBoard.groups.filter((g) => !movingGroupIds.has(g.id)).map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h }))
    ];
    let latest = baseBoard;
    let moved = false;

    const onMove = rafThrottle((ev) => {
      let dx = (ev.clientX - startX) / scale;
      let dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved = true;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      dragIds.forEach((id) => {
        const start = startPositions.get(id);
        const { w, h } = dragSizes.get(id);
        const nx = start.x + dx, ny = start.y + dy;
        minX = Math.min(minX, nx); minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx + w); maxY = Math.max(maxY, ny + h);
      });
      startGroupPositions.forEach((start) => {
        const gx = start.x + dx, gy = start.y + dy;
        minX = Math.min(minX, gx); minY = Math.min(minY, gy);
        maxX = Math.max(maxX, gx + start.w); maxY = Math.max(maxY, gy + start.h);
      });
      const movingRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

      if (ev.altKey) {
        setSnapGuides(EMPTY_ARRAY);
      } else {
        const snap = computeSnap(movingRect, otherRects, 6 / scale);
        dx += snap.dx; dy += snap.dy;
        setSnapGuides(snap.guides);
      }

      const moving = dragIds.map((id) => {
        const start = startPositions.get(id);
        return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: dragWidths.get(id) };
      });
      const movingById = new Map(moving.map((m) => [m.id, m]));
      const movingGroups = dragGroupIds.map((id) => {
        const start = startGroupPositions.get(id);
        return { id, x: Math.round(start.x + dx), y: Math.round(start.y + dy), w: start.w, h: start.h };
      });
      const movingGroupById = new Map(movingGroups.map((g) => [g.id, g]));
      setBoard((prev) => {
        const next = {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const m = movingById.get(n.id);
            return m ? { ...n, x: m.x, y: m.y } : n;
          }),
          groups: movingGroups.length === 0 ? prev.groups : prev.groups.map((g) => {
            const m = movingGroupById.get(g.id);
            return m ? { ...g, x: m.x, y: m.y } : g;
          }),
          drawings: startDrawingPts.size === 0 ? prev.drawings : prev.drawings.map((d) => {
            const from = startDrawingPts.get(d.id);
            // Dời từ toạ độ GỐC: `moveDrawing` cộng vào pts được truyền vào, nên
            // đưa nó bản có pts lúc bắt đầu kéo thay vì bản đang hiển thị.
            return from ? moveDrawing({ ...d, pts: from }, dx, dy) : d;
          })
        };
        latest = next;
        return next;
      });
      // Chỉ phát ĐÚNG những thứ đang bị kéo, không phát cả bảng.
      if (moved) publishGeom(movingGroups.length ? { nodes: moving, groups: movingGroups } : { nodes: moving });
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.flush();
      setSnapGuides(EMPTY_ARRAY);
      if (moved) {
        recordHistory(boardBeforeDrag);
        // Gói geom cuối được gửi TRƯỚC khi PUT trả về, và nó giữ vị trí mới bên
        // máy người khác cho tới khi board:update chính thức tới nơi — không còn
        // khoảng hở nào để thẻ nhảy về chỗ cũ rồi nhảy lại.
        finishGeom(movingGroupIds.size
          ? { nodes: latest.nodes.filter((n) => startPositions.has(n.id)), groups: latest.groups.filter((g) => movingGroupIds.has(g.id)) }
          : { nodes: latest.nodes.filter((n) => startPositions.has(n.id)) });
        saveNow(latest);
      } else if (isAlt) {
        // Alt-click without drag: roll back the clone so nothing is silently duplicated.
        setBoard(boardBeforeDrag);
        boardRef.current = boardBeforeDrag;
        setSelectedIds(selectedIdsBeforeDrag);
      }
      // Bấm-không-kéo: không lưu. Bản cũ vẫn PUT cả board (kèm ảnh base64) rồi
      // bắt server phát board:update cho mọi người, chỉ vì một cú click chọn thẻ.
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleMarqueeMouseDown(e) {
    const rect = viewportRef.current.getBoundingClientRect();
    const startScreenX = e.clientX, startScreenY = e.clientY;
    let dragging = false;
    const THRESHOLD = 4;
    // Giữ Ctrl/Cmd lúc bắt đầu quét = quét thêm vào lựa chọn đang có. Chốt lại
    // mốc ngay đây, không đọc `selectedIds` trong onMove: onMove là closure của
    // lần render này nên `selectedIds` ở đó cũng là bản cũ, nhưng đọc từ biến
    // này thì rõ ý là "lựa chọn lúc bắt đầu quét" chứ không phải nhìn nhầm.
    const additive = e.ctrlKey || e.metaKey;
    const baseNodeIds = additive ? selectedIds : EMPTY_SET;
    const baseEdgeIds = additive ? selectedEdgeIds : EMPTY_SET;
    const baseGroupIds = additive ? selectedGroupIds : EMPTY_SET;
    const baseDrawingIds = additive ? selectedDrawingIds : EMPTY_SET;

    function toCanvas(clientX, clientY) {
      const view = boardRef.current.view;
      return { x: (clientX - rect.left - view.panX) / view.scale, y: (clientY - rect.top - view.panY) / view.scale };
    }

    function hitIdsFor(m) {
      return boardRef.current.nodes
        .filter((n) => {
          const { w, h } = frameCardSize(n.id);
          return rectsOverlap(m.x, m.y, m.w, m.h, n.x, n.y, w, h);
        })
        .map((n) => n.id);
    }

    // Khung dính khi vùng quét CHẠM nó, cùng luật với thẻ — không đòi quét trùm
    // kín. Khung thường to hơn cả khung nhìn, đòi trùm kín thì gần như không bao
    // giờ chọn được bằng chuột.
    function groupHitIdsFor(m) {
      return boardRef.current.groups
        .filter((g) => rectsOverlap(m.x, m.y, m.w, m.h, g.x, g.y, g.w, g.h))
        .map((g) => g.id);
    }

    function edgeHitIdsFor(m) {
      const { nodes, groups, edges } = boardRef.current;
      return edges
        .filter((edge) => {
          const r1 = rectForEndpoint(edge.fromKind || "node", edge.from, nodes, groups, frameCardSize);
          const r2 = rectForEndpoint(edge.toKind || "node", edge.to, nodes, groups, frameCardSize);
          if (!r1 || !r2) return false;
          const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
          const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
          return segmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, m);
        })
        .map((edge) => edge.id);
    }

    const onMove = rafThrottle((ev) => {
      if (!dragging && Math.hypot(ev.clientX - startScreenX, ev.clientY - startScreenY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      const a = toCanvas(startScreenX, startScreenY);
      const b = toCanvas(ev.clientX, ev.clientY);
      const m = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      setMarquee(m);
      // Giữ nguyên Set cũ khi tập chọn không đổi: một Set mới ở mỗi nhịp chuột
      // sẽ kích hoạt effect ghi URL và effect phát selection lên socket dù
      // chẳng có gì thay đổi.
      setSelectedIds((prev) => unionIdSet(prev, baseNodeIds, hitIdsFor(m)));
      setSelectedEdgeIds((prev) => unionIdSet(prev, baseEdgeIds, edgeHitIdsFor(m)));
      setSelectedGroupIds((prev) => unionIdSet(prev, baseGroupIds, groupHitIdsFor(m)));
      setSelectedDrawingIds((prev) => unionIdSet(prev, baseDrawingIds, drawingsInRect(boardRef.current.drawings || [], m)));
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.cancel();
      // Bấm-không-kéo trên nền trống = bỏ chọn hết, NHƯNG có Ctrl thì không:
      // ở đó Ctrl nghĩa là "đang cộng dồn lựa chọn", trượt tay bấm nhầm nền
      // trống mà mất cả vùng chọn vừa gom là hỏng việc.
      if (!dragging) { if (!additive) clearSelection(); return; }
      setMarquee(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startPan(e) {
    e.preventDefault();
    // Tự lia nền → thôi bám theo người khác. Đặt ở đây (mousedown) chứ không
    // trong onMove: người dùng vừa chạm vào là dừng ngay, không phải đợi camera
    // giằng co với vòng bám qua vài khung hình.
    stopFollow();
    const startX = e.clientX, startY = e.clientY;
    const startPanX = board.view.panX, startPanY = board.view.panY;
    let dragging = false;
    const THRESHOLD = 4;

    const onMove = rafThrottle((ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) {
        dragging = true;
        setIsPanning(true);
      }
      if (!dragging) return;
      const nx = startPanX + (ev.clientX - startX);
      const ny = startPanY + (ev.clientY - startY);
      setBoard((prev) => ({ ...prev, view: { ...prev.view, panX: nx, panY: ny } }));
    });
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.flush();
      if (dragging) {
        setIsPanning(false);
        // KHÔNG lưu: lia sa bàn chỉ đổi camera, mà camera là riêng từng người
        // (api.js đã bỏ `view` khỏi payload). Lần PUT ở đây không ghi được gì,
        // nhưng vẫn đẩy cả board — kể cả ảnh base64 — lên server rồi bắt server
        // phát board:update cho MỌI người khác. Mỗi cú lia nền của một người là
        // một cú giật trên màn hình tất cả những người còn lại.
        suppressContextMenuRef.current = true;
        setTimeout(() => { suppressContextMenuRef.current = false; }, 0);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Bấm trúng nét bút / hình khối / chữ ở mode Sửa: chọn nó (Ctrl để cộng dồn),
  // rồi cùng cú bấm đó kéo luôn được cả cụm đang chọn — đúng lối của thẻ, không
  // cần bấm chọn xong mới được kéo.
  function handleDrawingMouseDown(e, id) {
    if (e.ctrlKey || e.metaKey) {
      setSelectedDrawingIds(toggleId(selectedDrawingIds, id));
      // Ctrl+bấm là thao tác gom lựa chọn, không phải cú kéo: bỏ một nét ra khỏi
      // vùng chọn rồi lỡ tay di chuột không được kéo đi chỗ khác.
      return;
    }
    if (selectedDrawingIds.has(id)) {
      // Bấm vào cụm đang chọn: giữ nguyên cả cụm, và thẻ/khung trong cùng vùng
      // chọn cũng đi theo — đối xứng với cú kéo thẻ.
      startDrawingDrag(e, selectedDrawingIds, selectedIds, selectedGroupIds);
      return;
    }
    const picked = new Set([id]);
    setSelectedDrawingIds(picked);
    setSelectedIds(EMPTY_SET);
    setSelectedEdgeIds(EMPTY_SET);
    setSelectedGroupIds(EMPTY_SET);
    // Vùng chọn cũ vừa bị xoá ở trên, nhưng setState chỉ có hiệu lực ở lượt
    // render sau — nên truyền tường minh tập RỖNG, không để hàm dưới tự đọc
    // state và kéo theo mấy cái thẻ người dùng vừa bỏ chọn.
    startDrawingDrag(e, picked, EMPTY_SET, EMPTY_SET);
  }

  // `onClickNoDrag` chỉ có ở lối vào từ chỗ TRỐNG trong vùng chọn (xem
  // startSelectionDrag): ở đó bấm-không-kéo phải bỏ chọn. Bấm trúng một cái nét
  // thì không — đó là cú chọn chính cái nét đó, bỏ chọn ngay sau khi vừa chọn là
  // vô nghĩa.
  function startDrawingDrag(e, ids, carryNodeIds, carryGroupIds, onClickNoDrag) {
    // `ids` rỗng vẫn đi tiếp nếu còn thẻ/khung: cú kéo từ chỗ trống trong một
    // vùng chọn toàn thẻ không có nét nào để mà kéo, nhưng vẫn phải kéo được.
    if (role === "viewer") return;
    if (ids.size === 0 && carryNodeIds.size === 0 && carryGroupIds.size === 0) return;
    const start = eventToCanvas(e);
    const base = boardRef.current;
    // Chốt toạ độ gốc một lần, mỗi nhịp chuột tính lại TỪ ĐÓ chứ không cộng dồn
    // — cùng kỷ luật với cú kéo thẻ, và là thứ giữ cho cú kéo không trôi.
    const startPts = new Map(
      (base.drawings || []).filter((d) => ids.has(d.id)).map((d) => [d.id, d.pts])
    );
    // Đối xứng với cú kéo thẻ: kéo một nét trong vùng chọn hỗn hợp thì thẻ và
    // khung đang chọn cũng đi theo. Không thì cùng một vùng chọn lại cho hai kết
    // quả khác nhau tuỳ vào việc người dùng bấm trúng cái gì để kéo.
    const carry = selectionDragSet(base, carryGroupIds, carryNodeIds);
    const startNodes = new Map(
      base.nodes.filter((n) => carry.nodeIds.includes(n.id)).map((n) => [n.id, { x: n.x, y: n.y }])
    );
    const startGroups = new Map(
      base.groups.filter((g) => carry.groupIds.includes(g.id)).map((g) => [g.id, { x: g.x, y: g.y }])
    );
    let moved = false;
    let latest = base;
    inkLive.beginMove();

    const onMove = rafThrottle((ev) => {
      const p = eventToCanvas(ev);
      const dx = p.x - start.x, dy = p.y - start.y;
      if (!moved && Math.hypot(dx, dy) < TEXT_DRAG_THRESHOLD) return;
      moved = true;
      setBoard((prev) => {
        const next = {
          ...prev,
          drawings: prev.drawings.map((d) => {
            const from = startPts.get(d.id);
            return from ? moveDrawing({ ...d, pts: from }, dx, dy) : d;
          }),
          nodes: startNodes.size === 0 ? prev.nodes : prev.nodes.map((n) => {
            const from = startNodes.get(n.id);
            return from ? { ...n, x: Math.round(from.x + dx), y: Math.round(from.y + dy) } : n;
          }),
          groups: startGroups.size === 0 ? prev.groups : prev.groups.map((g) => {
            const from = startGroups.get(g.id);
            return from ? { ...g, x: Math.round(from.x + dx), y: Math.round(from.y + dy) } : g;
          })
        };
        latest = next;
        return next;
      });
      // Nét đi qua kênh ink, còn thẻ/khung bị kéo theo thì đi qua kênh geom —
      // hai loại vật thể, hai kênh, cùng một cú kéo. Trước đây cú kéo này không
      // phát gì cả, kể cả thẻ.
      inkLive.pushMove(movingPayload(latest, ids));
      if (startNodes.size || startGroups.size) {
        publishGeom({
          nodes: latest.nodes.filter((n) => startNodes.has(n.id)),
          groups: latest.groups.filter((g) => startGroups.has(g.id))
        });
      }
    });

    function cleanup() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
      onMove.cancel();
    }

    function onUp(ev) {
      cleanup();
      // bấm-không-kéo: chỉ là cú chọn (hoặc cú bỏ chọn), không lưu gì. Chỉ tính
      // là "bấm" khi thật sự có cú NHẢ CHUỘT — hàm này còn là handler của `blur`,
      // mà mất focus giữa lúc đang giữ chuột thì người dùng không hề bấm xong,
      // và bỏ mất vùng chọn của họ ở đó là vô cớ.
      if (!moved) { inkLive.cancelMove(); if (ev?.type === "mouseup") onClickNoDrag?.(); return; }
      inkLive.endMove(movingPayload(latest, ids));
      if (startNodes.size || startGroups.size) {
        finishGeom({
          nodes: latest.nodes.filter((n) => startNodes.has(n.id)),
          groups: latest.groups.filter((g) => startGroups.has(g.id))
        });
      }
      recordHistory(base);
      saveNow(latest);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // Cửa sổ mất focus giữa lượt kéo thì mouseup không bao giờ tới (cùng cái bẫy
    // đã ghi ở startTextDrag). Ở đây vị trí mới đã nằm sẵn trong board rồi, nên
    // đường thoát đúng là CHỐT nó lại — bỏ ngang thì người dùng thấy nét đã dời
    // mà server không hề biết, và F5 một cái là nó nhảy về chỗ cũ.
    window.addEventListener("blur", onUp);
  }

  function handleViewportMouseDown(e) {
    if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
    if (linkMode) { setPendingSource(null); return; }
    if (e.button === 2) { startPan(e); return; }
    if (e.button !== 0) return;
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    // Nét vẽ phải xét TRƯỚC vùng quét: cú bấm nào cũng rơi xuống nền canvas
    // (lớp vẽ không nhận chuột), nên nếu quét trước thì không bao giờ chạm được
    // vào một nét. Nét vẽ sau cùng nằm trên, nên trúng nhiều thì lấy cái trên.
    const p = eventToCanvas(e);
    const hits = drawingsHitBy(board.drawings || [], p, PICK_RADIUS);
    if (hits.length) { handleDrawingMouseDown(e, hits[hits.length - 1]); return; }
    // Khoảng TRỐNG bên trong vùng chọn: kéo cả cụm. Trước đây chỗ này quét vùng,
    // nghĩa là muốn dời một cụm đã gom xong thì phải nhắm cho trúng đúng một cái
    // thẻ hay đúng một cái nét — càng nhiều thứ mảnh trong cụm thì càng khó nhắm,
    // mà trượt một cái là mất luôn cả vùng chọn vừa gom.
    //
    // Ctrl vẫn đi đường quét: ở đó Ctrl nghĩa là "đang cộng dồn lựa chọn", và
    // vùng quét mới hoàn toàn có thể bắt đầu từ bên trong vùng chọn cũ.
    if (selBounds && !e.ctrlKey && !e.metaKey && pointInBounds(selBounds, p, SEL_GRAB_PAD / board.view.scale)) {
      startSelectionDrag(e);
      return;
    }
    handleMarqueeMouseDown(e);
  }

  // Kéo cả cụm từ một chỗ trống trong vùng chọn. Dùng lại nguyên đường của cú
  // kéo nét vẽ — nó vốn đã kéo được cả ba loại cùng lúc — chỉ khác một điểm:
  // bấm-mà-không-kéo ở đây là BỎ CHỌN, giữ đúng phản xạ "bấm ra chỗ trống là bỏ
  // chọn" đã có từ trước, chứ không im lặng như khi bấm trúng một cái nét.
  function startSelectionDrag(e) {
    startDrawingDrag(e, selectedDrawingIds, selectedIds, selectedGroupIds, clearSelection);
  }

  // Kéo một tay cầm của MỘT hình = đặt đúng cái góc / cái cạnh đó vào chỗ muốn.
  // Ý nghĩa từng tay cầm nằm hết ở lib/shape.js (shapeHandles/moveShapeHandle);
  // ở đây chỉ là phần nối chuột và phần lưu.
  function handleShapeHandleMouseDown(e, handle) {
    if (e.button !== 0 || role === "viewer" || !editShape) return;
    e.preventDefault();
    e.stopPropagation();
    const base = boardRef.current;
    const id = editShape.d.id;
    // Hình LÚC BẮT ĐẦU kéo. Mọi nhịp chuột tính lại từ nó chứ không từ bản vừa
    // sửa: cộng dồn thì tay cầm cạnh (dời theo delta) sẽ trôi mỗi khung hình một
    // ít, và kéo ra rồi kéo về không quay lại đúng chỗ cũ.
    const start = (base.drawings || []).find((x) => x.id === id);
    if (!start) return;
    let latest = base;
    let moved = false;
    const oneId = new Set([id]);
    inkLive.beginMove();

    const onMove = rafThrottle((ev) => {
      const p = eventToCanvas(ev);
      if (!moved && Math.hypot(p.x - handle.x, p.y - handle.y) < TEXT_DRAG_THRESHOLD / board.view.scale) return;
      moved = true;
      // Ghi đè CẢ kind: kéo góc một chữ nhật thì nó thành tứ giác, kéo góc một
      // tam giác cân thì nó thành tam giác thường (xem ghi chú ở lib/shape.js).
      const { kind, pts } = moveShapeHandle(start, handle, p.x, p.y);
      setBoard((prev) => {
        const next = {
          ...prev,
          drawings: (prev.drawings || []).map((x) => (x.id === id ? { ...x, kind, pts } : x))
        };
        latest = next;
        return next;
      });
      inkLive.pushMove(movingPayload(latest, oneId));
    });

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
      onMove.flush();
      if (!moved) { inkLive.cancelMove(); return; }
      inkLive.endMove(movingPayload(latest, oneId));
      recordHistory(base);
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // Mất focus giữa cú kéo: hình mới đã nằm sẵn trong board, nên đường thoát
    // đúng là CHỐT nó lại — cùng lý do đã ghi ở startDrawingDrag.
    window.addEventListener("blur", onUp);
  }

  // Kéo một trong bốn góc hộp bao = co giãn CẢ CỤM, đều hai chiều, quanh góc đối
  // diện (góc đó đứng yên tuyệt đối). Phép tính nằm hết ở lib/selection-box.js.
  function handleSelectionResizeMouseDown(e, corner) {
    if (e.button !== 0 || role === "viewer" || !selBounds) return;
    e.preventDefault();
    e.stopPropagation();
    const bounds = selBounds;
    const anchor = anchorFor(bounds, corner);
    // MỌI khung hình tính lại từ `base`, không cộng dồn lên kết quả lần trước:
    // nhân hệ số lên một bản đã bị nhân rồi thì cụm phình theo cấp số nhân, và
    // kéo ra rồi kéo về không quay lại đúng chỗ cũ. Cùng kỷ luật với
    // startPositions của cú kéo thẻ.
    const base = boardRef.current;
    const sel = selectionSet;
    let latest = base;
    let moved = false;
    inkLive.beginMove();

    const onMove = rafThrottle((ev) => {
      const k = scaleFactorFor(bounds, corner, eventToCanvas(ev));
      if (!moved && Math.abs(k - 1) < 0.02) return;
      moved = true;
      const scaled = scaleSelection(base, sel, anchor, k);
      // Đắp lên `prev` chứ không thay thẳng bằng `scaled`: một gói board:update
      // của người khác hoàn toàn có thể về giữa cú kéo, và `scaled` dựng từ bản
      // board LÚC BẮT ĐẦU — trả nguyên nó ra là xoá mất mọi thứ họ vừa sửa.
      // Chỉ lấy các trường HÌNH HỌC, phần còn lại của mỗi phần tử giữ nguyên bản
      // mới nhất (tiêu đề họ vừa gõ, màu họ vừa đổi…).
      const nodeGeom = new Map(scaled.nodes.filter((n) => sel.nodeIds.has(n.id)).map((n) => [n.id, n]));
      const groupGeom = new Map(scaled.groups.filter((g) => sel.groupIds.has(g.id)).map((g) => [g.id, g]));
      const drawGeom = new Map((scaled.drawings || []).filter((d) => sel.drawingIds.has(d.id)).map((d) => [d.id, d]));
      setBoard((prev) => {
        const next = {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const s = nodeGeom.get(n.id);
            return s ? { ...n, x: s.x, y: s.y, w: s.w } : n;
          }),
          groups: prev.groups.map((g) => {
            const s = groupGeom.get(g.id);
            return s ? { ...g, x: s.x, y: s.y, w: s.w, h: s.h } : g;
          }),
          drawings: (prev.drawings || []).map((d) => {
            const s = drawGeom.get(d.id);
            if (!s) return d;
            // `size` chỉ có ở text, `w`/`h` mang nghĩa khác nhau giữa text và nét
            // vẽ — nên chép theo những gì scaleSelection thật sự trả về, không
            // dựng sẵn một danh sách trường thứ hai ở đây để rồi lệch với nó.
            const geom = { pts: s.pts };
            if (s.w !== undefined) geom.w = s.w;
            if (s.h !== undefined) geom.h = s.h;
            if (s.size !== undefined) geom.size = s.size;
            return { ...d, ...geom };
          })
        };
        latest = next;
        return next;
      });
      // Co giãn đổi cả pts lẫn cỡ chữ, và thẻ/khung trong cụm cũng co theo —
      // nên cú này phải phát trên CẢ HAI kênh.
      inkLive.pushMove(movingPayload(latest, sel.drawingIds));
      if (sel.nodeIds.size || sel.groupIds.size) {
        publishGeom({
          nodes: latest.nodes.filter((n) => sel.nodeIds.has(n.id)),
          groups: latest.groups.filter((g) => sel.groupIds.has(g.id))
        });
      }
    });

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
      onMove.flush();
      if (!moved) { inkLive.cancelMove(); return; }
      inkLive.endMove(movingPayload(latest, sel.drawingIds));
      if (sel.nodeIds.size || sel.groupIds.size) {
        finishGeom({
          nodes: latest.nodes.filter((n) => sel.nodeIds.has(n.id)),
          groups: latest.groups.filter((g) => sel.groupIds.has(g.id))
        });
      }
      recordHistory(base);
      saveNow(latest);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // Mất focus giữa cú kéo: vị trí mới đã nằm sẵn trong board rồi, nên đường
    // thoát đúng là CHỐT nó lại — cùng lý do đã ghi ở startDrawingDrag.
    window.addEventListener("blur", onUp);
  }

  // Nhường đường cho lia bảng TRƯỚC khi nghĩ tới việc vẽ — đúng thứ tự
  // handleViewportMouseDown đang dùng, nên chuột phải và Space+trái vẫn lia
  // bảng bình thường ở mode Sửa.
  // Tay cầm sửa hình nằm gần chỗ bấm tới mức nào thì coi là bấm trúng nó, tính
  // bằng pixel MÀN HÌNH: tay cầm được bù trừ zoom nên trên màn hình nó luôn to
  // 11px, bất kể bảng đang phóng bao nhiêu. Rộng hơn cỡ thật một chút cho dễ tóm.
  const SHAPE_HANDLE_GRAB = 9;

  // Tay cầm nằm dưới chỗ bấm, nếu có.
  //
  // VÌ SAO PHẢI TỰ DÒ thay vì để trình duyệt lo bằng pointer-events: tay cầm là
  // con của `.canvas`, mà `.canvas` có `transform` — thứ tạo ra một NGỮ CẢNH XẾP
  // LỚP riêng. Mọi z-index bên trong đó chỉ so với nhau, không bao giờ leo ra
  // ngoài để thắng `.ink-capture` (z-index 8) đang phủ kín khung nhìn. Nên ở mode
  // Sửa, cú bấm luôn rơi vào lớp vẽ trước. Bắt ở đây, bằng đúng toạ độ canvas mà
  // tay cầm đang đứng, là đường duy nhất không phải bê cả hệ tay cầm ra khỏi
  // `.canvas` và tự tính lại pan/zoom cho chúng.
  function shapeHandleAt(e) {
    if (!editShape || role === "viewer") return null;
    const p = clientToCanvas(e.clientX, e.clientY);
    const limit = SHAPE_HANDLE_GRAB / board.view.scale;
    let best = null;
    let bestD = Infinity;
    for (const h of editShape.handles) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d <= limit && d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  function handleInkCaptureMouseDown(e) {
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (tool === "text") { handleTextMouseDown(e); return; }
    // Tay cầm xét TRƯỚC nét vẽ: nó nhỏ và luôn nằm ngay trên đường bao của hình
    // đang chọn, nên nếu để lượt vẽ ăn trước thì không bao giờ tóm được nó.
    // Chỉ ở tool Bút — xem ghi chú ở chỗ render tay cầm.
    if (canGrabShapeHandles) {
      const handle = shapeHandleAt(e);
      if (handle) { handleShapeHandleMouseDown(e, handle); return; }
    }
    ink.handleMouseDown(e);
  }

  // Mode Laser. Vệt CHỈ chạy khi đang giữ chuột trái — thả ra là không vẽ gì
  // nữa, đúng như cầm một cây laser thật phải bấm mới sáng. Nhờ vậy di chuột
  // qua bảng để đọc nội dung không để lại vệt nào.
  function handleLaserMouseDown(e) {
    // Nhường đường cho lia bảng y như .ink-capture: chuột phải và Space+trái
    // vẫn lia được.
    if (e.button === 2) { startPan(e); return; }
    if (e.button === 0 && spacePanRef.current) { startPan(e); return; }
    if (e.button !== 0) return;
    if (!viewportRef.current || !boardRef.current) return;
    const p = eventToCanvas(e);
    laserDownRef.current = true;
    laser.begin(p.x, p.y, laserPrefs);
  }

  // Cố ý KHÔNG gắn listener vào window như useInk.js làm. Ở đó bắt buộc phải
  // gắn window vì thả chuột ngoài khung nhìn mà không nhận được `mouseup` là
  // nét vẽ treo lại vĩnh viễn và không bao giờ được lưu. Ở đây lượt chỉ chẳng
  // có gì để commit, mà .laser-capture lại phủ kín khung nhìn — rời khỏi nó là
  // rời khỏi bảng, nên `onMouseLeave` đủ để đóng lượt. Đổi lại: không có
  // listener nào sống sót ra ngoài lượt, nên không có đường nào rò như bẫy
  // "blur giữa nét" mà useInk.js phải dựng cả một cleanupRef để chặn.
  function handleLaserMouseMove(e) {
    if (!laserDownRef.current) return;
    if (!viewportRef.current || !boardRef.current) return;
    const p = eventToCanvas(e);
    laser.track(p.x, p.y, laserPrefs);
  }

  function handleLaserMouseUp() {
    if (!laserDownRef.current) return;
    laserDownRef.current = false;
    laser.end();
  }

  // Chuột → toạ độ canvas. Bản sao của toCanvas trong useInk.js; không gom
  // chung được vì ở đó nó nhận `view` qua ref của hook, còn ở đây board đã có
  // sẵn trong tầm tay.
  function clientToCanvas(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const view = boardRef.current.view;
    return {
      x: (clientX - rect.left - view.panX) / view.scale,
      y: (clientY - rect.top - view.panY) / view.scale
    };
  }

  function eventToCanvas(e) {
    return clientToCanvas(e.clientX, e.clientY);
  }

  // Đo bề rộng một dòng chữ bằng đúng font đang hiển thị. Phải đọc --canvas-font
  // qua getComputedStyle chứ không viết cứng: bật skin vẽ tay là font đổi, và
  // hộp đo bằng font cũ sẽ lệch hẳn. Cùng cách png-export.js dựng ngữ cảnh 2d.
  function measureTextWidth(line, size) {
    if (measureCtxRef.current === undefined) {
      // getContext trả null ở môi trường không có canvas thật (jsdom của smoke
      // test). Dò một lần rồi nhớ kết quả: dò lại mỗi lần đo thì một text ba
      // dòng in ra ba dòng cảnh báo.
      measureCtxRef.current = document.createElement("canvas").getContext("2d") || null;
    }
    const ctx = measureCtxRef.current;
    // Không có ngữ cảnh 2d thì ước lượng thô. Hộp chỉ dùng cho vùng chạm của
    // cục gôm và vùng bấm để kéo, nên sai vài phần trăm còn hơn ném lỗi và làm
    // trắng cả trang chỉ vì không đo được một dòng chữ.
    if (!ctx) return line.length * size * 0.55;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--canvas-font").trim();
    ctx.font = `${size}px ${family || "sans-serif"}`;
    return ctx.measureText(line).width;
  }

  // Bấm khi đang cầm tool Text. Trúng một text đã có thì mở nó ra sửa, trúng
  // chỗ trống thì tạo mới tại đúng chỗ bấm.
  function handleTextMouseDown(e) {
    // BẮT BUỘC. Hành vi mặc định của mousedown là dời tiêu điểm: .ink-capture là
    // một div không nhận được tiêu điểm nên trình duyệt đẩy nó về <body>. Mà
    // React 18 xả sự kiện rời rạc NGAY trong lúc dispatch, nên ô nhập đã kịp gắn
    // vào cây và tự lấy tiêu điểm (autoFocus) TRƯỚC khi hành vi mặc định chạy —
    // rồi bị cướp tiêu điểm ngay sau đó, blur bắn ra, commitText thấy chuỗi rỗng
    // và gỡ ô nhập đi. Triệu chứng đúng như đã thấy: bấm mà "không ra cái gì để
    // viết". Không có dòng này thì mọi cách focus lại đều chỉ là vá ngọn.
    e.preventDefault();

    // Đang gõ dở mà bấm sang chỗ khác: chốt cái cũ lại rồi mở ngay ô mới ở chỗ
    // vừa bấm — ô nhập "nhảy" theo con trỏ, không bắt bấm hai lần.
    //
    // Việc này chỉ an toàn nhờ preventDefault ở trên. Không có nó, tiêu điểm bị
    // đẩy về <body> và `blur` bắn ra xen vào giữa hai việc dưới đây, thứ tự
    // khác nhau giữa các trình duyệt — và cái sai sẽ là mất chữ vừa gõ. Có nó
    // rồi thì tiêu điểm không rời textarea, React dùng lại đúng nút DOM đó
    // (cùng kiểu, cùng vị trí trong cây) nên `blur` không bao giờ xảy ra: chỉ
    // còn MỘT đường chốt, là lời gọi tường minh ngay đây.
    if (textEdit) commitText();

    // Đọc board SAU khi chốt: commitText vừa cập nhật boardRef.current, nên
    // phép dò bên dưới nhìn thấy cả đoạn text vừa gõ xong. Bấm đè lên chính nó
    // là mở lại nó ra sửa, đúng như bấm lên một text cũ bất kỳ.
    const current = boardRef.current;
    if (!current) return;
    const p = eventToCanvas(e);
    const hit = drawingsHitBy(current.drawings || [], p, 0)
      .map((id) => current.drawings.find((d) => d.id === id))
      .find((d) => d && d.kind === "text");
    if (hit) { startTextDrag(hit, p); return; }
    const fresh = { id: null, x: Math.round(p.x), y: Math.round(p.y), value: "", size: penPrefs.size, color: penPrefs.color };
    setTextEdit(fresh);
    beginLiveText(fresh);
  }

  // Bấm trúng một text: MỘT cú bấm phục vụ hai việc. Di dưới ngưỡng thì coi như
  // chỉ bấm → mở ra sửa; di quá ngưỡng thì là kéo → dời chỗ. Không cần bấm đúp,
  // và không có cách nào bấm nhầm sang việc kia.
  function startTextDrag(el, start) {
    const offX = start.x - el.pts[0];
    const offY = start.y - el.pts[1];
    let moved = false;
    let last = { x: el.pts[0], y: el.pts[1] };
    inkLive.beginMove();

    function onMove(ev) {
      const p = eventToCanvas(ev);
      if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < TEXT_DRAG_THRESHOLD) return;
      moved = true;
      last = { x: Math.round(p.x - offX), y: Math.round(p.y - offY) };
      // Chỉ đẩy vào state NHÁP, không ghi vào board: một lần kéo phải là một
      // lần lưu, không phải một lần cho mỗi nhịp chuột.
      setTextDrag({ id: el.id, x: last.x, y: last.y });
      // Vì board KHÔNG đổi trong lúc kéo, gói live phải dựng từ vị trí nháp chứ
      // không dựng qua movingPayload — hàm đó đọc board.
      inkLive.pushMove([{ id: el.id, pts: [last.x, last.y] }]);
    }

    function cleanup() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", finish);
      window.removeEventListener("blur", cancel);
      setTextDrag(null);
    }

    // Cửa sổ mất focus giữa lượt kéo: mouseup sẽ không bao giờ tới. Cùng cái bẫy
    // useInk.js đã có ghi chú dài — không dọn thì text treo ở vị trí nháp và cú
    // mouseup sau đó (ở một ngữ cảnh khác) vẫn commit.
    function cancel() { cleanup(); inkLive.cancelMove(); }

    function finish() {
      cleanup();
      if (!moved) {
        inkLive.cancelMove();
        const reopen = { id: el.id, x: el.pts[0], y: el.pts[1], value: el.text, size: el.size, color: el.color };
        setTextEdit(reopen);
        beginLiveText(reopen);
        return;
      }
      const current = boardRef.current;
      if (!current) { inkLive.cancelMove(); return; }
      inkLive.endMove([{ id: el.id, pts: [last.x, last.y] }]);
      const next = {
        ...current,
        drawings: current.drawings.map((d) => (d.id === el.id ? { ...d, pts: [last.x, last.y] } : d))
      };
      recordHistory(current);
      setBoard(next);
      boardRef.current = next;
      saveNow(next);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", finish);
    window.addEventListener("blur", cancel);
  }

  // Cùng kỷ luật refs-only như commitStroke (xem ghi chú dài ở đó): gõ một đoạn
  // chú thích mất vài chục giây, board:update của người khác về giữa chừng mà
  // mình dựng `next` từ `board` đóng gói lúc mở ô nhập thì cú PUT sau đó đè mất
  // thay đổi của họ.
  // Mở kênh live cho một lượt gõ. Tách ra vì có HAI chỗ mở ô nhập — bấm chỗ
  // trống để tạo mới, và bấm lên một đoạn có sẵn để sửa — mà cả hai phải phát
  // gói đầu giống hệt nhau, không thì một trong hai đường lặng lẽ không realtime.
  function beginLiveText(edit) {
    inkLive.beginText(
      [Math.round(edit.x), Math.round(edit.y)],
      edit.value, edit.color, edit.size, edit.id
    );
  }

  function commitText() {
    const edit = textEditRef.current;
    textEditRef.current = null;
    setTextEdit(null);
    if (!edit) return;
    const current = boardRef.current;
    if (!current) { inkLive.cancelText(); return; }
    const value = edit.value.trim();

    // Rỗng: tạo mới thì không đẻ ra phần tử vô hình; sửa thì coi như xoá.
    if (!value) {
      // Cả hai nhánh dưới đây đều KHÔNG để lại đoạn text nào, nên overlay phải
      // bị huỷ chứ không phải chốt: gói done không có drawingId sẽ treo trên
      // màn hình người khác tới hết INK_SETTLE_TTL_MS.
      inkLive.cancelText();
      if (edit.id == null) return;
      const next = { ...current, drawings: current.drawings.filter((d) => d.id !== edit.id) };
      recordHistory(current);
      setBoard(next);
      boardRef.current = next;
      saveNow(next);
      return;
    }

    // Mở một text ra xem rồi đóng lại mà không sửa gì: không ghi gì cả. Thiếu
    // chốt này thì mỗi lần bấm nhầm vào một dòng chú thích là một lần lưu lên
    // server VÀ một bước hoàn tác rỗng — Ctrl+Z mấy lần liền không thấy gì đổi.
    if (edit.id != null) {
      const before = current.drawings.find((d) => d.id === edit.id);
      if (before && before.text === value && before.size === edit.size
          && before.color === edit.color
          && before.pts[0] === Math.round(edit.x) && before.pts[1] === Math.round(edit.y)) {
        // Không lưu gì ⇒ sẽ KHÔNG có board:update nào để reconcileInkOverlay
        // dọn overlay theo, nên phải huỷ tay.
        inkLive.cancelText();
        return;
      }
    }

    const lines = textLines(value);
    const box = textBox(lines, edit.size, measureTextWidth);
    const el = {
      kind: "text", pts: [Math.round(edit.x), Math.round(edit.y)],
      text: value, color: edit.color, size: edit.size, w: box.w, h: box.h
    };
    let next;
    let savedId;
    if (edit.id == null) {
      const id = current.nextDrawingId;
      savedId = id;
      next = { ...current, drawings: [...current.drawings, { id, ...el }], nextDrawingId: id + 1 };
    } else {
      savedId = edit.id;
      next = { ...current, drawings: current.drawings.map((d) => (d.id === edit.id ? { ...d, ...el } : d)) };
    }
    // Chốt kèm id vừa lưu: người nhận giữ overlay cho tới đúng lúc board:update
    // mang id đó về, không sớm hơn (chữ biến mất rồi hiện lại) cũng không muộn
    // hơn (hai lớp chữ chồng nhau).
    inkLive.endText(savedId);
    recordHistory(current);
    setBoard(next);
    boardRef.current = next;
    saveNow(next);
  }

  // Mọi thao tác CHỈ đổi camera đều đi qua đây. Camera là riêng từng người: nó
  // được lưu vào localStorage bằng effect theo board.view, còn api.js thì đã cắt
  // `view` khỏi payload PUT từ lâu. Vì vậy gọi saveNow/commitAndSave ở nhóm hàm
  // này (bản cũ có ở zoom, vừa khung, nhảy tới thẻ/khung, thoát trình chiếu)
  // KHÔNG ghi được gì lên server, nhưng vẫn đẩy cả board kèm ảnh base64 đi và
  // bắt server phát board:update cho mọi người — nghĩa là chỉ cần một người
  // cuộn chuột là màn hình của tất cả những người còn lại bị dựng lại.
  //
  // Đây cũng là chỗ huỷ ghim màn hình: người dùng tự lái camera thì thôi bám
  // theo người khác. Không có chốt này thì họ zoom xong màn hình bị kéo ngược
  // lại ngay lập tức — trông y như app treo. Vòng bám đi cửa riêng
  // (applyFollowCamera) nên không tự huỷ mình ở đây.
  function setCamera(view) {
    stopFollow();
    setBoard((prev) => ({ ...prev, view }));
  }

  function zoomButton(factor) {
    const rect = viewportRef.current.getBoundingClientRect();
    const next = computeZoom(board, rect, rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    setCamera(next.view);
  }

  // Bấm/kéo trên minimap: chỉ dời camera, giữ nguyên mức phóng. Camera là của
  // riêng từng người (api.js không gửi `view` lên server) nên đây không phải một
  // sửa đổi board — không ghi lịch sử, không lưu, không phát cho ai.
  function goToPoint(pt) {
    const el = viewportRef.current;
    if (!el) return;
    // Bấm/kéo trên minimap cũng là tự lái camera → thôi bám theo người khác.
    stopFollow();
    const rect = el.getBoundingClientRect();
    const view = boardRef.current.view;
    setBoard((prev) => ({
      ...prev,
      view: { ...prev.view, ...panForCenter(pt, view, { w: rect.width, h: rect.height }) }
    }));
  }

  function fitToView() {
    if (board.nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    board.nodes.forEach((n) => {
      const { w, h } = frameCardSize(n.id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function deleteSelection() {
    const ids = selectedIds;
    const edgeIds = selectedEdgeIds;
    const groupIds = selectedGroupIds;
    const drawIds = selectedDrawingIds;
    if (ids.size === 0 && edgeIds.size === 0 && groupIds.size === 0 && drawIds.size === 0) return;
    // Xoá khung chỉ bỏ CÁI KHUNG, thẻ bên trong ở nguyên — đúng như nút × trên
    // khung vẫn làm. Khung là một cái vòng vẽ quanh, không phải cái hộp sở hữu
    // thẻ; xoá nhầm mà mất luôn cả cụm ý tưởng thì quá đắt.
    commitAndSave({
      ...board,
      nodes: board.nodes.filter((n) => !ids.has(n.id)),
      groups: board.groups.filter((g) => !groupIds.has(g.id)),
      drawings: (board.drawings || []).filter((d) => !drawIds.has(d.id)),
      edges: board.edges.filter((e) => !(
        edgeIds.has(e.id) ||
        (ids.has(e.from) && (e.fromKind || "node") === "node") ||
        (ids.has(e.to) && (e.toKind || "node") === "node") ||
        (groupIds.has(e.from) && (e.fromKind || "node") === "group") ||
        (groupIds.has(e.to) && (e.toKind || "node") === "group")
      ))
    });
    clearSelection();
  }

  function duplicateSelection() {
    if (selectedIds.size === 0) return;
    const { next, cloneIds } = duplicateNodes(Array.from(selectedIds));
    commitAndSave(next);
    setSelectedIds(new Set(cloneIds));
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedEdgeIds(new Set());
    setSelectedGroupIds(new Set());
    setSelectedDrawingIds(new Set());
  }

  /**
   * Những gì một cú kéo trong vùng chọn mang theo: các khung đang chọn, các thẻ
   * đang chọn, CỘNG mọi thẻ nằm trong những khung đó — kéo khung mà bỏ ruột lại
   * là hỏng ý nghĩa của cái khung. Thẻ/khung đang khoá bị loại ngay ở đây, nên
   * mọi phần sau của cú kéo không phải nghĩ tới `locked` nữa.
   */
  function selectionDragSet(base, groupIds, nodeIds) {
    const groups = base.groups.filter((g) => groupIds.has(g.id) && !g.locked);
    const nodeSet = new Set();
    base.nodes.forEach((n) => { if (nodeIds.has(n.id) && !n.locked) nodeSet.add(n.id); });
    const lockedById = new Map(base.nodes.map((n) => [n.id, !!n.locked]));
    groups.forEach((g) => {
      nodesInFrame(base.nodes, g, frameCardSize).forEach((id) => {
        if (!lockedById.get(id)) nodeSet.add(id);
      });
    });
    return { groupIds: groups.map((g) => g.id), nodeIds: Array.from(nodeSet) };
  }

  function applyToSelection(patch) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, ...patch } : n))
    });
  }

  // Màu là thuộc tính duy nhất mà thẻ và khung dùng chung một bộ token, nên nó
  // là thứ duy nhất áp được cho cả hai trong một cú bấm.
  function applyColorToSelection(color) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (selectedIds.has(n.id) ? { ...n, color } : n)),
      groups: board.groups.map((g) => (selectedGroupIds.has(g.id) ? { ...g, color } : g)),
      // Nét vẽ không có khái niệm "không màu" (một nét không màu là nét vô
      // hình), nên ô "Không màu" bỏ qua chúng thay vì làm chúng biến mất.
      drawings: color == null
        ? (board.drawings || [])
        : (board.drawings || []).map((d) => (selectedDrawingIds.has(d.id) ? { ...d, color } : d))
    });
  }

  function tidySelection() {
    if (selectedIds.size < 2) return;
    const selected = board.nodes
      .filter((n) => selectedIds.has(n.id) && !n.locked)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));       // thứ tự đọc
    if (selected.length < 2) return;
    const items = selected.map((n) => ({ id: n.id, ...frameCardSize(n.id) }));
    const origin = {
      x: Math.min(...selected.map((n) => n.x)),
      y: Math.min(...selected.map((n) => n.y))
    };
    // Chỉ cạnh thẻ–thẻ mới định tầng; cạnh dính khung không nói gì về thứ tự thẻ.
    const links = board.edges.filter(
      (e) => (e.fromKind || "node") === "node" && (e.toKind || "node") === "node"
    );
    const pos = layerLayout(items, links, origin);
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (pos.has(n.id) ? { ...n, ...pos.get(n.id) } : n))
    });
  }

  // Xếp lại thẻ gốc + toàn bộ con cháu nối với nó thành hình cây. Gốc đứng yên
  // làm điểm neo; thẻ khoá giữ chỗ nhưng con cháu nó vẫn xếp quanh đúng chỗ đó.
  // Thuần một phép biến đổi board → board: bảng Xếp cây gọi lại nó mỗi lần kéo
  // thanh trượt để xem trước, nên nó không được tự ý ghi state hay lưu server.
  function treeArranged(base, rootKind, rootId, opts) {
    const nodeById = new Map(base.nodes.map((n) => [n.id, n]));
    const groupById = new Map(base.groups.map((g) => [g.id, g]));
    const rootKey = edgeKey(rootKind, rootId);
    const root = rootKind === "group" ? groupById.get(rootId) : nodeById.get(rootId);
    if (!root) return null;

    function sizeOf(key) {
      const [kind, rawId] = key.split(":");
      const id = Number(rawId);
      if (kind === "group") {
        const g = groupById.get(id);
        return g ? { w: g.w, h: g.h } : { w: CARD_W, h: 110 };
      }
      return frameCardSize(id);
    }

    const pos = treeLayout({
      edges: base.edges,
      rootKey,
      rootPos: { x: root.x, y: root.y },
      sizeOf,
      directions: opts.directions,
      gap: { depth: opts.depth, breadth: opts.breadth, leaf: opts.leaf }
    });
    if (pos.size < 2) return null;            // gốc trơ trọi: không có gì để xếp

    // Khung nào trong cây bị dời thì thẻ nằm trong khung đó (không có dây nối
    // riêng) phải dời theo, không thì rớt ra ngoài khung.
    const carried = carryGroupMembers(pos, base.groups, base.nodes, frameCardSize);

    function moved(kind, item) {
      const p = pos.get(edgeKey(kind, item.id)) || (kind === "node" ? carried.get(item.id) : null);
      if (!p || item.locked) return item;     // thẻ khoá vẫn tính vào cây, chỉ không dời
      return { ...item, x: p.x, y: p.y };
    }
    return {
      ...base,
      nodes: base.nodes.map((n) => moved("node", n)),
      groups: base.groups.map((g) => moved("group", g))
    };
  }

  // Bốn nút mũi tên trong menu chuột phải: bấm là xếp luôn một hướng, không mở
  // bảng. Giữ đúng khoảng cách mặc định cũ — lên/xuống dùng chiều cao thẻ (nhỏ)
  // làm khoảng cách tầng nên nhìn chật hơn trái/phải (dùng chiều rộng thẻ), phải
  // nới thêm cho hai hướng dọc.
  function arrangeAsTree(rootKind, rootId, direction) {
    if (role === "viewer") return;
    const vertical = direction === "down" || direction === "up";
    const next = treeArranged(board, rootKind, rootId, {
      ...TREE_OPTS, directions: [direction], depth: vertical ? 110 : 70
    });
    setColorMenu(null);
    if (next) commitAndSave(next);
  }

  // Bảng Xếp cây. Cả phiên chỉnh (mở bảng → kéo thanh trượt chán chê → đóng) chỉ
  // ghi MỘT mốc hoàn tác, ghi ngay lúc mở: kéo thanh trượt mà mỗi nấc một mốc
  // thì Ctrl+Z sau đó phải bấm ba chục lần mới về được chỗ cũ.
  function openTreePanel(rootKind, rootId) {
    if (role === "viewer") return;
    setColorMenu(null);
    const base = board;
    treeBaseRef.current = base;
    setTreeUI({ kind: rootKind, id: rootId });
    const next = treeArranged(base, rootKind, rootId, treeOpts);
    if (!next) return;                        // gốc trơ trọi: bảng vẫn mở, chưa xếp gì
    recordHistory(base);
    treeLastRef.current = next;
    setBoard(next);
    saveNow(next);
  }

  function previewTree(opts) {
    setTreeOpts(opts);
    const base = treeBaseRef.current;
    if (!base || !treeUI) return;
    const next = treeArranged(base, treeUI.kind, treeUI.id, opts);
    if (!next) return;
    treeLastRef.current = next;
    setBoard(next);                           // chỉ trên máy mình, chưa lưu
  }

  // Nhả tay khỏi thanh trượt (hoặc bấm một hướng) mới lưu server + phát cho
  // người khác — kéo là gửi thì một cú kéo thành mấy chục lượt ghi.
  function commitTree() {
    const next = treeLastRef.current;
    if (next) saveNow(next);
  }

  function closeTreePanel() {
    commitTree();
    setTreeUI(null);
    treeBaseRef.current = null;
    treeLastRef.current = null;
  }

  function zoomToNodes(ids) {
    if (!ids || ids.length === 0) return;
    const targets = board.nodes.filter((n) => ids.includes(n.id));
    if (targets.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    targets.forEach((n) => {
      const { w, h } = frameCardSize(n.id);
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
    });
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = maxX - minX + pad * 2, bboxH = maxY - minY + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(minX - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(minY - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function zoomToSelection() {
    zoomToNodes(selectedIds.size > 0 ? Array.from(selectedIds) : board.nodes.map((n) => n.id));
  }

  function jumpToCard(id) {
    setSelectedIds(new Set([id]));
    zoomToNodes([id]);
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }

  // Đưa con trỏ của một người khác vào giữa màn hình. Camera là dữ liệu riêng
  // từng máy (lib/camera.js) nên chỉ setBoard, không commit vào lịch sử undo —
  // nhìn sang chỗ đồng đội không phải là một thao tác sửa board.
  //
  // Đi qua setCamera (không setBoard thẳng) để nó huỷ ghim: đang bám màn hình A
  // mà bấm nhảy tới con trỏ B thì vòng bám sẽ kéo ngược về A ngay khung hình
  // sau, và cú bấm trông như không có tác dụng gì.
  function jumpToPeer(peer) {
    const rect = viewportRef.current.getBoundingClientRect();
    const { scale } = board.view;
    setCamera({ scale, panX: rect.width / 2 - peer.x * scale, panY: rect.height / 2 - peer.y * scale });
    // Con trỏ peer nhỏ và có thể đang đứng yên giữa một rừng thẻ — nháy sáng
    // một nhịp để mắt bắt được sau khi màn hình vừa nhảy.
    setSpotlightPeerId(peer.socketId);
    setTimeout(() => setSpotlightPeerId((cur) => (cur === peer.socketId ? null : cur)), 1600);
  }

  function jumpToGroup(group) {
    const rect = viewportRef.current.getBoundingClientRect();
    const pad = 60;
    const bboxW = group.w + pad * 2, bboxH = group.h + pad * 2;
    let scale = Math.min(rect.width / bboxW, rect.height / bboxH, MAX_SCALE);
    scale = Math.max(scale, MIN_SCALE);
    setCamera({
      scale,
      panX: -(group.x - pad) * scale + (rect.width - bboxW * scale) / 2,
      panY: -(group.y - pad) * scale + (rect.height - bboxH * scale) / 2
    });
  }

  function startPresentation() {
    if (board.groups.length === 0) return;
    // Đóng mọi UI tạm thời trước khi trình chiếu — CSS chỉ ẩn được chrome cố
    // định, còn popover/modal đang mở phải đóng bằng state.
    setColorMenu(null);
    setEdgeMenu(null);
    setBadgeUI(null);
    setCommentsFor(null);
    setEditingId(null);
    setIoOpen(false);
    setCaptureOpen(false);
    prePresentViewRef.current = board.view;
    setPresentIndex(0);
    jumpToGroup(board.groups[0]);
  }

  // Đọc thẳng `presentIndex` từ state (đã nằm trong deps của effect keydown)
  // thay vì dùng setState updater: jumpToGroup tự setState + lưu, không được
  // gọi bên trong updater (side effect trong updater bị cấm).
  function stepPresentation(delta) {
    if (board.groups.length === 0) { exitPresentation(); return; }
    // Khung có thể bị xoá giữa chừng (canvas vẫn tương tác được) → kẹp lại
    // chỉ số hiện tại trước khi bước.
    const current = Math.min(presentIndex, board.groups.length - 1);
    const next = Math.min(board.groups.length - 1, Math.max(0, current + delta));
    if (next !== presentIndex) {
      setPresentIndex(next);
      jumpToGroup(board.groups[next]);
    }
  }

  function exitPresentation() {
    setPresentIndex(null);
    if (prePresentViewRef.current) {
      setCamera(prePresentViewRef.current);
      prePresentViewRef.current = null;
    }
  }

  function exportMarkdown() {
    const md = board.kind === "game-design"
      ? gameDesignMarkdown(board)
      : outlineToMarkdown(board, frameCardSize, { other: t`Khác`, links: t`Liên kết` });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${board.kind === "game-design" ? "game-design" : "idea-map"}-${exportVersion(board).replace(/[^a-zA-Z0-9]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportVersionedJson() {
    const payload = board.kind === "game-design" ? exportPackage({ ...board, name: boardName }) : board;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${board.kind === "game-design" ? "game-design" : "idea-map"}-${exportVersion(board).replace(/[^a-zA-Z0-9]/g, "-")}.json`; a.click(); URL.revokeObjectURL(url);
  }

  function exportPng() {
    const styles = getComputedStyle(document.documentElement);
    const v = (name) => styles.getPropertyValue(name).trim();
    const theme = {
      bg: v("--bg"), surface: v("--surface-2"), line: v("--line"),
      ink: v("--ink"), inkDim: v("--ink-dim"), accent: v("--accent"),
      colorOf: (token) => v(`--${token}`)
    };
    const canvas = drawBoardToCanvas(board, frameCardSize, theme);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "idea-map.png"; a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function nudgeSelection(dx, dy) {
    if (selectedIds.size === 0 && selectedGroupIds.size === 0 && selectedDrawingIds.size === 0) return;
    if (nudgeBaseRef.current == null) {
      nudgeBaseRef.current = board;   // history recorded once per burst, at burst end
      // Mỗi loạt nhích là MỘT lượt live riêng. Thiếu dòng này thì gói dùng lại
      // strokeId của lượt kéo trước và đè lên entry của nó.
      inkLive.beginMove();
    }
    // Cùng tập với cú kéo bằng chuột: khung đang chọn đi kèm ruột của nó.
    const { groupIds, nodeIds } = selectionDragSet(board, selectedGroupIds, selectedIds);
    const moveNodes = new Set(nodeIds);
    const moveGroups = new Set(groupIds);
    const next = {
      ...board,
      nodes: board.nodes.map((n) => (moveNodes.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
      groups: board.groups.map((g) => (moveGroups.has(g.id) ? { ...g, x: g.x + dx, y: g.y + dy } : g)),
      // Nét vẽ / hình / chữ nhích cùng cả cụm. Chúng KHÔNG vào publishGeom bên
      // dưới: gói geom chỉ mang thẻ và khung, người khác thấy nét vẽ nhảy tới
      // chỗ mới ở lần lưu — cùng cách cú kéo nét bằng chuột đang làm.
      drawings: (board.drawings || []).map((d) => (selectedDrawingIds.has(d.id) ? moveDrawing(d, dx, dy) : d))
    };
    setBoard(next);
    // Nhích bằng phím mũi tên cũng là một cú "kéo": người khác phải thấy thẻ
    // chạy ngay, chứ không đợi bản lưu 500ms sau mới nhảy một phát.
    publishGeom({
      nodes: next.nodes.filter((n) => moveNodes.has(n.id)),
      groups: next.groups.filter((g) => moveGroups.has(g.id))
    });
    // Nét vẽ / hình / chữ trong cụm cũng nhích, và chúng đi kênh riêng.
    if (selectedDrawingIds.size) inkLive.pushMove(movingPayload(next, selectedDrawingIds));
    saveDebounced(next);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      finishGeom({
        nodes: boardRef.current.nodes.filter((n) => moveNodes.has(n.id)),
        groups: boardRef.current.groups.filter((g) => moveGroups.has(g.id))
      });
      if (selectedDrawingIds.size) inkLive.endMove(movingPayload(boardRef.current, selectedDrawingIds));
      flushNudgeBurst();
    }, 600);
  }

  function handleImportConfirm() {
    try {
      const payload = JSON.parse(ioText);
      const parsed = payload?.format === "game-design-board-export/v1" && payload.board ? payload.board : payload;
      if (!parsed.nodes || !parsed.edges || !parsed.view) throw new Error("bad shape");
      if (!Array.isArray(parsed.groups)) parsed.groups = [];
      if (typeof parsed.nextGroupId !== "number") parsed.nextGroupId = 1;
      commitAndSave(normalizeGameDesignBoard(parsed));
      setIoOpen(false);
    } catch (e) {
      alert(t`JSON không hợp lệ — kiểm tra lại nội dung đã dán.`);
    }
  }

  function confirmCapture() {
    const titles = captureText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (titles.length === 0) { setCaptureOpen(false); return; }
    setFocusId(null);
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - board.view.panX) / board.view.scale;
    const cy = (rect.height / 2 - board.view.panY) / board.view.scale;
    const estH = 90;
    const cols = Math.ceil(Math.sqrt(titles.length));
    const items = titles.map((_, i) => ({ id: i, w: CARD_W, h: estH }));
    const gridW = cols * (CARD_W + 24) - 24;
    const rows = Math.ceil(titles.length / cols);
    const gridH = rows * (estH + 24) - 24;
    const pos = gridLayout(items, { x: Math.round(cx - gridW / 2), y: Math.round(cy - gridH / 2) }, cols);
    let nextId = board.nextNodeId;
    const newNodes = titles.map((title, i) => ({
      id: nextId + i,
      title,
      desc: "",
      tagId: null,
      statusId: null,
      x: pos.get(i).x,
      y: pos.get(i).y
    }));
    commitAndSave({ ...board, nodes: [...board.nodes, ...newNodes], nextNodeId: nextId + titles.length });
    setCaptureOpen(false);
    setCaptureText("");
  }

  const hasNoStatus = board.nodes.some((n) => n.statusId == null);
  const hasNoTag = board.nodes.some((n) => n.tagId == null);
  const activeFilterCount =
    Object.values(filterStatus).filter(Boolean).length +
    Object.values(filterTags).filter(Boolean).length +
    (filterFav ? 1 : 0) +
    (search.trim() ? 1 : 0);
  const matchCount = matches.length;

  function goToMatch(delta) {
    if (matches.length === 0) return;
    const next = matchIdx < 0
      ? (delta > 0 ? 0 : matches.length - 1)
      : (matchIdx + delta + matches.length) % matches.length;
    setMatchIdx(next);
    jumpToCard(matches[next].id);
  }

  function togglePanel(key) {
    setPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const anyPanelOn = PANEL_KEYS.some((k) => panels[k]);

  function clearFilters() {
    setFilterStatus({});
    setFilterTags({});
    setFilterFav(false);
    setSearch("");
  }

  function toggleSearch() {
    setSearchOpen((open) => {
      if (open) setSearch("");
      return !open;
    });
  }

  function openBadgeMenu(e, kind, def) {
    if (role === "viewer") return;
    e.preventDefault();
    e.stopPropagation();
    setBadgeUI({ mode: "edit", kind, def, x: e.clientX, y: e.clientY });
  }

  function openColorMenu(e, kind, id) {
    e.preventDefault();
    e.stopPropagation();
    if (suppressContextMenuRef.current) { suppressContextMenuRef.current = false; return; }
    setEdgeMenu(null);
    setCommentsFor(null);
    setColorMenu({ kind, id, x: e.clientX, y: e.clientY });
  }

  function applyNodeColor(nodeId, color) {
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n)) });
    setColorMenu(null);
  }

  function toggleNodeLock(id) {
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === id ? { ...n, locked: !n.locked } : n)) });
    setColorMenu(null);
  }

  function applyNodeShape(nodeId, shape) {
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, shape } : n)) });
  }
  function applyNodeDashed(nodeId, dashed) {
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, dashed } : n)) });
  }
  function applyNodeLevel(nodeId, level) {
    commitAndSave({ ...board, nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, ...levelPatch(level) } : n)) });
  }
  function toggleGroupLock(id) {
    commitAndSave({ ...board, groups: board.groups.map((g) => (g.id === id ? { ...g, locked: !g.locked } : g)) });
    setColorMenu(null);
  }

  function toggleFavorite(nodeId) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const favs = n.favorites ?? [];
        return { ...n, favorites: favs.includes(currentUser) ? favs.filter((f) => f !== currentUser) : [...favs, currentUser] };
      })
    });
  }

  function addComment(nodeId, text) {
    if (!text.trim()) return false;
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: [...(n.comments ?? []), { text: text.trim(), author: currentUser, at: new Date().toISOString() }] }
        : n))
    });
    return true;
  }

  function deleteComment(nodeId, index) {
    commitAndSave({
      ...board,
      nodes: board.nodes.map((n) => (n.id === nodeId
        ? { ...n, comments: (n.comments ?? []).filter((_, i) => i !== index) }
        : n))
    });
  }

  function openBadgeCreate(e, kind) {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setBadgeUI({ mode: "create", kind, x: r.left, y: r.bottom + 4 });
  }

  function createBadge(kind, name, color) {
    if (kind === "status") {
      const id = board.nextStatusId;
      commitAndSave({ ...board, statuses: [...board.statuses, { id, name, color }], nextStatusId: id + 1 });
    } else {
      const id = board.nextTagId;
      commitAndSave({ ...board, tags: [...board.tags, { id, name, color }], nextTagId: id + 1 });
    }
    setBadgeUI(null);
  }

  function updateBadge(kind, id, name, color) {
    if (kind === "status") {
      commitAndSave({ ...board, statuses: board.statuses.map((s) => (s.id === id ? { ...s, name, color } : s)) });
    } else {
      commitAndSave({ ...board, tags: board.tags.map((tg) => (tg.id === id ? { ...tg, name, color } : tg)) });
    }
    setBadgeUI(null);
  }

  function deleteBadge(kind, id) {
    if (kind === "status") {
      commitAndSave({
        ...board,
        statuses: board.statuses.filter((s) => s.id !== id),
        nodes: board.nodes.map((n) => (n.statusId === id ? { ...n, statusId: null } : n))
      });
      setFilterStatus((prev) => { const next = { ...prev }; delete next[String(id)]; return next; });
    } else {
      commitAndSave({
        ...board,
        tags: board.tags.filter((tg) => tg.id !== id),
        nodes: board.nodes.map((n) => (n.tagId === id ? { ...n, tagId: null } : n))
      });
      setFilterTags((prev) => { const next = { ...prev }; delete next[String(id)]; return next; });
    }
    setBadgeUI(null);
  }

  function openPaletteEditor(e, entry) {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setPaletteUI(entry
      ? { mode: "edit", id: entry.id, hex: entry.hex, x: r.left, y: r.bottom + 6 }
      : { mode: "create", hex: "#888888", x: r.left, y: r.bottom + 6 });
  }

  // Nền và bộ màu đi qua đúng đường lưu của mọi thay đổi board khác, nên tự có
  // hoàn tác và tự phát realtime — không cần đường riêng.
  function setBoardBg(next) {
    if (board.bg === next) return;
    commitAndSave({ ...board, bg: next });
  }

  function setBoardGrid(next) {
    if ((board.grid ?? null) === next) return;
    commitAndSave({ ...board, grid: next });
  }

  function setBoardPack(next) {
    if (board.pack === next) return;
    commitAndSave({ ...board, pack: next });
  }

  function createPaletteColor(hex) {
    const id = board.nextPaletteId;
    commitAndSave({ ...board, palette: [...board.palette, { id, hex }], nextPaletteId: id + 1 });
    setPaletteUI(null);
  }

  // Popover ở lại sau khi đổi màu: sửa xong còn có thể chọn lại hoặc xoá luôn.
  function updatePaletteColor(id, hex) {
    commitAndSave({ ...board, palette: board.palette.map((c) => (c.id === id ? { ...c, hex } : c)) });
  }

  function deletePaletteColor(id) {
    commitAndSave(removePaletteColor(board, id));
    setPaletteUI(null);
  }

  function handleColorMouseDown(e, token) {
    if (e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;
    const THRESHOLD = 5;

    // Badge phải kiểm TRƯỚC thẻ: .status-pill nằm bên trong .idea-card, nếu xét
    // thẻ trước thì thả vào pill sẽ tô thẻ chứ không đổi màu badge.
    function colorTargetAt(clientX, clientY) {
      const el = document.elementFromPoint(clientX, clientY);
      if (el) {
        const badge = el.closest("[data-badge-kind][data-badge-id]");
        if (badge) return { kind: badge.getAttribute("data-badge-kind"), id: Number(badge.getAttribute("data-badge-id")) };
        const card = el.closest(".idea-card[data-id]");
        if (card) return { kind: "node", id: Number(card.getAttribute("data-id")) };
        const edge = el.closest("[data-edge-id]");
        if (edge) return { kind: "edge", id: Number(edge.getAttribute("data-edge-id")) };
      }
      // Nét bút / hình khối / chữ không có nút DOM để elementFromPoint tìm ra
      // (cả lớp vẽ là một <svg> pointer-events: none), nên phải dò bằng hình học
      // trên toạ độ canvas — và dò ngoài nhánh `el` ở trên, không phụ thuộc vào
      // việc có tìm được nút DOM nào dưới con trỏ hay không. Xét SAU thẻ và dây:
      // thả màu lên chỗ một nét vẽ nằm đè lên thẻ thì cái người ta nhắm tới gần
      // như luôn là cái thẻ.
      const p = clientToCanvas(clientX, clientY);
      const hits = drawingsHitBy(boardRef.current?.drawings || [], p, PICK_RADIUS);
      if (hits.length) return { kind: "drawing", id: hits[hits.length - 1] };
      // Chỗ TRỐNG bên trong vùng chọn: cả cụm nhận màu. Xét CUỐI cùng, sau mọi
      // đích cụ thể — thả trúng một cái thẻ trong vùng chọn thì vẫn đi đường cũ
      // (dropIdsFor cũng đã tô cả vùng), còn đây là để không phải nhắm cho trúng
      // một cái gì cả.
      if (selBounds && pointInBounds(selBounds, p)) return { kind: "selection" };
      return null;
    }

    const onMove = rafThrottle((ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > THRESHOLD) dragging = true;
      if (!dragging) return;
      setColorDrag({ token, x: ev.clientX, y: ev.clientY });
      const target = colorTargetAt(ev.clientX, ev.clientY);
      // "selection" cũng phải sáng lên: thả vào chỗ trống mà không có phản hồi
      // nào thì người dùng không tin là nó sẽ ăn, và sẽ đi nhắm vào từng cái một
      // — đúng cái việc mà đích này sinh ra để khỏi phải làm.
      if (target && target.kind === "selection") setDropTargetId(SELECTION_DROP);
      else setDropTargetId(target && target.kind === "node" ? { id: target.id, kind: "node" } : null);
    });
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onMove.cancel();
      if (!dragging) return;
      const target = colorTargetAt(ev.clientX, ev.clientY);
      setColorDrag(null);
      setDropTargetId(null);
      if (!target) return;
      // Thả vào chỗ trống trong vùng chọn: đi đúng hàm mà menu chuột phải đang
      // dùng cho "tô cả vùng chọn", nên hai lối vào không bao giờ cho hai kết
      // quả khác nhau.
      if (target.kind === "selection") { applyColorToSelection(token); return; }
      // Badge đi đường applyColorTo như cũ — nó không thuộc vùng chọn nào.
      if (target.kind === "node" || target.kind === "edge" || target.kind === "drawing") {
        commitAndSave(applyColorToMany(board, target.kind, dropIdsFor(target.kind, target.id), token));
      } else {
        commitAndSave(applyColorTo(board, target, token));
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Nối lớp vỏ ổn định ở trên với bản mới nhất của từng hàm xử lý. Gán thường,
  // không phải hook — nên đặt được sau các nhánh return sớm.
  actionsRef.current = {
    nodeMouseDown: handleNodeMouseDown,
    cardClick: handleCardClick,
    openColorMenu,
    connectorMouseDown: handleConnectorMouseDown,
    deleteNode,
    toggleFavorite,
    openComments: (e, id) => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id, x: e.clientX, y: e.clientY }); },
    liveText: (id, field, value) => sendLiveText({ nodeId: id, field, value }),
    saveNodeEdit,
    saveNodeEditAndNext,
    dropImage: handleImageDrop,
    removeImage: removeNodeImage,
    imageResize: handleImageResizeMouseDown,
    pdfResize: handlePdfResizeMouseDown,
    groupMouseDown: handleGroupMouseDown,
    deleteGroup,
    saveGroupTitle,
    groupResizeMouseDown: handleGroupResizeMouseDown,
    groupConnectorMouseDown: handleGroupConnectorMouseDown
  };

  return (
    <div className={"shell" + (presentIndex != null ? " presenting" : "") + (role === "viewer" ? " readonly" : "")} onContextMenu={handlePageContextMenu}>
      {role === "viewer" && (
        <div className="readonly-banner"><Trans>Chỉ xem — bạn không có quyền chỉnh sửa board này.</Trans></div>
      )}
      {/* Khai báo màu tự tạo trong cây React: sửa hex là mọi card/dây/badge dùng
          var(--pal-N) repaint ngay, không cần đi ghi lại từng chỗ tham chiếu. */}
      <style>{paletteStyle}</style>
      {/* ĐẢO TO — góc trên trái. Vừa là bảng điều khiển (☰, tên board, tìm kiếm,
          bật/tắt panel) vừa là CHỖ NEO của các đảo nhỏ. Nó co lại còn bằng đúng
          hàng nút của mình khi không panel nào neo vào, nên bảng trống thì không
          còn một pixel nào bị chiếm — khác hẳn .topbar + .filterbar cũ ăn ~140px
          vĩnh viễn. */}
      <div className="island tl">
        <div className="island-row">
          {/* Một ☰ duy nhất thay cho ba menu Board/Dữ liệu/Xem + cụm thiết lập:
              tất cả đều là việc thỉnh thoảng mới làm, không đáng chiếm mặt tiền.
              data-mutating = móc CSS đánh dấu control ghi dữ liệu board; ở chế độ
              chỉ xem chúng bị vô hiệu hoá, phần còn lại vẫn dùng được.
              "Mời thành viên" nằm ở PresenceBar (đảo người), cạnh danh sách người
              đang mở board — mời ai đó là việc của cùng một mạch suy nghĩ. */}
          <TopMenu label={<IconMenu />} title={t`Menu`}>
            <Link to="/idea-map" className="btn ghost"><Trans>← Danh sách board</Trans></Link>
            <div className="menubar-sep" />
            <button className="btn ghost" onClick={() => { setIoMode("export"); setIoText(JSON.stringify(board.kind === "game-design" ? exportPackage({ ...board, name: boardName }) : board, null, 2)); setIoOpen(true); }}><Trans>Xuất JSON</Trans></button>
            <button className="btn ghost" onClick={exportVersionedJson}><Trans>Tải JSON</Trans></button>
            <button className="btn ghost" data-mutating onClick={() => { setIoMode("import"); setIoText(""); setIoOpen(true); }}><Trans>Nhập JSON</Trans></button>
            <button className="btn ghost" onClick={openSnapshots}>Snapshots</button>
            {/* Dung lượng PDF đứng cùng nhóm "dữ liệu" với Xuất/Nhập JSON, không
                đứng cùng nhóm "cách xem" — nó nói về thứ đang chiếm chỗ trên
                kho, chứ không đổi gì trên màn hình. */}
            <PdfUsage />
            <div className="menubar-sep" />
            <button className="btn ghost" disabled={board.groups.length === 0} onClick={startPresentation}><Trans>Trình chiếu</Trans></button>
            <button className={"btn ghost toggle" + (outlineOpen ? " active" : "")} onClick={() => setOutlineOpen((v) => !v)}><Trans>Mục lục</Trans></button>
            {/* Ngôn ngữ, sáng/tối và skin đã rời menu này sang panel Giao diện ở
                thanh đáy — chúng cùng một họ với nền bảng và bộ màu, để rải hai
                chỗ thì muốn chỉnh giao diện phải nhớ mở hai nơi. Còn lại ở đây
                đúng ba nhóm: đi đâu, dữ liệu, và cách xem. */}
          </TopMenu>

          <span className="island-name" title={boardName}>{boardName}</span>

          {board.kind === "game-design" && <button
            type="button"
            className={"btn ghost gd-brief-trigger" + (briefOpen ? " active" : "")}
            title="Mở Game brief"
            onClick={() => {
              setDesignEditId(null);
              setSelectedEdgeIds(EMPTY_SET);
              setFlowOpen(false);
              setHandoffOpen(false);
              setDecisionTimelineOpen(false);
              setBriefOpen(true);
            }}
          >Game brief</button>}

          {board.kind === "game-design" && <button
            type="button"
            className={"btn ghost gd-brief-trigger" + (flowOpen ? " active" : "")}
            title="Mở Game flow"
            onClick={() => {
              setDesignEditId(null);
              setSelectedEdgeIds(EMPTY_SET);
              setBriefOpen(false);
              setHandoffOpen(false);
              setDecisionTimelineOpen(false);
              setFlowOpen(true);
            }}
          >Game flow</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (balanceOpen ? " active" : "")} title="Mở Balance sheet" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setBalanceOpen(true); }}>Balance</button>}

          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (handoffOpen ? " active" : "")} title="Mở Team handoff" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setDecisionTimelineOpen(false); setHandoffOpen(true); }}>Handoff</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (decisionTimelineOpen ? " active" : "")} title="Mở Decision timeline" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(true); }}>Decisions</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (insightsOpen ? " active" : "")} title="Mở Game Design insights" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setInsightsOpen(true); }}>Insights</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (impactOpen ? " active" : "")} title="Mở dependency impact map" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setInsightsOpen(false); setReportsOpen(false); setImpactCardId(null); setImpactOpen(true); }}>Impact</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (playtestsOpen ? " active" : "")} onClick={() => { setDesignEditId(null); setPlaytestsOpen(true); }}>Playtests</button>}
          {board.kind === "game-design" && <button type="button" className={"btn ghost gd-brief-trigger" + (reportsOpen ? " active" : "")} title="Mở Report Center" onClick={() => { setDesignEditId(null); setSelectedEdgeIds(EMPTY_SET); setBriefOpen(false); setFlowOpen(false); setBalanceOpen(false); setHandoffOpen(false); setDecisionTimelineOpen(false); setReportsOpen(true); }}>Reports</button>}

          <button
            type="button"
            className={"island-btn" + (searchOpen ? " on" : "")}
            title={t`Tìm kiếm (Ctrl+F)`}
            onClick={toggleSearch}
          ><IconSearch /></button>
          {searchOpen && (
            <div className="search-box">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t`Tìm theo tên/mô tả…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); goToMatch(e.shiftKey ? -1 : 1); }
                  // Escape đóng ô tìm — cùng phản xạ với mọi ô nhập khác trong app.
                  if (e.key === "Escape") { e.preventDefault(); toggleSearch(); }
                }}
              />
              {search.trim() && (
                <>
                  <span className="search-count mono">{matches.length ? matchIdx + 1 : 0}/{matches.length}</span>
                  <button type="button" className="island-btn" title={t`Kết quả trước (Shift+Enter)`} onClick={() => goToMatch(-1)}>↑</button>
                  <button type="button" className="island-btn" title={t`Kết quả sau (Enter)`} onClick={() => goToMatch(1)}>↓</button>
                </>
              )}
            </div>
          )}

          <div className="island-sep" />

          {/* Giao diện đứng ở ĐÂY chứ không ở thanh đáy: ba nút dưới đó mở ra bộ
              LỌC (bấm chip là thẻ bị làm mờ), còn cái này là THIẾT LẬP, không lọc
              gì cả. Cùng một dải chỉ cách nhau một vạch ngăn thì vẫn đọc ra là
              cùng loại — phải tách hẳn sang chỗ khác.
              Nội dung bung ra ngay dưới nút, không hiện tuốt dưới đáy: bấm ở đây
              mà kết quả nhảy ra chỗ khác thì mắt phải đi tìm. */}
          <TopMenu label={<IconBoardStyle />} title={t`Giao diện`} wide closeOnClick={false}>
            {/* Ranh giới quan trọng nhất của bảng này: ba hàng trên chỉ đổi cho
                MÌNH (localStorage), hai hàng dưới ghi vào dữ liệu board nên MỌI
                NGƯỜI cùng thấy. Không nói rõ thì người ta đổi nền bảng mà tưởng
                chỉ mình thấy. Hai hàng dưới đã mang data-mutating nên tài khoản
                chỉ xem thấy chúng mờ đi — thêm một tín hiệu nữa cùng hướng. */}
            <div className="theme-section"><Trans>Chỉ mình bạn thấy</Trans></div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Ngôn ngữ</Trans></span>
              <div className="fb-chips"><LocaleToggle /></div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Sáng/tối</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (theme === "light" ? " active" : "")}
                  onClick={() => setTheme("light")}
                ><Trans>Sáng</Trans></button>
                <button
                  className={"btn ghost toggle" + (theme === "dark" ? " active" : "")}
                  onClick={() => setTheme("dark")}
                ><Trans>Tối</Trans></button>
              </div>
            </div>
            {/* Cuộn hai ngón nghĩa là gì. Đứng ở nhóm "chỉ mình bạn thấy" vì nó
                là chuyện CÁI MÁY đang cầm, không phải chuyện cái bảng: cùng một
                board mở trên laptop và trên máy có chuột rời thì hai người muốn
                hai hành vi khác nhau.
                "Tự động" nhận thiết bị theo dấu hiệu của từng sự kiện wheel và
                đúng gần hết các trường hợp — nhưng trên macOS thì nút lăn chuột
                cho ra đúng những con số mà touchpad cho, không có cách nào tách.
                Đó là lý do hai nút chọn tay tồn tại, không phải để cho đủ bộ. */}
            <div className="theme-row">
              <span className="fb-count"><Trans>Cuộn hai ngón</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (wheelMode === "auto" ? " active" : "")}
                  title={t`Nhận thiết bị theo cách cuộn: touchpad thì lia bảng, nút lăn thì thu phóng`}
                  onClick={() => setWheelMode("auto")}
                ><Trans>Tự động</Trans></button>
                <button
                  className={"btn ghost toggle" + (wheelMode === "pan" ? " active" : "")}
                  title={t`Cuộn luôn là lia bảng. Chụm hai ngón (hoặc Ctrl+cuộn) để thu phóng`}
                  onClick={() => setWheelMode("pan")}
                ><Trans>Lia bảng</Trans></button>
                <button
                  className={"btn ghost toggle" + (wheelMode === "zoom" ? " active" : "")}
                  title={t`Cuộn luôn là thu phóng. Giữ Shift để lia bảng`}
                  onClick={() => setWheelMode("zoom")}
                ><Trans>Thu phóng</Trans></button>
              </div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Kiểu vẽ</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (skin !== "sketch" ? " active" : "")}
                  onClick={() => { if (skin === "sketch") toggleSkin(); }}
                ><Trans>Sạch</Trans></button>
                <button
                  className={"btn ghost toggle" + (skin === "sketch" ? " active" : "")}
                  onClick={() => { if (skin !== "sketch") toggleSkin(); }}
                ><IconSketch /> <Trans>Vẽ tay</Trans></button>
              </div>
            </div>

            <div className="theme-section"><Trans>Mọi người cùng thấy</Trans></div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Nền bảng</Trans></span>
              <div className="fb-chips">
                {/* Nút đầu là "theo giao diện" (bg = null): nền chạy theo sáng/tối
                    như trước khi có preset. Nó KHÔNG nằm trong BOARD_BGS vì đó là
                    danh sách preset, còn đây là "không preset nào". */}
                <button
                  className={"bg-swatch bg-none" + (board.bg == null ? " on" : "")}
                  data-mutating
                  disabled={role === "viewer"}
                  onClick={() => setBoardBg(null)}
                  title={t`Theo giao diện sáng/tối`}
                />
                {BOARD_BGS.map((id) => (
                  <button
                    key={id}
                    className={"bg-swatch" + (board.bg === id ? " on" : "")}
                    data-bg={id}
                    data-mutating
                    disabled={role === "viewer"}
                    onClick={() => setBoardBg(id)}
                    title={BG_LABEL[id]}
                  />
                ))}
              </div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Lưới</Trans></span>
              <div className="fb-chips">
                {/* Lưới chấm là kiểu duy nhất có từ đầu nên nó là grid = null,
                    y hệt "theo giao diện" ở hàng nền: board cũ trong DB không có
                    field này và phải vẽ ra đúng như trước. */}
                <button
                  className={"grid-swatch" + (board.grid == null ? " on" : "")}
                  data-grid="dots"
                  data-mutating
                  disabled={role === "viewer"}
                  onClick={() => setBoardGrid(null)}
                  title={GRID_LABEL.dots}
                />
                {BOARD_GRIDS.map((id) => (
                  <button
                    key={id}
                    className={"grid-swatch" + (board.grid === id ? " on" : "")}
                    data-grid={id}
                    data-mutating
                    disabled={role === "viewer"}
                    onClick={() => setBoardGrid(id)}
                    title={GRID_LABEL[id]}
                  />
                ))}
              </div>
            </div>
            <div className="theme-row">
              <span className="fb-count"><Trans>Bộ màu</Trans></span>
              <div className="fb-chips">
                <button
                  className={"btn ghost toggle" + (board.pack == null ? " active" : "")}
                  data-mutating
                  disabled={role === "viewer"}
                  onClick={() => setBoardPack(null)}
                ><Trans>Cổ điển</Trans></button>
                {COLOR_PACKS.map((id) => (
                  <button
                    key={id}
                    className={"btn ghost toggle" + (board.pack === id ? " active" : "")}
                    data-mutating
                    disabled={role === "viewer"}
                    onClick={() => setBoardPack(id)}
                  >{PACK_LABEL[id]}</button>
                ))}
              </div>
            </div>
          </TopMenu>
        </div>

        {activeFilterCount > 0 && (
          <div className="fb-tail">
            <span className="fb-count mono" title={t`Số ý tưởng khớp bộ lọc`}>
              <Trans>Khớp {matchCount}/{board.nodes.length}</Trans>
            </span>
            <button className="fb-clear" onClick={clearFilters}><Trans>Xoá lọc</Trans></button>
          </div>
        )}

      </div>

      {/* THANH ĐÁY — đảo nút bật panel, và ngay cạnh nó là đảo nội dung của panel
          đang bật. Panel chỉ sống ở đúng chỗ này: không neo, không nổi, không kéo
          đi đâu được. Đổi lại thì cũng không còn cách nào làm mất nó. */}
      <div className="hud-bottom">
        <div className="island">
          <div className="island-row">
            <button type="button" className={"island-btn" + (panels.status ? " on" : "")} title={t`Trạng thái`} onClick={() => togglePanel("status")}><IconStatus /></button>
            <button type="button" className={"island-btn" + (panels.tag ? " on" : "")} title={t`Nhãn`} onClick={() => togglePanel("tag")}><IconTag /></button>
            <button type="button" className={"island-btn" + (panels.palette ? " on" : "")} title={t`Bảng màu`} onClick={() => togglePanel("palette")}><IconPalette /></button>
            {/* ★ xuống đây theo ba nút kia: nó cũng là BỘ LỌC. Ở lại đảo trên trái
                thì nó đứng lẫn giữa menu, tên board và tìm kiếm — đúng kiểu trộn
                mà cả nhóm này vừa được dọn cho hết. Khác ba nút bên trái ở chỗ nó
                không mở ra khối nội dung nào, bật là ăn ngay. */}
            <button type="button" className={"island-btn" + (filterFav ? " on" : "")} title={t`Chỉ hiện thẻ yêu thích`} onClick={() => setFilterFav((v) => !v)}><IconStar /></button>
          </div>
        </div>

        {anyPanelOn && (
        <div className="island">
        <div className="filter-dock">
        {panels.status && (
          <FilterPanel title={t`Trạng thái`}>
            <div className="fb-chips">
              {board.statuses.map((s) => {
                const key = String(s.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle status" + (filterStatus[key] ? " on" : "")}
                    data-badge-kind="status"
                    data-badge-id={s.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "status", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "status", s)}
                    onClick={() => setFilterStatus((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán trạng thái — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(s.color) }}></span>
                    {s.name}
                  </span>
                );
              })}
              {hasNoStatus && (
                <span
                  className={"chip-toggle status" + (filterStatus["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "status", "none")}
                  onClick={() => setFilterStatus((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa có trạng thái`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không trạng thái</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "status")} title={t`Thêm trạng thái`}>+</button>
            </div>
          </FilterPanel>
        )}

        {panels.tag && (
          <FilterPanel title={t`Nhãn`}>
            <div className="fb-chips">
              {board.tags.map((tg) => {
                const key = String(tg.id);
                return (
                  <span
                    key={key}
                    className={"chip-toggle tag" + (filterTags[key] ? " on" : "")}
                    data-badge-kind="tag"
                    data-badge-id={tg.id}
                    onMouseDown={(e) => handleChipMouseDown(e, "tag", key)}
                    onContextMenu={(e) => openBadgeMenu(e, "tag", tg)}
                    onClick={() => setFilterTags((prev) => ({ ...prev, [key]: !prev[key] }))}
                    title={t`Bấm để lọc — kéo thả vào thẻ để gán nhãn — chuột phải để sửa`}
                  >
                    <span className="dot" style={{ background: colorVar(tg.color) }}></span>
                    {tg.name}
                  </span>
                );
              })}
              {hasNoTag && (
                <span
                  className={"chip-toggle tag" + (filterTags["none"] ? " on" : "")}
                  onMouseDown={(e) => handleChipMouseDown(e, "tag", "none")}
                  onClick={() => setFilterTags((prev) => ({ ...prev, none: !prev["none"] }))}
                  title={t`Lọc thẻ chưa gắn nhãn`}
                >
                  <span className="dot dot-empty"></span>
                  <Trans>Không nhãn</Trans>
                </span>
              )}
              <button className="fb-add" onClick={(e) => openBadgeCreate(e, "tag")} title={t`Thêm nhãn`}>+</button>
            </div>
          </FilterPanel>
        )}

        {panels.palette && (
          <FilterPanel title={t`Bảng màu`}>
            <div className="fb-chips">
              {board.palette.map((c) => (
                <button
                  key={c.id}
                  className="pal-swatch"
                  style={{ background: colorVar(`pal-${c.id}`) }}
                  onMouseDown={(e) => handleColorMouseDown(e, `pal-${c.id}`)}
                  onClick={(e) => openPaletteEditor(e, c)}
                  title={t`Bấm để sửa màu — kéo thả vào thẻ / dây / badge để tô màu`}
                />
              ))}
              <button className="fb-add" onClick={(e) => openPaletteEditor(e, null)} title={t`Thêm màu`}>+</button>
            </div>
            {board.palette.length === 0 && (
              <span className="fb-count"><Trans>Chưa có màu nào — bấm + để tạo.</Trans></span>
            )}
          </FilterPanel>
        )}
        </div>
        </div>
        )}
      </div>

      {/* ĐẢO NGƯỜI — góc trên phải. Ai đang mở board + nút mời. */}
      <div className="island tr">
        <div className="island-row">
          <PresenceBar
            user={user}
            socket={socket}
            canInvite={role === "owner"}
            onInvite={() => setInviteOpen(true)}
            onJumpToPeer={jumpToPeer}
            onLogout={logout}
            followingId={followingId}
            watcherCount={watcherCount}
            onFollowPeer={follow}
            onStopFollow={stopFollow}
          />
        </div>
      </div>

      <FollowBanner
        socket={socket}
        followingId={followingId}
        pendingId={pendingId}
        followError={followError}
        onStop={stopFollow}
      />

      {/* ĐẢO HOÀN TÁC — góc dưới trái, đối xứng với nút zoom ở góc dưới phải:
          cả hai đều là thao tác lên TRẠNG THÁI khung nhìn/bảng chứ không tạo ra
          nội dung, nên chúng thuộc về đáy màn hình, không phải mặt tiền.
          Chỗ này trước đây trống hoàn toàn. */}
      <div className="island bl">
        <div className="island-row">
          <button type="button" className="island-btn" data-mutating onClick={undo} disabled={past.length === 0} title={t`Hoàn tác (Ctrl+Z)`}><IconUndo /></button>
          <button type="button" className="island-btn" data-mutating onClick={redo} disabled={future.length === 0} title={t`Làm lại (Ctrl+Shift+Z)`}><IconRedo /></button>
          {saveError && (
            <span style={{ fontSize: 11, color: "var(--danger)", paddingRight: 4 }}>
              <Trans>Không lưu được lên server.</Trans>
            </span>
          )}
        </div>
      </div>

      <div
        className={"viewport" + (isPanning ? " panning" : "")}
        ref={viewportRef}
        onMouseDown={handleViewportMouseDown}
        onMouseDownCapture={handleViewportMouseDownCapture}
        onClickCapture={handleViewportClickCapture}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleViewportImageDrop}
        onMouseMove={handlePresenceMouseMove}
      >
        <ToolRail
          mode={mode}
          tool={tool}
          placeTool={mode === "place" ? placeTool : null}
          canEdit={role !== "viewer"}
          linkMode={linkMode}
          gameDesign={board.kind === "game-design"}
          onGameTemplate={addGameDesignCard}
          onMode={enterMode}
          onTool={(next) => { enterMode("draw"); setTool(next); }}
          onPlace={armPlace}
          onToggleLink={toggleLinkMode}
          onCapture={() => setCaptureOpen(true)}
        />
        {(mode === "draw" || mode === "place" || mode === "laser") && (
          <ToolOptions
            tool={mode === "place" ? placeTool : (mode === "laser" ? "laser" : tool)}
            // Laser có bộ nhớ riêng: màu thì cùng bảng với bút nhưng độ đậm là
            // đơn vị khác hẳn, nên hai thứ không được dùng chung một object.
            prefs={mode === "laser" ? laserPrefs : penPrefs}
            onPrefs={mode === "laser" ? setLaserPrefs : setPenPrefs}
            level={cardLevelPref}
            onLevel={setCardLevelPref}
          />
        )}
        {mode === "draw" && (
          <div className="ink-capture" style={{ cursor: eraseCursor }} onMouseDown={handleInkCaptureMouseDown} />
        )}
        {/* Vòng báo "đang giữ tay" — hiện ngay dưới con trỏ khi tay đứng lại.
            BA việc dùng chung một vòng: sắp BẮT HÌNH (nét vừa vẽ về hình chuẩn),
            sắp TẨY nét đang nằm dưới tay, và sắp ĐỔI bút ↔ cục gôm. `kind` thành
            luôn tên class nên mỗi việc một màu, và nét sắp bị tẩy thì mờ đi song
            song (useInk gọi setEraseIds).
            Không có vòng này thì cả hai cử chỉ đều vô hình: người dùng chỉ tình
            cờ gặp một lần rồi không hiểu vừa xảy ra chuyện gì.
            position: fixed nên toạ độ là toạ độ MÀN HÌNH, không phải toạ độ
            canvas — nó bám ngón tay, không bám bảng.
            Thời gian chạy do useInk tính sẵn và gửi kèm: hai chỗ giữ hai con số
            rồi lệch nhau thì vòng đầy xong mà chưa có gì xảy ra (hoặc ngược
            lại), và đó là kiểu lỗi không ai đọc code ra được. */}
        {ink.snapHint && (
          <div
            className={"snap-hint " + ink.snapHint.kind}
            style={{
              left: ink.snapHint.x,
              top: ink.snapHint.y,
              "--snap-hold": `${ink.snapHint.ms}ms`
            }}
          />
        )}
        {/* Cùng vai trò .ink-capture: phủ kín khung nhìn để di chuột ngang qua
            một cái thẻ vẫn ra vệt laser chứ không bị thẻ ăn mất chuột. */}
        {mode === "laser" && (
          <div
            className="laser-capture"
            onMouseDown={handleLaserMouseDown}
            onMouseMove={handleLaserMouseMove}
            onMouseUp={handleLaserMouseUp}
            // Rời khỏi lớp phủ (ra mép màn hình, hay đi lên thanh công cụ) thì
            // đóng lượt luôn: `mouseup` sau đó sẽ không rơi vào đây nữa, và bỏ
            // sót nó là lượt chỉ treo lại — quay vào bảng là vẽ tiếp dù đã thả
            // chuột từ lâu.
            onMouseLeave={handleLaserMouseUp}
          />
        )}
        {/* Ô nhập text. Nằm NGOÀI .canvas nên phải tự nhân camera vào: .canvas
            khai will-change: transform → nó là một stacking context, con của nó
            không thể nổi lên trên .ink-capture (z-index 8) để nhận được chuột.
            Cái giá là toạ độ và cỡ chữ phải tự quy đổi ở đây — bù lại ô nhập
            vẫn trùng khít với chữ sẽ vẽ ra vì dùng chung một phép biến đổi. */}
        {textEdit && (
          <textarea
            className="text-input"
            // Lưới an toàn cho tiêu điểm, thay cho autoFocus (chỉ chạy lúc gắn
            // vào cây). Nếu có thứ gì cướp mất tiêu điểm giữa chừng thì lần vẽ
            // lại kế tiếp đòi lại. Điều kiện activeElement giữ cho nó là lệnh
            // rỗng ở mọi phím gõ, không phải một lệnh focus mỗi ký tự.
            ref={(el) => { if (el && document.activeElement !== el) el.focus(); }}
            value={textEdit.value}
            style={{
              left: board.view.panX + textEdit.x * board.view.scale,
              top: board.view.panY + textEdit.y * board.view.scale,
              fontSize: textEdit.size * board.view.scale,
              lineHeight: TEXT_LINE_H,
              color: penVar(textEdit.color),
              // Tự nới theo nội dung. Cộng thêm một khoảng cho con trỏ nháy ở
              // cuối dòng dài nhất, không thì gõ tới đâu chữ trượt sang trái tới đó.
              width: (textBox(textLines(textEdit.value), textEdit.size, measureTextWidth).w + 12) * board.view.scale,
              height: textLines(textEdit.value).length * textEdit.size * TEXT_LINE_H * board.view.scale
            }}
            onChange={(e) => {
              setTextEdit((prev) => ({ ...prev, value: e.target.value }));
              inkLive.pushText(e.target.value);
            }}
            onBlur={commitText}
            // Escape kết thúc — blur() rồi để onBlur lo phần lưu, nên chỉ có MỘT
            // đường commit. Enter thì XUỐNG DÒNG chứ không kết thúc: chú thích
            // nhiều dòng là chuyện thường, và đó chính là lý do phím kết thúc
            // phải là Escape.
            // Các phím tắt khác (p, e, s, t, Delete…) không cần chặn ở đây:
            // handler keydown chung đã bỏ qua mọi sự kiện phát từ textarea.
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); }
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
        {/* Lớp bắt chuột của mode Đặt: cùng vai trò với .ink-capture, để bấm
            trúng một cái thẻ có sẵn vẫn ra thẻ mới chứ không phải chọn thẻ đó. */}
        {mode === "place" && (
          <div
            className={"place-capture" + (placeTool === "group" ? " draw-frame" : "")}
            onMouseDown={handlePlaceCaptureMouseDown}
          />
        )}
        <div
          className="canvas"
          ref={canvasRef}
          style={{ transform: `translate(${board.view.panX}px, ${board.view.panY}px) scale(${board.view.scale})` }}
        >
          {marquee && (
            <div className="marquee-box" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}
          {placeDraft && (
            <div className="place-draft" style={{ left: placeDraft.x, top: placeDraft.y, width: placeDraft.w, height: placeDraft.h }} />
          )}
          {/* TAY CẦM SỬA HÌNH — hiện khi chọn đúng MỘT hình khối. Kéo tay cầm
              góc để đặt từng đỉnh, kéo tay cầm cạnh (ô tròn ở giữa cạnh) để dời
              trọn một cạnh. Với hình định nghĩa bằng hộp bao (chữ nhật, ê-líp,
              hình thoi, tam giác cân) thì góc là góc hộp và cạnh là mép hộp —
              xem ghi chú dài ở lib/shape.js về lý do hai ý nghĩa khác nhau.
              Hiện ở mode Chuột, VÀ ở mode Sửa khi đang cầm BÚT. Ở mode Sửa thì
              `.ink-capture` phủ kín khung nhìn nên chúng không tự nhận được
              chuột — handleInkCaptureMouseDown dò tay để bắt hộ (xem
              shapeHandleAt). Cố ý chỉ ở tool Bút: cục gôm quét trúng tay cầm là
              xoá mất hình, còn tool Hình khối thì việc đang làm là ĐẶT hình mới,
              mấy ô vuông nhỏ nằm giữa vùng kéo chỉ tổ vướng. */}
          {editShape && canGrabShapeHandles && role !== "viewer" && editShape.handles.map((h) => (
            <div
              key={h.t + h.i}
              className={"shape-handle" + (h.t === HANDLE_EDGE ? " edge" : "")}
              // Bù trừ zoom, cùng lý do với tay cầm của hộp bao vùng chọn: cỡ cố
              // định thì ở zoom 40% không bấm nổi, ở 240% thì to hơn cả cái hình.
              style={{
                left: h.x, top: h.y,
                transform: `translate(-50%, -50%) scale(${1 / board.view.scale})`
              }}
              title={h.t === HANDLE_EDGE ? t`Kéo để dời cả cạnh này` : t`Kéo để đặt góc này vào chỗ khác`}
              onMouseDown={(e) => handleShapeHandleMouseDown(e, h)}
            />
          ))}
          {/* HỘP BAO VÙNG CHỌN. Bản thân hộp KHÔNG nhận chuột (pointer-events:
              none trong CSS) — nó chỉ nói cho mắt biết "cả vùng này là một cụm".
              Cú kéo trong lòng hộp do handleViewportMouseDown bắt, nên bấm trúng
              một cái thẻ ở giữa vùng vẫn là bấm vào cái thẻ đó: bấm đúp để sửa,
              kéo góc ảnh, bấm chip… tất cả còn nguyên.
              Bốn tay cầm ở góc thì NGƯỢC LẠI, chúng bật lại pointer-events —
              chúng là thứ duy nhất trong hộp cướp chuột, và chỉ ở đúng 4 ô nhỏ.
              Chỉ hiện ở mode Chuột: ở mode Sửa cả khung nhìn đã bị .ink-capture
              phủ kín, tay cầm sẽ không bao giờ bấm được, mà vẫn che mất chỗ vẽ. */}
          {selBounds && mode === "select" && (
            <div
              className={"selection-box" + (dropTargetId?.kind === "selection" ? " drop" : "")}
              style={{ left: selBounds.x, top: selBounds.y, width: selBounds.w, height: selBounds.h }}
            >
              {role !== "viewer" && SELECTION_CORNERS.map((corner) => {
                const p = cornerPoint(selBounds, corner);
                return (
                  <div
                    key={corner}
                    className={"selection-handle " + corner}
                    // Bù trừ zoom: tay cầm nằm trong .canvas (đã scale) nên nếu
                    // để cỡ cố định thì ở zoom 40% nó bé tới mức không bấm nổi,
                    // còn ở zoom 240% thì nó to hơn cả cái thẻ.
                    style={{
                      left: p.x - selBounds.x,
                      top: p.y - selBounds.y,
                      transform: `translate(-50%, -50%) scale(${1 / board.view.scale})`
                    }}
                    title={t`Kéo để phóng to / thu nhỏ cả cụm`}
                    onMouseDown={(e) => handleSelectionResizeMouseDown(e, corner)}
                  />
                );
              })}
            </div>
          )}
          {liveGroups.map((group) => (
            <FrameBox
              key={group.id}
              group={group}
              editingTitle={editingGroupTitleId === group.id}
              dropTarget={!!dropTargetId && dropTargetId.kind === "group" && dropTargetId.id === group.id}
              selected={selectedGroupIds.has(group.id)}
              h={groupHandlers}
            />
          ))}

          <EdgeLayer
            edges={board.edges}
            nodeById={nodeById}
            groupById={groupById}
            cardSize={frameCardSize}
            sketch={skin === "sketch"}
            gameDesign={board.kind === "game-design"}
            cycleEdgeIds={dependency?.cycleEdgeIds}
            hoveredEdgeId={hoveredEdgeId}
            selectedEdgeIds={selectedEdgeIds}
            edgeDragId={edgeDrag ? edgeDrag.edgeId : null}
            snapGuides={snapGuides}
            linkDraft={linkDraft}
            edgeDraft={edgeDrag}
            onEdgeEnter={onEdgeEnter}
            onEdgeLeave={onEdgeLeave}
            onEdgeClick={onEdgeClick}
            onEdgeContextMenu={onEdgeContextMenu}
          />

          {liveNodes.map((liveNode) => {
            const liveText = editingId === liveNode.id ? null : textOverlay.get(String(liveNode.id));
            const renderNode = liveText
              ? { ...liveNode, title: liveText.title ?? liveNode.title, desc: liveText.desc ?? liveNode.desc }
              : liveNode;
            return (
              <IdeaCard
                key={liveNode.id}
                node={renderNode}
                boardId={boardId}
                statusDef={statusDefById.get(liveNode.statusId) ?? null}
                tagDef={tagDefById.get(liveNode.tagId) ?? null}
                statuses={board.statuses}
                tags={board.tags}
                currentUser={currentUser}
                observeCard={observeCard}
                editing={editingId === liveNode.id}
                dimmed={(!passesFilter(liveNode) || (focusSet != null && !focusSet.has(liveNode.id))) && editingId !== liveNode.id}
                linkPending={linkMode && pendingSource === liveNode.id}
                dropTarget={isNodeDropTarget(liveNode.id)}
                selected={selectedIds.has(liveNode.id)}
                flash={flashId === liveNode.id}
                gameDesign={board.kind === "game-design"}
                balance={board.gameDesignBalance}
                blocked={dependency?.blockedNodeIds.has(String(liveNode.id))}
                dependencyCycle={dependency?.cycleNodeIds.has(String(liveNode.id))}
                onDesign={() => setDesignEditId(liveNode.id)}
                h={cardHandlers}
              />
            );
          })}

          <PeerLayer socket={socket} nodeById={nodeById} groupById={groupById} cardSize={frameCardSize} spotlightPeerId={spotlightPeerId} />

          <InkLayer
            drawings={inkDrawings}
            draft={ink.draft}
            eraseIds={ink.eraseIds}
            cut={ink.cut}
            liveStrokes={inkLive.liveStrokes}
            sketch={skin === "sketch"}
            editingTextId={textEdit ? textEdit.id : null}
            selectedIds={selectedDrawingIds}
          />

          {/* Nằm trong .canvas nên vệt bám theo bảng khi lia/phóng — chỉ vào
              một cái thẻ thì vệt ở lại đúng cái thẻ đó, không trôi ra chỗ khác
              khi người xem lia bảng. */}
          <LaserLayer socket={socket} store={laser.store} scale={board.view.scale} />

          {/* Tay cầm nổi trên cùng, tách khỏi .edge-layer: đầu dây thường trùng
              đúng chỗ connector-zone của thẻ (cả hai đều ở tâm cạnh), và thẻ
              luôn vẽ sau .edge-layer nên connector-zone sẽ che tay cầm nếu để
              chung lớp — chuột sẽ trúng connector-zone thay vì tay cầm. */}
          {hoveredEdgeId != null && !edgeDrag && (() => {
            const edge = board.edges.find((e) => e.id === hoveredEdgeId);
            if (!edge) return null;
            const r1 = rectForEndpoint(edge.fromKind || "node", edge.from, nodeById, groupById, frameCardSize);
            const r2 = rectForEndpoint(edge.toKind || "node", edge.to, nodeById, groupById, frameCardSize);
            if (!r1 || !r2) return null;
            const p1 = clipToRect(r1.cx, r1.cy, r1.w, r1.h, r2.cx, r2.cy);
            const p2 = clipToRect(r2.cx, r2.cy, r2.w, r2.h, r1.cx, r1.cy);
            return (
              <svg
                className="edge-handle-layer"
                onMouseLeave={() => setHoveredEdgeId((id) => (id === edge.id ? null : id))}
              >
                <circle
                  className="edge-handle" cx={p1.x} cy={p1.y} r={6}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "from")}
                />
                <circle
                  className="edge-handle" cx={p2.x} cy={p2.y} r={6}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseDown={(e) => handleEdgeEndpointMouseDown(e, edge, "to")}
                />
              </svg>
            );
          })()}
        </div>

        {board.nodes.length === 0 && (
          <div className="empty-hint">
            <Trans>Nhấp đúp vào khoảng trống để tạo ý tưởng đầu tiên.</Trans><br />
            <Trans>Chuột trái kéo để bôi đen chọn thẻ, chuột phải kéo để lia sa bàn, cuộn để lia, giữ Ctrl/⌘ + cuộn để phóng to.</Trans>
          </div>
        )}

        {focusSet != null && (
          <div className="focus-banner">
            <Trans>Đang tập trung — Esc để thoát</Trans>
            <button onClick={() => setFocusId(null)}>×</button>
          </div>
        )}

        {/* Minimap là một đảo riêng NGAY TRÊN nút zoom, không nhét vào trong nó:
            hai thứ cùng là "chuyện camera" nên đứng cạnh nhau, nhưng một cái là
            hàng nút cao 30px còn cái kia là một mảng 120px. */}
        {miniOpen && miniShapes && viewportSize.w > 0 && (
          <MiniMap
            shapes={miniShapes}
            view={board.view}
            viewportSize={viewportSize}
            onGoTo={goToPoint}
            onClose={() => setMiniOpen(false)}
          />
        )}

        <div className="zoom-ctrl">
          <button onClick={() => zoomButton(1 / 1.2)} title={t`Thu nhỏ`}>−</button>
          <span className="pct mono">{Math.round(board.view.scale * 100)}%</span>
          <button onClick={() => zoomButton(1.2)} title={t`Phóng to`}>+</button>
          <div className="sep" />
          <button onClick={fitToView} style={{ width: "auto", padding: "0 8px", fontSize: 11 }}><Trans>Vừa khung</Trans></button>
          <div className="sep" />
          <button
            className={miniOpen ? "on" : undefined}
            onClick={() => setMiniOpen((v) => !v)}
            title={miniOpen ? t`Ẩn bản đồ thu nhỏ` : t`Hiện bản đồ thu nhỏ`}
          ><MiniMapIcon /></button>
        </div>

        {outlineOpen && (() => {
          const outline = buildOutline(board, frameCardSize);
          const nodeById = new Map(board.nodes.map((n) => [n.id, n]));
          const row = (id) => {
            const n = nodeById.get(id);
            if (!n) return null;
            const s = statusById(board, n.statusId);
            return (
              <button key={id} className="op-row" onClick={() => jumpToCard(id)}>
                <span className="dot" style={{ background: s ? colorVar(s.color) : "transparent" }}></span>
                <span className="op-title">{n.title}</span>
              </button>
            );
          };
          return (
            <div className="outline-panel" onMouseDown={(e) => e.stopPropagation()}>
              <div className="op-head">
                <span className="op-count mono">{board.nodes.length}</span>
                <button className="btn ghost small" onClick={exportMarkdown}><Trans>Xuất MD</Trans></button>
                <button className="btn ghost small" onClick={exportPng}><Trans>Xuất PNG</Trans></button>
                <button className="op-close" onClick={() => setOutlineOpen(false)}>×</button>
              </div>
              <div className="op-body">
                {outline.frames.map(({ group, nodeIds }) => (
                  <div key={"g" + group.id} className="op-section">
                    <button className="op-section-title" onClick={() => jumpToGroup(group)}>
                      {group.title} <span className="mono op-n">{nodeIds.length}</span>
                    </button>
                    {nodeIds.map(row)}
                  </div>
                ))}
                {Array.from(outline.byStatus.entries()).map(([key, ids]) => (
                  <div key={"s" + key} className="op-section">
                    <div className="op-section-title static">
                      {key === "none" ? t`Khác` : (statusById(board, key)?.name ?? t`Khác`)}
                      {" "}<span className="mono op-n">{ids.length}</span>
                    </div>
                    {ids.map(row)}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Bảng Xếp cây — dock bên phải như bảng thuộc tính của Figma. Né sang
            trái khi Mục lục đang mở, hai bảng cùng neo mép phải. */}
        {treeUI && (() => {
          const root = treeUI.kind === "group"
            ? board.groups.find((g) => g.id === treeUI.id)
            : board.nodes.find((n) => n.id === treeUI.id);
          if (!root) return null;             // gốc vừa bị xoá: bảng tự biến mất
          const { order } = buildTree(board.edges, edgeKey(treeUI.kind, treeUI.id));
          return (
            <TreePanel
              opts={treeOpts}
              count={order.length}
              rootTitle={root.title || t`Không tên`}
              shifted={outlineOpen}
              onOpts={previewTree}
              onCommit={commitTree}
              onReset={() => { previewTree(TREE_OPTS); commitTree(); }}
              onClose={closeTreePanel}
            />
          );
        })()}

        {/* Dock bên phải là chỗ DUY NHẤT cho mọi thao tác làm đổi dữ liệu: spec
            của thẻ GD và batch edit của mọi loại board cùng sống ở đây. */}
        {(briefOpen || flowOpen || balanceOpen || handoffOpen || decisionTimelineOpen || snapshotsOpen || insightsOpen || reportsOpen || impactOpen || playtestsOpen || designEditId != null || selectedEdgeIds.size >= 1 || selectedIds.size + selectedGroupIds.size >= 2 || selectedGroupIds.size >= 1 || selectedDrawingIds.size >= 1) && (
          <aside className="edit-dock" ref={editDockRef}>
            {briefOpen && board.kind === "game-design" && <GameDesignBriefPanel brief={board.gameDesignBrief} canEdit={role !== "viewer"} onSave={saveGameDesignBrief} onClose={() => setBriefOpen(false)} outsideRef={editDockRef} />}
            {flowOpen && board.kind === "game-design" && <GameDesignFlowPanel flow={board.gameDesignFlow} nodes={board.nodes} canEdit={role !== "viewer"} onSave={saveGameDesignFlow} onClose={() => setFlowOpen(false)} outsideRef={editDockRef} />}
            {balanceOpen && board.kind === "game-design" && <GameDesignBalancePanel balance={board.gameDesignBalance} nodes={board.nodes} canEdit={role !== "viewer"} onSave={saveGameDesignBalance} onClose={() => setBalanceOpen(false)} outsideRef={editDockRef} />}
            {handoffOpen && board.kind === "game-design" && <DevHandoffPanel board={board} boardName={boardName} selectedIds={selectedIds} onClose={() => setHandoffOpen(false)} outsideRef={editDockRef} />}
            {decisionTimelineOpen && board.kind === "game-design" && <DecisionTimelinePanel nodes={board.nodes} onOpenCard={(id) => { setDecisionTimelineOpen(false); setDesignEditId(id); }} onClose={() => setDecisionTimelineOpen(false)} outsideRef={editDockRef} />}
            {snapshotsOpen && <BoardSnapshotsPanel snapshots={snapshots} loading={snapshotsLoading} canEdit={role !== "viewer"} onCreate={createSnapshot} onRestore={restoreSnapshot} onClose={() => setSnapshotsOpen(false)} outsideRef={editDockRef} />}
            {insightsOpen && board.kind === "game-design" && <GameDesignInsightsPanel nodes={board.nodes} onOpenCard={(id) => { setInsightsOpen(false); setDesignEditId(id); }} onClose={() => setInsightsOpen(false)} outsideRef={editDockRef} />}
            {impactOpen && board.kind === "game-design" && <GameDesignImpactPanel board={board} initialCardId={impactCardId} onOpenCard={(id) => { setImpactOpen(false); setDesignEditId(id); }} onClose={() => setImpactOpen(false)} outsideRef={editDockRef} />}
            {playtestsOpen && board.kind === "game-design" && <PlaytestComparisonPanel nodes={board.nodes} onOpenCard={(id) => { setPlaytestsOpen(false); setDesignEditId(id); }} onClose={() => setPlaytestsOpen(false)} outsideRef={editDockRef} />}
            {reportsOpen && board.kind === "game-design" && <GameDesignReportsPanel board={board} boardName={boardName} onClose={() => setReportsOpen(false)} outsideRef={editDockRef} />}
            {designEditId != null && board.kind === "game-design" && (() => {
              const node = board.nodes.find((n) => n.id === designEditId);
              return node ? <GameDesignPanel node={node} nodes={board.nodes} balance={board.gameDesignBalance} canEdit={role !== "viewer"} onSave={saveDesignNode} onDuplicate={() => duplicateDesignNode(node.id)} onCreateRelated={(type, relation) => createRelatedDesignNode(node.id, type, relation)} onClose={() => setDesignEditId(null)} onOpenBalance={() => { setDesignEditId(null); setBalanceOpen(true); }} onOpenImpact={() => { setDesignEditId(null); setImpactCardId(node.id); setImpactOpen(true); }} outsideRef={editDockRef} /> : null;
            })()}
            {board.kind === "game-design" && selectedEdgeIds.size === 1 && (() => {
              const edge = board.edges.find((item) => item.id === [...selectedEdgeIds][0]);
              if (!edge) return null;
              const relation = relationDefinition(edge.relation);
              const isDependency = edge.relation === "depends-on";
              const chain = isDependency ? dependency?.chainFrom(edge.from) || [] : [];
              const chainLabels = chain.map((id) => board.nodes.find((node) => String(node.id) === id)?.title || `#${id}`);
              const hasCycle = dependency?.cycleEdgeIds.has(edge.id);
              const isBlocked = dependency?.blockedNodeIds.has(String(edge.from));
              return (
                <div className="edge-inspector" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="gd-kicker">Quan hệ edge</div>
                  <h2>Liên kết thẻ</h2>
                  <label>Loại quan hệ
                    <select value={isGameDesignRelation(edge.relation) ? edge.relation : "depends-on"} disabled={role === "viewer"} onChange={(e) => updateEdge(edge.id, { relation: e.target.value })}>
                      {RELATION_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <p className="edge-relation-help">{relation.description}</p>
                  {isDependency && (
                    <div className="dependency-inspector">
                      <div className="dependency-chain"><strong>Chuỗi phụ thuộc</strong><span>{chainLabels.join(" → ")}</span></div>
                      {isBlocked && <p className="dependency-warning">Thẻ nguồn đang bị chặn: có prerequisite chưa ở trạng thái Done.</p>}
                      {hasCycle && <p className="dependency-warning">Vòng lặp phụ thuộc: chuỗi này không thể được hoàn tất theo thứ tự hiện tại.</p>}
                    </div>
                  )}
                  {role !== "viewer" && <button className="btn danger edge-delete" onClick={() => deleteEdge(edge.id)}>Xóa dây</button>}
                </div>
              );
            })()}
            {/* Quét trúng cả khung/nét vẽ cũng cần edit dock; nút chỉ có nghĩa
                với thẻ thì tự ẩn khi không có thẻ nào trong vùng chọn. */}
            {(selectedIds.size + selectedGroupIds.size >= 2 || selectedGroupIds.size >= 1 || selectedDrawingIds.size >= 1) && (
              <div className="bulk-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="bb-count mono">
              {selectedIds.size > 0 && <Trans>{selectedIds.size} thẻ</Trans>}
              {selectedIds.size > 0 && selectedGroupIds.size > 0 && " · "}
              {selectedGroupIds.size > 0 && <Trans>{selectedGroupIds.size} khung</Trans>}
              {(selectedIds.size > 0 || selectedGroupIds.size > 0) && selectedDrawingIds.size > 0 && " · "}
              {selectedDrawingIds.size > 0 && <Trans>{selectedDrawingIds.size} nét vẽ</Trans>}
            </span>
            {selectedIds.size >= 2 && (
              <>
                <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ statusId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
                  <option value="">{t`Trạng thái…`}</option>
                  <option value="none">{t`Không trạng thái`}</option>
                  {board.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value="" onChange={(e) => { if (e.target.value !== "") applyToSelection({ tagId: e.target.value === "none" ? null : Number(e.target.value) }); }}>
                  <option value="">{t`Nhãn…`}</option>
                  <option value="none">{t`Không nhãn`}</option>
                  {board.tags.map((tg) => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
                </select>
              </>
            )}
            {/* Ô màu áp cho CẢ thẻ lẫn khung đang chọn — cả hai đều nhận cùng
                một `color` token, nên một hàng màu là đủ cho mọi thứ đang chọn. */}
            <div className="bb-swatches">
              <button className="be-swatch dot-empty" onClick={() => applyColorToSelection(null)} title={t`Không màu`} />
              {BADGE_PALETTE.map((token) => (
                <button key={token} className="be-swatch" style={{ background: colorVar(token) }} onClick={() => applyColorToSelection(token)} title={token} />
              ))}
            </div>
            {/* NÉT LIỀN / NÉT ĐỨT cho cả vùng chọn. Cử chỉ bấm hai lần đã làm
                được việc này, nhưng nó đòi nhắm TRÚNG một cái nét — với một nét
                mảnh giữa một đám vừa quét thì đó là việc khó chịu. Ở đây thì
                không phải nhắm gì cả.
                Hai nút đặt giá trị TƯỜNG MINH chứ không phải một nút lật: vùng
                chọn có thể đang nửa liền nửa đứt, mà "lật" một tập lẫn lộn thì
                không có nghĩa gì rõ ràng. */}
            {hasDashableSelected && (
              <>
                <button className="bb-clear" onClick={() => setDrawingsDashed(selectedDrawingIds, false)}><Trans>Nét liền</Trans></button>
                <button className="bb-clear" onClick={() => setDrawingsDashed(selectedDrawingIds, true)}><Trans>Nét đứt</Trans></button>
              </>
            )}
            {selectedIds.size >= 2 && (
              <>
                <button className="bb-clear" onClick={groupSelectedCards}><Trans>Gom nhóm</Trans></button>
                <button className="bb-clear" onClick={tidySelection}><Trans>Xếp gọn</Trans></button>
                <button className="bb-clear" onClick={duplicateSelection}><Trans>Nhân bản</Trans></button>
              </>
            )}
            <button className="bb-clear danger" onClick={deleteSelection}><Trans>Xoá</Trans></button>
            <span className="bb-sep" />
            <button className="bb-clear" onClick={clearSelection}><Trans>Bỏ chọn</Trans></button>
              </div>
            )}
          </aside>
        )}

        {ioOpen && (
          <div className="io-drawer">
            <div className="note">
              {ioMode === "export"
                ? <Trans>JSON hiện tại — copy để sao lưu hoặc gửi cho người khác xem.</Trans>
                : <Trans>Dán JSON đã xuất trước đó, rồi bấm Nhập vào bản đồ.</Trans>}
            </div>
            <textarea spellCheck={false} value={ioText} onChange={(e) => setIoText(e.target.value)} />
            <div className="io-actions">
              {ioMode === "import" && <button className="btn small" onClick={handleImportConfirm}><Trans>Nhập vào bản đồ</Trans></button>}
              <button className="btn ghost small" onClick={() => setIoOpen(false)}><Trans>Đóng</Trans></button>
            </div>
          </div>
        )}

      </div>

      {presentIndex != null && (() => {
        // Khung có thể bị xoá trong lúc trình chiếu → kẹp chỉ số khi render;
        // nếu xoá hết khung vẫn giữ thanh (0/0) để nút thoát × còn bấm được
        // (bên cạnh Esc).
        const idx = Math.min(presentIndex, Math.max(0, board.groups.length - 1));
        const group = board.groups[idx];
        return (
          <div className="present-bar" onMouseDown={(e) => e.stopPropagation()}>
            <span className="pb-step mono">{group ? `${idx + 1}/${board.groups.length}` : "0/0"}</span>
            {group && <span className="pb-title">{group.title}</span>}
            <button className="pb-exit" onClick={exitPresentation}>×</button>
          </div>
        );
      })()}

      {chipDrag && (
        <div className="chip-ghost" style={{ left: chipDrag.x, top: chipDrag.y }}>
          {(() => {
            const def = chipDrag.value === "none"
              ? null
              : (chipDrag.kind === "status" ? statusById(board, Number(chipDrag.value)) : tagById(board, Number(chipDrag.value)));
            return (
              <>
                <span className="dot" style={{ background: def ? colorVar(def.color) : "transparent" }}></span>
                {def ? def.name : (chipDrag.kind === "status" ? t`Không trạng thái` : t`Không nhãn`)}
                <DropCount targetId={dropTargetId} idsFor={dropIdsFor} />
              </>
            );
          })()}
        </div>
      )}

      {colorDrag && (
        <div className="chip-ghost" style={{ left: colorDrag.x, top: colorDrag.y }}>
          <span className="dot" style={{ background: colorVar(colorDrag.token) }}></span>
          <DropCount targetId={dropTargetId} idsFor={dropIdsFor} />
        </div>
      )}

      {colorMenu && colorMenu.kind === "card" && (() => {
        const node = board.nodes.find((n) => n.id === colorMenu.id);
        if (!node) return null;
        // Chuột phải vào thẻ đang nằm trong vùng chọn thì tác động lên cả vùng chọn.
        // Trước đây nó chỉ đổi đúng một thẻ, im lặng — chọn 5 thẻ rồi bấm màu là ra
        // một thẻ đổi màu. Lúc đó chỉ hiện những việc có nghĩa với nhiều thẻ.
        const multi = selectedIds.size > 1 && selectedIds.has(node.id);
        const one = (fn) => (multi ? undefined : fn);
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            count={multi ? selectedIds.size : 1}
            color={multi ? null : node.color ?? null}
            onPick={(color) => (multi ? applyToSelection({ color }) : applyNodeColor(node.id, color))}
            onEdit={one(() => { setColorMenu(null); setEditingId(node.id); })}
            onGroup={multi ? groupSelectedCards : undefined}
            onTidy={multi ? () => { setColorMenu(null); tidySelection(); } : undefined}
            onFocus={one(() => { setColorMenu(null); setFocusId(node.id); })}
            onDuplicate={() => {
              setColorMenu(null);
              if (multi) return duplicateSelection();
              const { next, cloneIds } = duplicateNodes([node.id]);
              commitAndSave(next);
              setSelectedIds(new Set(cloneIds));
            }}
            onComments={one(() => { setColorMenu(null); setEdgeMenu(null); setCommentsFor({ id: node.id, x: colorMenu.x, y: colorMenu.y }); })}
            onCopyLink={one(() => {
              const url = new URL(window.location.href);
              url.searchParams.set("card", String(node.id));
              navigator.clipboard.writeText(url.toString());
              setColorMenu(null);
            })}
            onDelete={() => { setColorMenu(null); multi ? deleteSelection() : deleteNode(node.id); }}
            onClose={() => setColorMenu(null)}
            locked={node.locked ?? false}
            onToggleLock={one(() => toggleNodeLock(node.id))}
            shape={multi ? "rect" : node.shape ?? "rect"}
            onSetShape={one((shape) => applyNodeShape(node.id, shape))}
            dashed={multi ? false : !!node.dashed}
            onSetDashed={one((dashed) => applyNodeDashed(node.id, dashed))}
            // Đổi bậc dùng được cho cả một tập thẻ đang chọn: hạ cả một nhánh
            // xuống bậc phụ là việc hay làm, bắt sửa từng thẻ thì rất mỏi.
            level={multi ? null : cardLevel(node)}
            onSetLevel={(level) => (multi ? applyToSelection(levelPatch(level)) : applyNodeLevel(node.id, level))}
            onArrangeTree={one((direction) => arrangeAsTree("node", node.id, direction))}
            onTreePanel={one(() => openTreePanel("node", node.id))}
          />
        );
      })()}

      {colorMenu && colorMenu.kind === "group" && (() => {
        const group = board.groups.find((g) => g.id === colorMenu.id);
        if (!group) return null;
        // Cùng luật với menu của thẻ: chuột phải vào một khung đang nằm trong
        // vùng chọn thì tác động lên cả vùng chọn, và chỉ hiện những việc có
        // nghĩa với nhiều khung.
        const multi = selectedGroupIds.size > 1 && selectedGroupIds.has(group.id);
        const one = (fn) => (multi ? undefined : fn);
        return (
          <ColorMenu
            x={colorMenu.x}
            y={colorMenu.y}
            kind="group"
            count={multi ? selectedGroupIds.size : 1}
            color={multi ? null : group.color ?? null}
            onPick={(color) => (multi ? applyColorToSelection(color) : applyGroupColor(group.id, color))}
            onClose={() => setColorMenu(null)}
            locked={group.locked ?? false}
            onToggleLock={one(() => toggleGroupLock(group.id))}
            onDelete={() => { setColorMenu(null); multi ? deleteSelection() : deleteGroup(group.id); }}
            onArrangeTree={one((direction) => arrangeAsTree("group", group.id, direction))}
            onTreePanel={one(() => openTreePanel("group", group.id))}
          />
        );
      })()}

      {badgeUI && badgeUI.mode === "create" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName=""
          initialColor={BADGE_PALETTE[0]}
          submitLabel={t`Tạo`}
          onSubmit={(name, color) => createBadge(badgeUI.kind, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}
      {badgeUI && badgeUI.mode === "edit" && (
        <BadgeEditor
          key={badgeUI.mode + "-" + (badgeUI.def?.id ?? "new")}
          x={badgeUI.x}
          y={badgeUI.y}
          initialName={badgeUI.def.name}
          initialColor={badgeUI.def.color}
          submitLabel={t`Lưu`}
          onDelete={() => deleteBadge(badgeUI.kind, badgeUI.def.id)}
          onSubmit={(name, color) => updateBadge(badgeUI.kind, badgeUI.def.id, name, color)}
          onClose={() => setBadgeUI(null)}
        />
      )}

      {paletteUI && (
        <PaletteEditor
          key={paletteUI.mode + "-" + (paletteUI.id ?? "new")}
          x={paletteUI.x}
          y={paletteUI.y}
          hex={paletteUI.hex}
          onPick={(hex) => (paletteUI.mode === "create" ? createPaletteColor(hex) : updatePaletteColor(paletteUI.id, hex))}
          onDelete={paletteUI.mode === "edit" ? () => deletePaletteColor(paletteUI.id) : undefined}
          onClose={() => setPaletteUI(null)}
        />
      )}

      {edgeMenu && (() => {
        const edge = board.edges.find((e) => e.id === edgeMenu.id);
        if (!edge) return null;
        return (
          <EdgeMenu
            key={edge.id}
            x={edgeMenu.x} y={edgeMenu.y}
            edge={edge}
            onStyleToggle={() => updateEdge(edge.id, { style: (edge.style === "dashed" ? "solid" : "dashed") })}
            onArrowToggle={() => updateEdge(edge.id, { arrow: edge.arrow === "none" ? undefined : "none" })}
            onReverse={() => updateEdge(edge.id, { from: edge.to, fromKind: edge.toKind, to: edge.from, toKind: edge.fromKind })}
            onLabel={(label) => updateEdge(edge.id, { label: label.trim() || undefined })}
            onColorChange={(color) => updateEdge(edge.id, { color: color || undefined })}
            onDelete={() => deleteEdge(edge.id)}
            onClose={() => setEdgeMenu(null)}
          />
        );
      })()}

      {commentsFor && (() => {
        const node = board.nodes.find((n) => n.id === commentsFor.id);
        if (!node) return null;
        return (
          <CommentsPopover
            key={node.id}
            x={commentsFor.x} y={commentsFor.y}
            comments={node.comments ?? []}
            onAdd={(text) => addComment(node.id, text)}
            onDelete={(index) => deleteComment(node.id, index)}
            onClose={() => setCommentsFor(null)}
          />
        );
      })()}
      {captureOpen && (
        <div className="capture-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCaptureOpen(false); }}>
          <div
            className="capture-modal"
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.stopPropagation(); setCaptureOpen(false); }
            }}
          >
            <div className="cm-note"><Trans>Mỗi dòng một ý tưởng — xác nhận để tạo hàng loạt thẻ.</Trans></div>
            <textarea
              autoFocus
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); confirmCapture(); }
              }}
              placeholder={t`Ý tưởng 1\nÝ tưởng 2\n…`}
            />
            <div className="cm-actions">
              <button className="btn small" onClick={confirmCapture}><Trans>Tạo thẻ</Trans></button>
              <button className="btn ghost small" onClick={() => setCaptureOpen(false)}><Trans>Hủy</Trans></button>
            </div>
          </div>
        </div>
      )}

      {inviteOpen && role === "owner" && (
        <InviteModal boardId={boardId} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

function LineSolidIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function LineDashedIcon() {
  return <svg viewBox="0 0 20 12" width="20" height="12"><line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" /></svg>;
}
function LineUndirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3" cy="6" r="1.8" fill="currentColor" />
      <circle cx="17" cy="6" r="1.8" fill="currentColor" />
    </svg>
  );
}
function LineDirectedIcon() {
  return (
    <svg viewBox="0 0 20 12" width="20" height="12">
      <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 2l5 4-5 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReverseIcon() {
  return (
    <svg viewBox="0 0 20 16" width="20" height="16">
      <path d="M2 5h13M11 2l3 3-3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 11H5M9 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaletteEditor({ x, y, hex, onPick, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const inputRef = useRef(null);
  const pos = usePopoverPosition(ref, x, y);
  useCloseOnOutside(ref, onClose);

  // Listener "change" thật, không dùng onChange của React: React map onChange
  // của input màu sang sự kiện "input", tức là mỗi bước kéo trong bộ chọn màu
  // thành một entry undo + một lần lưu. "change" chỉ nổ một lần khi chốt màu.
  useEffect(() => {
    const el = inputRef.current;
    const handler = (e) => onPick(e.target.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, [onPick]);

  return (
    <div className="badge-editor pal-editor" ref={ref} style={pos} onMouseDown={(e) => e.stopPropagation()}>
      <div className="eyebrow">{onDelete ? t`Sửa màu` : t`Màu mới`}</div>
      <input className="pal-input" type="color" defaultValue={hex} ref={inputRef} />
      {onDelete && (
        <button className="em-delete" onClick={onDelete}>🗑 <Trans>Xoá màu</Trans></button>
      )}
    </div>
  );
}

function EdgeMenu({ x, y, edge, onStyleToggle, onArrowToggle, onReverse, onLabel, onColorChange, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const pos = usePopoverPosition(ref, x, y);
  useCloseOnOutside(ref, onClose);

  // Guard against a redundant second commit: Enter commits immediately, and a
  // later blur (e.g. clicking elsewhere) would otherwise push the same value
  // again. Comparing against the (by-then-updated) `edge.label` prop makes the
  // second call a no-op instead of a duplicate history entry.
  function commitLabel(rawValue) {
    const next = rawValue.trim();
    const prev = (edge.label ?? "").trim();
    if (next === prev) return;
    onLabel(rawValue);
  }

  const isDashed = edge.style === "dashed";
  const isDirected = edge.arrow !== "none";

  return (
    <div className="badge-editor edge-menu" ref={ref} style={pos} onMouseDown={(e) => e.stopPropagation()}>
      <input
        className="be-name"
        type="text"
        autoFocus
        defaultValue={edge.label ?? ""}
        placeholder={t`Nhãn edge…`}
        onKeyDown={(e) => { if (e.key === "Enter") commitLabel(e.currentTarget.value); }}
        onBlur={(e) => commitLabel(e.target.value)}
      />

      <div className="em-section">
        <div className="eyebrow"><Trans>Kiểu nét</Trans></div>
        <div className="em-toggle-group">
          <button className={"em-icon-btn" + (!isDashed ? " on" : "")} onClick={() => isDashed && onStyleToggle()} title={t`Nét liền`}>
            <LineSolidIcon />
          </button>
          <button className={"em-icon-btn" + (isDashed ? " on" : "")} onClick={() => !isDashed && onStyleToggle()} title={t`Nét đứt`}>
            <LineDashedIcon />
          </button>
        </div>
      </div>

      <div className="em-section">
        <div className="eyebrow"><Trans>Hướng</Trans></div>
        <div className="em-toggle-group">
          <button className={"em-icon-btn" + (!isDirected ? " on" : "")} onClick={() => isDirected && onArrowToggle()} title={t`Vô hướng`}>
            <LineUndirectedIcon />
          </button>
          <button className={"em-icon-btn" + (isDirected ? " on" : "")} onClick={() => !isDirected && onArrowToggle()} title={t`Có hướng`}>
            <LineDirectedIcon />
          </button>
          {isDirected && (
            <button className="em-icon-btn" onClick={onReverse} title={t`Đảo chiều`}>
              <ReverseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="em-section">
        <div className="eyebrow"><Trans>Màu dây</Trans></div>
        <div className="be-swatches">
          <button className={"be-swatch dot-empty" + (!edge.color ? " on" : "")} onClick={() => onColorChange(null)} title={t`Mặc định`} />
          {BADGE_PALETTE.map((token) => (
            <button key={token} className={"be-swatch" + (edge.color === token ? " on" : "")} style={{ background: colorVar(token) }} onClick={() => onColorChange(token)} title={token} />
          ))}
        </div>
      </div>

      <button className="em-delete" onClick={onDelete}>🗑 <Trans>Xoá cạnh</Trans></button>
    </div>
  );
}

function CommentsPopover({ x, y, comments, onAdd, onDelete, onClose }) {
  const { t } = useLingui();
  const ref = useRef(null);
  const pos = usePopoverPosition(ref, x, y);
  useCloseOnOutside(ref, onClose);
  const [text, setText] = useState("");

  function timeAgo(iso) {
    const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return t`vừa xong`;
    if (diffSec < 3600) { const m = Math.floor(diffSec / 60); return t`${m} phút trước`; }
    if (diffSec < 86400) { const h = Math.floor(diffSec / 3600); return t`${h} giờ trước`; }
    const d = Math.floor(diffSec / 86400);
    return t`${d} ngày trước`;
  }

  function submit() {
    if (!text.trim()) return;
    if (onAdd(text)) setText("");
  }

  return (
    <div className="badge-editor comments-pop" ref={ref} style={pos} onMouseDown={(e) => e.stopPropagation()}>
      {comments.length > 0 && (
        <div className="cmt-list">
          {comments.map((c, i) => (
            <div className="cmt-item" key={i}>
              <div className="cmt-item-head">
                <span className="cmt-author">{c.author}</span>
                <span className="cmt-time">{timeAgo(c.at)}</span>
                <button className="cmt-delete" onClick={() => onDelete(i)} title={t`Xoá`}>×</button>
              </div>
              <div className="cmt-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t`Viết bình luận…`}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
      />
      <div className="cmt-actions">
        <button className="save-btn" onClick={submit}><Trans>Gửi</Trans></button>
      </div>
    </div>
  );
}
