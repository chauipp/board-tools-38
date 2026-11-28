// Panel Game Flow và Chi tiết thiết kế, dựng riêng từng component (không qua
// IdeaMap) để không phụ thuộc màn đăng nhập hay thao tác canvas.
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import GameDesignFlowPanel from "../../components/GameDesignFlowPanel.jsx";
import GameDesignPanel from "../../components/GameDesignPanel.jsx";

export async function run(log) {
  // Game Flow là inspector cấp board, nên thử riêng phần form: thêm một bước
  // Player Loop, nhập dữ liệu, chọn card reference và lưu phải trả đúng shape.
  const flowHost = document.createElement("div");
  document.body.append(flowHost);
  const flowRoot = createRoot(flowHost);
  let savedFlow = null;
  await act(async () => {
    flowRoot.render(<GameDesignFlowPanel flow={null} nodes={[{ id: 1, title: "Dash" }]} canEdit onSave={(flow) => { savedFlow = flow; }} onClose={() => {}} />);
  });
  const flowAdd = flowHost.querySelector(".gd-flow-add");
  await act(async () => { flowAdd.click(); });
  const flowTitle = flowHost.querySelector("input");
  const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => {
    inputSetter.call(flowTitle, "Khám phá");
    flowTitle.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const reference = flowHost.querySelector("select[multiple]");
  reference.options[0].selected = true;
  await act(async () => { reference.dispatchEvent(new window.Event("change", { bubbles: true })); flowHost.querySelector(".gd-save").click(); });
  if (!savedFlow?.playerLoop?.length || savedFlow.playerLoop[0].title !== "Khám phá" || savedFlow.playerLoop[0].cardIds[0] !== "1") {
    throw new Error("Game Flow panel không lưu được bước Player Loop và card reference");
  }
  await act(async () => { flowHost.querySelector(".gd-flow-collapse").click(); });
  if (flowHost.querySelector(".gd-flow-item")) throw new Error("Game Flow không thu được section Player Loop");
  log(`Game flow: lưu ${savedFlow.playerLoop.length} bước · reference=${savedFlow.playerLoop[0].cardIds.join(",")}`);
  await act(async () => { flowRoot.unmount(); });
  flowHost.remove();

  const viewerHost = document.createElement("div");
  document.body.append(viewerHost);
  const viewerRoot = createRoot(viewerHost);
  await act(async () => {
    viewerRoot.render(<GameDesignFlowPanel flow={savedFlow} nodes={[{ id: 1, title: "Dash" }]} canEdit={false} onSave={() => { throw new Error("viewer không được lưu Game Flow"); }} onClose={() => {}} />);
  });
  if (!viewerHost.querySelector("input")?.disabled || viewerHost.querySelector(".gd-flow-add, .gd-save, .gd-journey-remove")) {
    throw new Error("viewer Game Flow còn control chỉnh sửa");
  }
  await act(async () => { viewerRoot.unmount(); });
  viewerHost.remove();

  // Chi tiết spec nằm trong từng thẻ GD: ba section phải thêm/sửa/xóa, thu gọn
  // được và khi lưu phải trả về shape có cấu trúc. Kiểm riêng panel để không
  // phụ thuộc vào màn đăng nhập hay thao tác canvas.
  const detailsHost = document.createElement("div");
  document.body.append(detailsHost);
  const detailsRoot = createRoot(detailsHost);
  const detailNode = { id: "detail-card", title: "Dash", desc: "", type: "mechanic", design: {} };
  let savedDetails = null;
  await act(async () => {
    detailsRoot.render(<GameDesignPanel node={detailNode} nodes={[detailNode]} canEdit onSave={(next) => { savedDetails = next; }} onClose={() => {}} />);
  });
  const detailAdd = Array.from(detailsHost.querySelectorAll(".gd-detail-add")).find((button) => button.textContent.includes("ví dụ"));
  await act(async () => { detailAdd.click(); });
  const detailInput = detailsHost.querySelector(".gd-detail-item input");
  const detailInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => {
    detailInputSetter.call(detailInput, "Đòn lướt qua bẫy");
    detailInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const failureAdd = Array.from(detailsHost.querySelectorAll(".gd-detail-add")).find((button) => button.textContent.includes("failure state"));
  await act(async () => { failureAdd.click(); });
  const failureSection = Array.from(detailsHost.querySelectorAll(".gd-detail-section")).find((section) => section.textContent.includes("Failure States"));
  // Bấm "Thêm" tự mở section ra (section mặc định thu gọn), nên không bấm
  // thu/mở ở đây nữa — bấm thì lại thu nó vào và nút Xóa biến mất.
  if (!failureSection.querySelector(".gd-detail-remove")) throw new Error("thêm failure state mà section không tự mở ra");
  await act(async () => { failureSection.querySelector(".gd-detail-remove").click(); });
  if (failureSection.querySelector(".gd-detail-item")) throw new Error("Game Design details không xóa được failure state");
  await act(async () => { detailsHost.querySelector(".gd-save").click(); });
  if (savedDetails?.design?.examples?.[0]?.title !== "Đòn lướt qua bẫy") {
    throw new Error("Game Design panel không lưu được Example");
  }
  // Tìm theo tên chứ không lấy section đầu tiên: phía trên Examples còn các
  // khối "Biến thể card", "Tạo card liên quan" (chỉ hiện khi sửa được).
  const detailSection = Array.from(detailsHost.querySelectorAll(".gd-detail-section")).find((section) => section.textContent.includes("Examples"));
  await act(async () => { detailSection.querySelector(".gd-detail-collapse").click(); });
  if (detailSection.querySelector(".gd-detail-list")) throw new Error("Game Design details không thu được section");
  await act(async () => { detailsRoot.unmount(); });
  detailsHost.remove();

  const detailViewerHost = document.createElement("div");
  document.body.append(detailViewerHost);
  const detailViewerRoot = createRoot(detailViewerHost);
  await act(async () => {
    detailViewerRoot.render(<GameDesignPanel node={savedDetails} nodes={[savedDetails]} canEdit={false} onSave={() => { throw new Error("viewer không được lưu details"); }} onClose={() => {}} />);
  });
  await act(async () => { detailViewerHost.querySelector(".gd-detail-collapse").click(); });
  // "Mở Balance" mượn class .gd-detail-add cho giống nút nhưng chỉ là điều
  // hướng sang bảng Balance, viewer vẫn được bấm — không tính là control sửa.
  const viewerEditControls = Array.from(detailViewerHost.querySelectorAll(".gd-detail-add, .gd-detail-remove, .gd-save"))
    .filter((el) => el.textContent.trim() !== "Mở Balance");
  if (!detailViewerHost.querySelector(".gd-detail-item input")?.disabled || viewerEditControls.length) {
    throw new Error("viewer Game Design details còn control chỉnh sửa");
  }
  log("Game Design details: lưu Example, thu section, viewer read-only");
  await act(async () => { detailViewerRoot.unmount(); });
  detailViewerHost.remove();

  return true;
}
