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
// - rebaseDetailed(server, base, next)  như rebase nhưng trả `{ board, plan }`,
//                           `plan` là bản đồ đổi id (lib/rebase.js). Có thì dùng
//                           thay cho `rebase`, và plan được đưa cho merge/adopt.
// - merge(rebased, plan)    trộn bản đã ghép với bản local hiện tại (giữ thẻ
//                           đang gõ dở); trả về bản sẽ lưu tiếp / sẽ hiện.
// - adopt(board, plan)      đưa bản đã trộn lên màn hình.
// - getBase/setBase, getStamp/setStamp  bản nền + mốc updatedAt mà ta tin
//                           server đang giữ.
// - onState({ error })      error: true khi lưu hỏng, null khi lưu được.
//
// BẢN CHỜ VÀ BẢN NỀN CỦA NÓ (review PR #7, vòng 2). Có hai chỗ một board nằm
// chờ: `pending` (xếp sau cú PUT đang bay) và `timerEntry` (cú lưu hẹn giờ của
// saveDebounced). Mỗi bản chờ đi kèm BẢN NỀN mà nó được dựng trên đó. Mỗi khi
// biết một bản server mới — 409 của cú đang bay, hoặc board:update của người
// khác (rebaseQueued) — bản chờ được đắp lại `nền → bản chờ` lên bản server đó
// và nhận bản server làm nền mới. Thiếu việc này thì bản chờ là một board CŨ
// được gửi kèm mốc MỚI: server chấp nhận, và thay đổi của người kia bị xoá âm
// thầm. Đắp lại từ nền của chính nó cũng là thứ giữ cho id đổi do va chạm
// (hai người cùng tạo thẻ số 1) nhất quán qua mọi bản chờ, kể cả tham chiếu.
export function createSaveQueue({
  canSave = () => true,
  prepare = (next) => next,
  save,
  rebase,
  rebaseDetailed,
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
  let pending = null;     // { board, base } | null
  let timer = null;
  let timerEntry = null;  // { board, base } | null

  function doRebase(server, base, next) {
    if (rebaseDetailed) return rebaseDetailed(server, base, next) || null;
    const board = rebase(server, base, next);
    return board ? { board, plan: null } : null;
  }

  // Mốc dạng thời gian thì không bao giờ lùi: phản hồi của một PUT cũ có thể về
  // SAU gói board:update mới hơn của người khác. Mốc không phải thời gian (test)
  // thì coi như luôn mới.
  function isOlderStamp(candidate, current) {
    const a = Date.parse(candidate), b = Date.parse(current);
    return Number.isFinite(a) && Number.isFinite(b) && a < b;
  }

  function cancelTimer() {
    if (timer) { clearTimer(timer); timer = null; }
    timerEntry = null;
  }

  // Đắp lại mọi bản chờ lên `server`. Trả về bản chờ MỚI NHẤT sau khi ghép (cú
  // hẹn giờ mới hơn cú xếp hàng) cùng plan của nó, hoặc null nếu không có gì chờ.
  function requeueOnto(server) {
    let latest = null;
    for (const entry of [pending, timerEntry]) {
      if (!entry) continue;
      const r = doRebase(server, entry.base, entry.board);
      // Ghép hỏng thì giữ nguyên bản chờ — đúng hành vi cũ, không tệ hơn.
      if (!r) continue;
      entry.board = r.board;
      entry.base = server;
      latest = r;
    }
    return latest;
  }

  // Người khác vừa lưu và bản của họ (`server`) sắp thành bản nền mới: gọi hàm
  // này TRƯỚC khi dời nền/mốc. Trả về board nên hiện lên màn hình (bản server
  // cộng những gì mình làm mà chưa lưu), hoặc null nếu không có gì đang chờ.
  function rebaseQueued(server) {
    const latest = requeueOnto(server);
    return latest ? latest.board : null;
  }

  // Cú lưu hiện tại (kể cả các vòng ghép lại của riêng nó) vừa xong — cho nó
  // chạy tiếp cú đang xếp hàng, nếu có, với `base` giờ đã mới nhất.
  function settleSave() {
    saving = false;
    if (pending == null) return;
    const queued = pending;
    pending = null;
    // Rút bản chờ ra gửi là việc NỘI BỘ: không được huỷ cú hẹn giờ. Cú hẹn giờ
    // (nếu có) mới hơn bản này và sẽ tự gửi khi tới hạn.
    start(queued.board);
  }

  // Người dùng vừa làm một việc mới và muốn lưu ngay: nó thay cho cú hẹn giờ.
  function saveNow(next) {
    cancelTimer();
    enqueue(next, getBase());
  }

  function enqueue(next, base) {
    if (!canSave()) return;
    // Đang có một cú PUT bay (kể cả đang ghép lại): không bắn cú mới đè lên nó.
    // `base` chốt lúc gửi sẽ là bản NGAY LÚC ĐÓ, mà cú đang bay có thể sắp
    // thêm một thẻ mà `base` chưa biết — bắn chồng lên là hạt giống của đúng
    // bug "dán ảnh rồi kéo rộng ra thì hiện thêm 1 ảnh cỡ gốc ở vị trí cũ" (xem
    // ghi chú đầu file). Chỉ giữ lại BẢN MỚI NHẤT cần lưu; những state ở giữa
    // không cần lưu riêng.
    if (saving) { pending = { board: prepare(next), base }; return; }
    start(next);
  }

  function start(next) {
    if (!canSave()) return;
    saving = true;
    send(prepare(next), 0);
  }

  function send(next, tries) {
    // Mốc và bản nền được CHỐT ngay đây, trước khi cú PUT rời máy: nếu đọc lại ở
    // trong .catch thì lúc đó chúng có thể đã bị một gói board:update chen vào
    // sửa mất, và delta sẽ tính từ nhầm mốc.
    const base = getBase();
    const baseUpdatedAt = getStamp();
    const saved = (res) => {
      // Trong lúc cú này bay, một board:update mới hơn có thể đã dời nền/mốc.
      // Khi đó bản nền hiện tại đã gồm cả cú này — đừng lùi về mốc cũ.
      if (!isOlderStamp(res.updatedAt, getStamp())) {
        setStamp(res.updatedAt);
        setBase(next);
      }
      onState({ error: null });
      settleSave();
    };
    save(next, baseUpdatedAt)
      .then(saved)
      .catch((e) => {
        if (e.code !== "CONFLICT") { onState({ error: true }); settleSave(); return; }
        // Có người lưu chen vào giữa. Bản của họ đi kèm ngay trong lỗi; đắp
        // những gì mình đã đổi (base → next) lên đó rồi lưu lại.
        const server = e.board;
        const rebased = server ? doRebase(server, base, next) : null;
        if (!rebased || tries >= maxTries) {
          // Đường dự phòng = đúng hành vi trước khi có chốt này: ghi đè. Không
          // đẹp, nhưng nó bảo đảm việc thêm chốt không bao giờ làm mọi thứ TỆ
          // HƠN trước — trường hợp xấu nhất chỉ là quay về mức cũ.
          // Tới đây nghĩa là ghép ra một board không lành lặn (id trùng, dây mất
          // đầu) hoặc đã thử quá số lần.
          save(next, undefined)
            .then(saved)
            .catch(() => { onState({ error: true }); settleSave(); });
          return;
        }
        // Giữ nguyên đúng cái thẻ đang gõ dở — cùng luật với lúc áp một
        // board:update, nên không có hai cách trộn khác nhau để lệch nhau.
        const merged = merge(rebased.board, rebased.plan);
        // Các bản chờ được dựng TRƯỚC khi ghép: đắp lại chúng lên bản server.
        const latest = requeueOnto(server);
        setStamp(server.updatedAt);
        setBase(server);
        // Màn hình hiện bản MỚI NHẤT: bản ghép cộng những gì người dùng làm
        // trong lúc chờ, chứ không lùi về bản ghép của riêng cú đang bay.
        if (latest) adopt(merge(latest.board, latest.plan), latest.plan);
        else adopt(merged, rebased.plan);
        send(prepare(merged), tries + 1);
      });
  }

  function saveDebounced(next, ms = 500) {
    if (timer) clearTimer(timer);
    timerEntry = { board: next, base: getBase() };
    timer = setTimer(() => {
      const entry = timerEntry;
      timer = null;
      timerEntry = null;
      if (entry) enqueue(entry.board, entry.base);
    }, ms);
  }

  // Bỏ mọi bản đang chờ (không đụng cú đang bay). Dùng khi board bị THAY HẲN,
  // ví dụ khôi phục snapshot: bản chờ dựng trên board cũ mà gửi sau đó sẽ đè
  // mất bản vừa khôi phục.
  function discardQueued() {
    pending = null;
    cancelTimer();
  }

  return { saveNow, saveDebounced, cancelTimer, rebaseQueued, discardQueued };
}
