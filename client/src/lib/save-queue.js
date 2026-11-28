// Hàng đợi lưu board: một cú PUT bay tại một thời điểm, 409 thì ghép lại
// (rebase) rồi thử tiếp, ghép hỏng thì gác bản nháp lại chứ không ghi đè. Trước nằm trong IdeaMap.jsx
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
// chạm trần nghĩa là có ai đó đang lưu liên tục nhanh hơn mình — lúc đó gác
// bản nháp lại, đợi board:update kế tiếp, còn hơn quay vòng mãi.
export const MAX_REBASE_TRIES = 3;

// Tham số:
// - canSave()               false thì không lưu gì cả (viewer). Đọc qua hàm chứ
//                           không nhận giá trị: saveNow là chốt chặn cuối, nó
//                           phải đúng kể cả khi được gọi từ một closure cũ.
// - prepare(next)           sửa bản sắp lưu trước khi gửi (IdeaMap: xếp lại cây
//                           khoá), trả về bản sẽ lưu. Chạy ở MỌI vòng, kể cả vòng
//                           ghép lại.
// - save(next, stamp)       gửi PUT kèm mốc `stamp` (mốc bản nền). Hàng đợi
//                           không còn tự chuyển sang ghi đè không mốc (R3-5).
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
  // Gói board:update mới nhất về trong lúc một PUT đang bay (R3-1, Codex vòng
  // 3). Chưa thể biết gói đó ĐÃ gồm cú PUT này hay chưa: nếu người kia lưu SAU
  // mình thì có (và PUT sẽ thành công), nếu TRƯỚC thì không (và PUT sẽ 409, vì
  // server ghi có điều kiện theo mốc). Đắp bản chờ lên gói đó ngay lúc ấy là
  // đoán; đoán "chưa gồm" thì thẻ mình vừa tạo bị coi là thẻ của người khác
  // trùng id và bị nhân đôi. Nên giữ gói lại, đợi PUT có kết quả rồi mới xử.
  let heldRemote = null;
  // Bản nháp bị gác lại (R3-5, Codex vòng 3): 409 mà ghép hỏng hoặc đã thử quá
  // số lần. Trước đây chỗ này ghi đè cả board không kèm mốc, xoá luôn dữ liệu
  // mới của người khác. Giờ bản nháp nằm đây, được đắp lại lên mỗi board:update
  // như mọi bản chờ, và được thử lưu lại ngay sau đó. Thao tác mới của người
  // dùng (mới hơn nó) thì thay chỗ nó.
  let stalled = null;     // { board, base } | null

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
    for (const entry of [stalled, pending, timerEntry]) {
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
    const wasStalled = stalled;
    const latest = requeueOnto(server);
    // Bản nháp gác lại vừa ghép được lên bản mới nhất: thử lưu lại. Qua timer
    // chứ không gửi ngay, vì người gọi còn đang dời nền/mốc sang `server`.
    if (wasStalled && stalled.base === server) {
      stalled = null;
      if (!timerEntry) {
        timerEntry = wasStalled;
        timer = setTimer(fireTimer, 0);
      }
    }
    return latest ? latest.board : null;
  }

  // Gọi TRƯỚC rebaseQueued khi một board:update về. Trả true nghĩa là đang có
  // PUT bay: hàng đợi đã giữ gói lại và sẽ tự đưa nó lên màn hình (adopt) khi
  // PUT có kết quả — người gọi KHÔNG được đụng board, bản nền hay bản chờ. Mốc
  // (getStamp) thì người gọi vẫn dời như thường: không cú PUT nào rời máy trước
  // lúc gói được xử, và `saved` dựa vào mốc đó để biết gói mới hơn phản hồi.
  function deferRemote(server) {
    if (!saving) return false;
    heldRemote = server;
    return true;
  }

  // Đưa lên màn hình bản chờ mới nhất, hoặc chính bản server nếu không còn gì
  // chờ. `merge` giữ thẻ đang gõ dở.
  function show(latest, server) {
    if (latest) adopt(merge(latest.board, latest.plan), latest.plan);
    else adopt(merge(server, null), null);
  }

  // PUT `flight` vừa thành công và gói giữ lại `remote` mới hơn nó: gói đó là
  // bản của người lưu SAU mình, nên đã gồm `flight`. Mọi bản chờ được dựng trên
  // `flight` (chúng mới hơn nó), nên delta của chúng tính từ `flight`, không từ
  // nền cũ — tính từ nền cũ là đắp lại cả thẻ `flight` vừa tạo, ra thẻ trùng.
  function adoptHeldAfterSave(remote, flight) {
    let latest = null;
    for (const entry of [pending, timerEntry]) {
      if (!entry) continue;
      const r = doRebase(remote, flight, entry.board);
      if (r) { entry.board = r.board; latest = r; }
      entry.base = remote;
    }
    setBase(remote);
    show(latest, remote);
  }

  // PUT hỏng (lỗi mạng, không phải 409): server vẫn giữ `remote`, chưa có gì
  // của mình. Đắp toàn bộ phần chưa lưu — tính từ nền cũ — lên `remote`, để bản
  // chờ gửi sau không xoá thay đổi của người kia.
  function adoptHeldAfterFailure(remote, flight, flightBase) {
    let latest = null;
    for (const entry of [pending, timerEntry]) {
      if (!entry) continue;
      const r = doRebase(remote, entry.base, entry.board);
      if (!r) continue;
      entry.board = r.board;
      entry.base = remote;
      latest = r;
    }
    // Không còn gì chờ: phần của cú hỏng vẫn phải còn trên màn hình (và trong
    // delta của lần lưu sau, vì nền giờ là `remote`).
    if (!latest) latest = doRebase(remote, flightBase, flight);
    setBase(remote);
    show(latest, remote);
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
    // Mọi bản gửi đi đều mới hơn bản nháp gác lại (được dựng trên màn hình, mà
    // màn hình đã gồm nó). Để nó lại thì board:update sau sẽ gửi lại bản CŨ đó.
    stalled = null;
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
      const remote = heldRemote;
      heldRemote = null;
      // Gói giữ lại mới hơn phản hồi: người kia lưu SAU cú này, bản của họ đã
      // gồm nó. Mốc tương ứng useLiveSync đã dời rồi; chỉ còn nền và bản chờ.
      // (Mốc không so được — test — thì cũng coi là mới hơn: PUT có mốc mà
      // thành công nghĩa là không ai ghi chen TRƯỚC nó.)
      if (remote && !isOlderStamp(remote.updatedAt, res.updatedAt)) {
        adoptHeldAfterSave(remote, next);
      } else if (!isOlderStamp(res.updatedAt, getStamp())) {
        setStamp(res.updatedAt);
        setBase(next);
        // Bản chờ mới hơn cú vừa lưu, và server giờ giữ đúng cú đó: nền của
        // chúng là `next`. Để nền cũ thì gói board:update kế tiếp sẽ đắp lại cả
        // phần đã lưu (thẻ vừa tạo bị nhân đôi — cùng họ lỗi R3-1).
        for (const entry of [pending, timerEntry]) if (entry) entry.base = next;
      }
      onState({ error: null });
      settleSave();
    };
    const failed = () => {
      const remote = heldRemote;
      heldRemote = null;
      onState({ error: true });
      if (remote) adoptHeldAfterFailure(remote, next, base);
      settleSave();
    };
    save(next, baseUpdatedAt)
      .then(saved)
      .catch((e) => {
        if (e.code !== "CONFLICT") { failed(); return; }
        // Có người lưu chen vào giữa. Bản của họ đi kèm ngay trong lỗi; đắp
        // những gì mình đã đổi (base → next) lên đó rồi lưu lại. Gói giữ lại
        // (nếu có) không gồm cú này — nó 409 — nên chỉ dùng nó khi mới hơn.
        const remote = heldRemote;
        heldRemote = null;
        const server = remote && e.board && isOlderStamp(e.board.updatedAt, remote.updatedAt) ? remote : e.board;
        const rebased = server ? doRebase(server, base, next) : null;
        if (!rebased || tries >= maxTries) {
          // Ghép ra board không lành lặn (id trùng, dây mất đầu), hoặc đã thử
          // quá số lần vì ai đó lưu liên tục. KHÔNG ghi đè (R3-5): gác bản nháp
          // lại, báo lỗi, và thử lại khi biết bản server kế tiếp hoặc khi người
          // dùng thao tác tiếp. Không mất gì của mình, không xoá gì của ai.
          if (rebased) {
            // Ghép được, chỉ hết lượt: gác bản ĐÃ ghép, nền là bản server, để
            // màn hình thấy luôn thay đổi của người kia.
            const latest = requeueOnto(server);
            stalled = { board: rebased.board, base: server };
            setStamp(server.updatedAt);
            setBase(server);
            if (latest) adopt(merge(latest.board, latest.plan), latest.plan);
            else adopt(merge(rebased.board, rebased.plan), rebased.plan);
          } else {
            // Ghép hỏng: giữ nguyên bản nháp trên nền cũ. Mốc lùi về đúng mốc
            // của nền đó (gói giữ lại, nếu có, đã bị bỏ), để cú PUT sau 409 và
            // ghép từ đúng nền thay vì lọt qua với một board thiếu dữ liệu mới.
            stalled = { board: next, base };
            setStamp(baseUpdatedAt);
          }
          onState({ error: true });
          settleSave();
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

  function fireTimer() {
    const entry = timerEntry;
    timer = null;
    timerEntry = null;
    if (entry) enqueue(entry.board, entry.base);
  }

  function saveDebounced(next, ms = 500) {
    if (timer) clearTimer(timer);
    timerEntry = { board: next, base: getBase() };
    timer = setTimer(fireTimer, ms);
  }

  // Bỏ mọi bản đang chờ (không đụng cú đang bay). Dùng khi board bị THAY HẲN,
  // ví dụ khôi phục snapshot: bản chờ dựng trên board cũ mà gửi sau đó sẽ đè
  // mất bản vừa khôi phục.
  function discardQueued() {
    pending = null;
    stalled = null;
    heldRemote = null;
    cancelTimer();
  }

  return { saveNow, saveDebounced, cancelTimer, rebaseQueued, deferRemote, discardQueued };
}
