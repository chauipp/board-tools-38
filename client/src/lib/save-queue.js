// Hàng đợi lưu board: một cú PUT bay tại một thời điểm, 409 thì ghép lại
// (rebase) rồi thử tiếp, ghép hỏng thì ghi đè. Trước nằm trong IdeaMap.jsx
// (saveNow / settleSave / saveDebounced); tách ra đây để test được bằng
// node:test. Không dính React: mọi thứ đụng state/ref được tiêm qua tham số.
//
// Vì sao phải xếp hàng (trước là ghi chú ở savingRef trong IdeaMap.jsx):
// không cho cú saveNow() thứ hai bay chồng lên cú đang bay. Nó sẽ chốt
// `base`/`baseUpdatedAt` TỪ TRƯỚC khi cú thứ nhất về, nên nếu cú thứ nhất vừa
// thêm một thẻ (ví dụ dán ảnh) thì `base` của cú thứ hai vẫn chưa biết thẻ đó
// tồn tại. Khi đó cú thứ hai đụng conflict, rebaseBoard thấy thẻ đó có trên
// server nhưng không có trong base của mình → tưởng lầm là thẻ CỦA NGƯỜI KHÁC
// trùng id, tự cấp cho nó một id mới rồi giữ lại CẢ HAI — đúng hiện tượng "dán
// ảnh xong kéo rộng ra thì hiện thêm 1 ảnh cỡ gốc ở vị trí cũ". Xếp hàng ở đây
// để `base` luôn phản ánh đúng lần lưu gần nhất của CHÍNH MÌNH trước khi tính
// delta tiếp.

// Trần số lần ghép lại. Mỗi vòng đều tiến (mốc mới hơn, delta nhỏ đi), nên
// chạm trần nghĩa là có ai đó đang lưu liên tục nhanh hơn mình — lúc đó đi
// đường dự phòng còn hơn quay vòng mãi.
export const MAX_REBASE_TRIES = 3;

// Tham số:
// - canSave()               false thì không lưu gì cả (viewer). Đọc qua hàm chứ
//                           không nhận giá trị: saveNow là chốt chặn cuối, nó
//                           phải đúng kể cả khi được gọi từ một closure cũ.
// - prepare(next)           sửa bản sắp lưu trước khi gửi (IdeaMap: xếp lại cây
//                           khoá), trả về bản sẽ lưu. Chạy ở MỌI vòng, kể cả vòng
//                           ghép lại.
// - save(next, stamp)       gửi PUT; `stamp` undefined = ghi đè không kèm mốc.
//                           Trả Promise<{ updatedAt }>, lỗi 409 mang
//                           `code: "CONFLICT"` và `board` (bản server).
// - rebase(server, base, next)  đắp delta base → next lên bản server; null = hỏng.
// - merge(rebased)          trộn bản đã ghép với bản local hiện tại (giữ camera,
//                           thẻ đang gõ dở); trả về bản sẽ lưu tiếp.
// - adopt(merged)           đưa bản đã trộn lên màn hình.
// - getBase/setBase, getStamp/setStamp  bản nền + mốc updatedAt mà ta tin
//                           server đang giữ.
// - onState({ error })      error: true khi lưu hỏng, null khi lưu được.
export function createSaveQueue({
  canSave = () => true,
  prepare = (next) => next,
  save,
  rebase,
  merge = (rebased) => rebased,
  adopt = () => {},
  getBase,
  setBase,
  getStamp,
  setStamp,
  onState = () => {},
  maxTries = MAX_REBASE_TRIES,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id)
}) {
  let saving = false;
  let pending = null;
  let timer = null;

  function cancelTimer() {
    if (timer) { clearTimer(timer); timer = null; }
  }

  // Cú lưu hiện tại (kể cả các vòng ghép lại của riêng nó) vừa xong — cho nó
  // chạy tiếp cú đang xếp hàng, nếu có, với `base` giờ đã mới nhất.
  function settleSave() {
    saving = false;
    if (pending == null) return;
    const queued = pending;
    pending = null;
    saveNow(queued);
  }

  function saveNow(next, tries = 0) {
    cancelTimer();
    if (!canSave()) return;
    next = prepare(next);
    // Đang có một cú PUT bay (kể cả đang ghép lại): không bắn cú mới đè lên nó.
    // `base` chốt bên dưới sẽ là bản NGAY LÚC NÀY, mà cú đang bay có thể sắp
    // thêm một thẻ mà `base` chưa biết — bắn chồng lên là hạt giống của đúng
    // bug "dán ảnh rồi kéo rộng ra thì hiện thêm 1 ảnh cỡ gốc ở vị trí cũ" (xem
    // ghi chú đầu file). Chỉ giữ lại BẢN MỚI NHẤT cần lưu; những state ở giữa
    // không cần lưu riêng.
    if (tries === 0) {
      if (saving) { pending = next; return; }
      saving = true;
    }
    // Mốc và bản nền được CHỐT ngay đây, trước khi cú PUT rời máy: nếu đọc lại ở
    // trong .catch thì lúc đó chúng có thể đã bị một gói board:update chen vào
    // sửa mất, và delta sẽ tính từ nhầm mốc.
    const base = getBase();
    const baseUpdatedAt = getStamp();
    save(next, baseUpdatedAt)
      .then((res) => {
        setStamp(res.updatedAt);
        setBase(next);
        onState({ error: null });
        settleSave();
      })
      .catch((e) => {
        if (e.code !== "CONFLICT") { onState({ error: true }); settleSave(); return; }
        // Có người lưu chen vào giữa. Bản của họ đi kèm ngay trong lỗi; đắp
        // những gì mình đã đổi (base → next) lên đó rồi lưu lại.
        const server = e.board;
        const rebased = server ? rebase(server, base, next) : null;
        if (!rebased || tries >= maxTries) {
          // Đường dự phòng = đúng hành vi trước khi có chốt này: ghi đè. Không
          // đẹp, nhưng nó bảo đảm việc thêm chốt không bao giờ làm mọi thứ TỆ
          // HƠN trước — trường hợp xấu nhất chỉ là quay về mức cũ.
          // Tới đây nghĩa là ghép ra một board không lành lặn (id trùng, dây mất
          // đầu) hoặc đã thử quá số lần.
          save(next, undefined)
            .then((res) => {
              setStamp(res.updatedAt);
              setBase(next);
              onState({ error: null });
              settleSave();
            })
            .catch(() => { onState({ error: true }); settleSave(); });
          return;
        }
        // Giữ nguyên camera của mình và giữ nguyên đúng cái thẻ đang gõ dở —
        // cùng luật với lúc áp một board:update, nên không có hai cách trộn
        // khác nhau để lệch nhau.
        const merged = merge(rebased);
        setStamp(server.updatedAt);
        setBase(server);
        adopt(merged);
        saveNow(merged, tries + 1);
      });
  }

  function saveDebounced(next, ms = 500) {
    if (timer) clearTimer(timer);
    timer = setTimer(() => saveNow(next), ms);
  }

  return { saveNow: (next) => saveNow(next), saveDebounced, cancelTimer };
}
