import { normalizeWorkspace } from "../../lib/workspace-state.js";
import { Link } from "react-router-dom";
import { Trans, useLingui } from "@lingui/react/macro";
import { exportPackage } from "../../lib/game-design.js";
import { BOARD_BGS, BOARD_GRIDS, COLOR_PACKS } from "../../lib/board-theme.js";
import LocaleToggle from "../LocaleToggle.jsx";
import PresenceBar from "../PresenceBar.jsx";
import PdfUsage from "../PdfUsage.jsx";
import { EMPTY_SET } from "../../lib/board-constants.js";
import { IconSketch, IconMenu, IconSearch, IconBoardStyle } from "./icons.jsx";
import TopMenu from "./TopMenu.jsx";
import { useBoard } from "../../lib/board-context.js";

// Đảo to góc trên trái: menu ☰, tên board, tìm kiếm, menu Giao diện, các nút
// panel, hàng công cụ game-design và số bộ lọc đang bật. Trước là một khối JSX
// trong IdeaMap.jsx; cây DOM và class giữ nguyên.
export default function BoardTopBar({ BG_LABEL, GRID_LABEL, PACK_LABEL, activeFilterCount, balanceOpen, briefOpen, clearFilters, decisionTimelineOpen, dependency, exportVersionedJson, flowOpen, goToMatch, handoffOpen, impactOpen, insightsOpen, matchCount, matchIdx, matches, openSnapshots, outlineOpen, playtestsOpen, reportsOpen, search, searchInputRef, searchOpen, setBalanceOpen, setBoardBg, setBoardGrid, setBoardPack, setBriefOpen, setDecisionTimelineOpen, setDesignEditId, setFlowOpen, setHandoffOpen, setImpactCardId, setImpactOpen, setInsightsOpen, setIoMode, setIoOpen, setIoText, setOutlineOpen, setPlaytestsOpen, setReportsOpen, setSearch, setTheme, setWheelMode, skin, startPresentation, theme, toggleSearch, toggleSkin, toolsOpen, viewportSize, wheelMode, workspace, workspaceCameraRef }) {
  const { store, selection, camera } = useBoard();
  const { board, boardName, role } = store;
  const { setSelectedEdgeIds } = selection;
  const { setView, view } = camera;
  const { t } = useLingui();
  return (
    <>
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
            <button className="btn ghost" onClick={() => { setIoMode("export"); setIoText(JSON.stringify(board.kind === "game-design" ? exportPackage({ ...board, view, name: boardName }) : { ...board, view }, null, 2)); setIoOpen(true); }}><Trans>Xuất JSON</Trans></button>
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
            <div className="theme-row workspace-settings">
              <span role="status" aria-live="polite">{workspace.status === "account-changed" ? t`Tài khoản đã thay đổi — tải lại trang để đồng bộ` : workspace.status === "local" ? t`Giao diện lưu trên máy — chờ đồng bộ` : workspace.status === "saved" ? t`Giao diện đã đồng bộ` : t`Đang lưu giao diện…`}</span>
              <button type="button" className="btn ghost small" onClick={() => {
                const defaults = normalizeWorkspace();
                workspace.update({ ...defaults, camera: { x: viewportSize.w / 2, y: viewportSize.h / 2, scale: 1 } });
                const view = { panX: 0, panY: 0, scale: 1 };
                workspaceCameraRef.current = { controller: workspace.controller, hydration: workspace.hydration, ...viewportSize, applying: view };
                setView(view);
                void workspace.flush();
              }}><Trans>Đặt lại giao diện</Trans></button>
            </div>
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

        {board.kind === "game-design" && <div className="island-row gd-tools-row">
          {board.kind === "game-design" && <button
            type="button"
            className="btn ghost gd-tools-toggle"
            aria-expanded={toolsOpen}
            aria-controls="game-design-toolbar"
            title={toolsOpen ? t`Thu gọn công cụ thiết kế` : t`Mở công cụ thiết kế`}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => workspace.update({ toolsOpen: !toolsOpen })}
          ><Trans>Thiết kế</Trans> <span aria-hidden="true">{toolsOpen ? "▾" : "▸"}</span></button>}

          {board.kind === "game-design" && <div id="game-design-toolbar" className="gd-toolbar-actions" hidden={!toolsOpen}>

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
          </div>}
        </div>}

        {activeFilterCount > 0 && (
          <div className="fb-tail">
            <span className="fb-count mono" title={t`Số ý tưởng khớp bộ lọc`}>
              <Trans>Khớp {matchCount}/{board.nodes.length}</Trans>
            </span>
            <button className="fb-clear" onClick={clearFilters}><Trans>Xoá lọc</Trans></button>
          </div>
        )}

      </div>
    </>
  );
}
