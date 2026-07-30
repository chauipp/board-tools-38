// Màu bút là HỆ MÀU RIÊNG, không dùng board.palette hay BADGE_PALETTE: đổi màu
// một cái thẻ không được kéo theo màu của nét vẽ tay. Tên token là "pen-" chứ
// không phải "ink-" để không lẫn với --ink / --ink-dim đang là màu chữ.
import { SHAPE_TOOL_KINDS } from "./shape.js";
import { TEXT_SIZES } from "./text-el.js";
import { ERASE_MODES, ERASE_STROKE, ERASE_WIDTHS } from "./erase.js";

const KEY = "ideamap.pen";

export const PEN_COLORS = [
  "pen-red", "pen-orange", "pen-yellow",
  "pen-green", "pen-blue", "pen-purple", "pen-mono"
];

// Đơn vị toạ độ canvas, không phải pixel màn hình: zoom vào là nét dày ra như
// mực trên giấy.
export const PEN_WIDTHS = [2, 4, 8];

// Toàn bộ state của khu 4 nằm trong MỘT object dưới MỘT khoá: màu và độ dày
// dùng chung cho bút và hình khối, `kind` là hình đang chọn, `fill` là chế độ
// viền / cả hình, `snap` là "giữ tay để bắt hình" của riêng bút (recognize.js).
// Chiều import pen.js → shape.js → stroke.js, không có vòng.
//
// `snap` mặc định BẬT: nó chỉ ăn khi tay đứng yên hơn một giây giữa lúc đang vẽ —
// điều không xảy ra trong một nét vẽ bình thường — nên bật sẵn không cướp thao
// tác của ai, mà tắt sẵn thì gần như không ai biết tính năng có ở đó.
// `erase` và `ew` là của riêng CỤC GÔM, và `ew` cố ý KHÔNG dùng chung với `w`:
// `w` là độ dày nét — dùng chung cho bút và hình khối — nên gộp vào thì đổi cỡ
// cục tẩy sẽ lặng lẽ đổi luôn độ dày cây bút. Hai con số, hai việc, hai ô.
//
// `erase` mặc định là "cả nét": đó là hành vi cục gôm đã có từ đầu, và một cú
// quét vô ý ở kiểu này chỉ mất một nét — hoàn tác là xong. Kiểu "theo độ rộng"
// thì một cú quét cắt vụn nhiều nét thành nhiều mảnh, khó gỡ hơn hẳn, nên nó
// phải là thứ người dùng CHỌN chứ không phải thứ họ gặp.
//
// `scratch` (gạch xoá — scribble.js) mặc định BẬT, nhưng lý do khác hẳn `snap`
// và đáng ghi ra: đây là cử chỉ XOÁ, tức là sai một cái thì mất việc của người
// ta chứ không phải chỉ nắn lại cái nét. Nó bật sẵn được là vì hai chốt của
// chính nó đã hẹp: phải đổi chiều năm lần liên tiếp (không nét vẽ thường nào
// làm thế), VÀ phải cắt qua đúng thứ gì đó hai lần — gạch giữa chỗ trống thì
// vẫn ra một nét vẽ bình thường. Nút tắt vẫn phải có, cho ai vẽ nhiều hình răng
// cưa đè lên nhau.
export const PEN_DEFAULT = {
  color: "pen-red", w: 4, kind: "rect", fill: false, size: 20, snap: true, dashed: false,
  scratch: true, erase: ERASE_STROKE, ew: 24
};

export function penVar(token) {
  return `var(--${token})`;
}

// Nhịp nét đứt, tính THEO ĐỘ DÀY của chính nét đó chứ không phải một chuỗi cố
// định kiểu "6 5": nét dày 8 mà đứt theo nhịp của nét dày 2 thì các vạch chạm
// nhau, nhìn ra một đường liền hơi gợn chứ không ra nét đứt. Đơn vị là đơn vị
// canvas y như `w`, nên phóng to bảng thì nhịp đứt to lên cùng nét — cùng luật
// "mực trên giấy" mà .ink-layer đang theo.
//
// Trừ hẳn một lượt `u` ở vạch và cộng lại vào khoảng hở là để BÙ ĐẦU TRÒN:
// .ink-layer path có stroke-linecap: round, nên mỗi vạch tự dài thêm u/2 ở mỗi
// đầu. Không bù thì một cặp "3u 2u" hiện ra thành vạch 4u / hở 1u — gần như
// liền. Sau khi bù, mắt thấy đúng vạch 3u, hở 2u.
export function dashArray(w) {
  const u = Math.max(1, Number(w) || 1);
  return `${u * 2} ${u * 3}`;
}

export function loadPenPrefs(storage) {
  let saved = null;
  try {
    saved = JSON.parse(storage.getItem(KEY));
  } catch {
    saved = null;
  }
  if (!saved || typeof saved !== "object") return { ...PEN_DEFAULT };
  // Lọc theo từng key: một giá trị hỏng không được làm mất luôn giá trị còn lại.
  return {
    color: PEN_COLORS.includes(saved.color) ? saved.color : PEN_DEFAULT.color,
    w: PEN_WIDTHS.includes(saved.w) ? saved.w : PEN_DEFAULT.w,
    // SHAPE_TOOL_KINDS chứ không phải SHAPE_KINDS: "quad" là kind hợp lệ nhưng
    // không có nút nào để chọn, nên nó không bao giờ được là kind đang cầm.
    kind: SHAPE_TOOL_KINDS.includes(saved.kind) ? saved.kind : PEN_DEFAULT.kind,
    fill: saved.fill === true,
    // Cỡ CHỮ, không liên quan tới `w` (độ dày nét): hai thứ nằm chung một object
    // vì khu 4 là một khối duy nhất, nhưng không bao giờ dùng thay cho nhau.
    size: TEXT_SIZES.includes(saved.size) ? saved.size : PEN_DEFAULT.size,
    // `!== false` chứ không `=== true`: prefs đã lưu từ TRƯỚC khi có tính năng
    // này không có field `snap`, mà mặc định của nó là bật — `=== true` sẽ tắt
    // tính năng cho đúng những người đã dùng app lâu nhất.
    snap: saved.snap !== false,
    // `!== false` cùng lý do với `snap`: prefs lưu từ trước khi có tính năng này
    // không có field `scratch`, mà mặc định của nó là bật.
    scratch: saved.scratch !== false,
    // Ngược lại với `snap`: mặc định là TẮT (nét liền), nên `=== true` mới đúng —
    // prefs cũ không có field này phải ra nét liền.
    dashed: saved.dashed === true,
    // Lọc theo danh sách y như `kind`: một giá trị lạ trong localStorage không
    // được đẩy cục gôm vào một kiểu không có code xử lý.
    erase: ERASE_MODES.includes(saved.erase) ? saved.erase : PEN_DEFAULT.erase,
    ew: ERASE_WIDTHS.includes(saved.ew) ? saved.ew : PEN_DEFAULT.ew
  };
}

export function savePenPrefs(storage, prefs) {
  try {
    storage.setItem(KEY, JSON.stringify({
      color: prefs.color, w: prefs.w, kind: prefs.kind, fill: prefs.fill === true,
      size: prefs.size, snap: prefs.snap !== false, scratch: prefs.scratch !== false,
      dashed: prefs.dashed === true,
      erase: prefs.erase, ew: prefs.ew
    }));
  } catch {
    // Hết quota hoặc chế độ riêng tư — mất lựa chọn bút, không đáng làm sập app.
  }
}
