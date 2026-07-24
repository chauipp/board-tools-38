# Thiết kế: Lingui i18n Anh/Việt cho game-tools client

Ngày: 2026-07-24

## 1. Mục tiêu

Cho phép người dùng chuyển giao diện app `game-tools` giữa **tiếng Việt** và **tiếng Anh** bằng một nút bấm, dùng thư viện LinguiJS.

### Không nằm trong phạm vi

- **Dịch dữ liệu người dùng.** Xem mục 3.
- **Đưa danh sách trạng thái vào DB.** Hiện `STATUS` là hằng số cứng trong code nên người dùng không tự thêm/xoá/đổi tên trạng thái được. Đây là việc cần làm và đã được thống nhất, nhưng là **một dự án riêng có spec riêng** (đụng schema Mongo, cần màn hình quản lý, cần xử lý xoá trạng thái đang có thẻ dùng, cần di trú dữ liệu cũ). Dự án i18n này **tuyệt đối không đụng vào nhãn trạng thái** để hai việc không giẫm chân nhau.
- **Dựng hạ tầng test.** Dự án hiện không có test framework nào. Xem mục 8.
- **Đổi bất cứ thứ gì ở `server/`.**

## 2. Hiện trạng

- Client React 18 + Vite 5 + react-router 6, không có babel config riêng.
- Toàn bộ chữ giao diện là tiếng Việt viết thẳng trong JSX, khoảng **70 chuỗi** nằm ở 3 trang: `IdeaMap.jsx` (859 dòng), `Calculator.jsx` (240), `Home.jsx` (58).
- `lib/api.js` chứa thêm 4 câu lỗi tiếng Việt được ném ra bằng `new Error(...)` rồi hiển thị cho người dùng.
- Đã có sẵn pattern lưu tuỳ chọn người dùng: `useTheme.js` ghi khoá `theme-pref` vào `localStorage`. Phần i18n sẽ soi gương pattern này.

## 3. Ranh giới dịch

Quy tắc chủ đạo do chủ dự án đặt ra: **cái gì nằm trong DB thì không dịch.**

### Có dịch — chữ giao diện, không bao giờ đi vào DB

Nút bấm, tiêu đề, nhãn cột bảng, tooltip, placeholder, thông báo lỗi, kết quả mô phỏng đối đầu, câu gợi ý khi bản đồ trống, chữ `Chưa gắn nhãn` (khoá nội bộ vẫn là `—`, chỉ chữ hiển thị được dịch).

### Không dịch — là dữ liệu, hoặc chảy vào dữ liệu

| Đối tượng | Lý do |
|---|---|
| `node.title`, `node.desc`, `node.tag` | Người dùng tự nhập, nằm trong Mongo |
| `stat.name` (Calculator) | Người dùng tự nhập, nằm trong Mongo |
| `TAG_SUGGESTIONS` | Chọn xong là ghi thẳng vào `node.tag`. Nếu dịch, người dùng EN chọn "Mechanics" còn người dùng VI chọn "Cơ chế" → bộ lọc tách thành hai chip trùng ý, dữ liệu phân mảnh theo ngôn ngữ |
| Nhãn trạng thái (`Ý tưởng mới`, `Đang cân nhắc`, …) | Sắp trở thành dữ liệu người dùng ở dự án kế tiếp. Để nguyên tiếng Việt, không bọc `<Trans>` |
| Dữ liệu mẫu ở `server/index.js` | Chỉ seed một lần khi DB trống; DB hiện đã có dữ liệu thật nên không ai nhìn thấy |

### Một ngoại lệ có chủ đích

Giá trị mặc định khi tạo mới — `"Ý tưởng mới"` (nút `+ Ý tưởng`, và fallback trong `saveNodeEdit` khi để trống tiêu đề) và `"Chỉ số mới"` (nút `+ Thêm chỉ số`) — **được dịch theo ngôn ngữ đang xem** rồi ghi vào DB.

Đây là ngoại lệ có ý thức của quy tắc trên, không phải sơ suất. Lý do chấp nhận được: đây là chữ tạm sống vài giây trước khi người dùng gõ đè, khác về bản chất với nhãn hay trạng thái vốn là phân loại dùng chung lâu dài. Hệ quả đã được cân nhắc và chấp nhận: nếu người dùng EN tạo thẻ rồi không đổi tên, DB sẽ lưu `"New idea"`.

## 4. Quyết định kỹ thuật

| Hạng mục | Quyết định | Lý do |
|---|---|---|
| Phiên bản | Lingui **v6.5.0** | Bản hiện hành, đã kiểm chứng trên npm ngày 2026-07-24. Ở v6 macro nhập từ `@lingui/react/macro` và `@lingui/core/macro`; gói `@lingui/macro` cũ dừng ở 5.9.5, **không dùng** |
| Ngôn ngữ gốc | Tiếng Việt | Diff nhỏ nhất, đọc code vẫn hiểu ngay. Đánh đổi đã chấp nhận: sửa chữ tiếng Việt sau này làm mất bản dịch EN của đúng câu đó, phải dịch lại một câu |
| Gắn vào build | Macro babel + `@lingui/vite-plugin` | Đường chính thống của Lingui với Vite. `lingui extract` tự quét code sinh catalog nên không thể quên dịch một câu. Vite plugin cho import thẳng `.po`, bỏ được bước `lingui compile` thủ công — bước này nếu quên chạy sẽ sinh lỗi rất khó nhận ra |
| Nạp catalog | Tĩnh, nạp sẵn cả 2 ngữ | ~70 chuỗi, quá nhỏ để phải tải động. Tải tĩnh thì đổi ngữ không bị nháy chữ |
| Mặc định lần đầu | Luôn VI | Team là người Việt, mở lên thấy tiếng Việt ngay. Không dò `navigator.language` để tránh chuyện máy để Chrome tiếng Anh thì app tự ra tiếng Anh, dễ tưởng lỗi |
| Ghi nhớ lựa chọn | `localStorage`, khoá `locale-pref` | Đồng nhất với `theme-pref` sẵn có |
| Nút chuyển | Một nút gọn hiện ngữ đang dùng, bấm để đổi qua lại | Đặt cạnh nút `◐` trên cả 3 trang. Topbar `IdeaMap` đã khá đông nút nên chọn dạng gọn nhất |

## 5. Kiến trúc

Hai module mới, mỗi module một trách nhiệm rõ ràng.

### `src/lib/i18n.js` — sở hữu trạng thái ngôn ngữ

Là nơi duy nhất biết về `localStorage`, danh sách ngữ, và việc kích hoạt catalog. Không biết gì về React.

- Nạp sẵn cả hai catalog `vi` và `en` khi module được import.
- Đọc `locale-pref` từ `localStorage`; nếu không có hoặc giá trị lạ thì dùng `vi`.
- Bọc mọi truy cập `localStorage` trong `try/catch` — giống `useTheme.js` đang làm, phòng chế độ duyệt web riêng tư.

Giao diện xuất ra:

| Tên | Kiểu | Việc |
|---|---|---|
| `i18n` | object | Thực thể Lingui, để `main.jsx` truyền vào `I18nProvider` |
| `activateLocale(next)` | hàm | Kích hoạt ngữ mới và ghi nhớ vào `localStorage` |
| `LOCALES` | mảng | `["vi", "en"]` |

### `src/components/LocaleToggle.jsx` — chỉ vẽ cái nút

Đọc ngữ hiện tại qua `useLingui()`, bấm thì gọi `activateLocale`. Không đụng `localStorage`, không giữ state riêng. Dùng lại nguyên vẹn ở cả 3 trang.

Đây là file đầu tiên của thư mục `components/` — thư mục này chưa tồn tại.

### `src/main.jsx` — bọc `I18nProvider`

Bọc toàn bộ cây router trong `<I18nProvider i18n={i18n}>`. Provider lắng nghe sự kiện đổi ngữ của Lingui và re-render cây, nhờ đó `activateLocale` là đủ để cả app đổi chữ.

## 6. Ba chỗ phải sửa logic, không chỉ bọc chữ

Đây là phần dễ bị bỏ sót nhất và là lý do chính khiến việc này không phải "tìm và thay thế".

### 6.1 Chuỗi lỗi và kết quả đang bị đóng băng trong state

`saveError`, `loadError` và `duelResult` hiện lưu **câu chữ đã dựng sẵn**. Người dùng mô phỏng đối đầu xong rồi bấm đổi sang tiếng Anh thì câu kết quả vẫn kẹt tiếng Việt, vì nó là chuỗi chết nằm trong state từ lúc bấm nút.

Cách sửa: state lưu **dữ liệu**, câu chữ dựng lúc render.

```
duelResult: "Build A thắng ở lượt 7, còn lại 120 máu."   // trước
duelResult: { kind: "aWins", rounds: 7, hp: 120 }         // sau
```

Các giá trị `kind` cần có: `cannotSimulate`, `stalemate`, `draw`, `aWins`, `bWins`, `timeout`.

Với `saveError`: đổi từ chuỗi sang boolean, câu chữ nằm ở JSX.

### 6.2 `lib/api.js` đang ném ra chữ hiển thị cho người dùng

Bốn hàm trong `api.js` ném `new Error("Không tải được dữ liệu ý tưởng")` v.v., và các trang hiển thị thẳng `e.message` cho người dùng. Tầng gọi API không nên sở hữu chữ giao diện.

Ngoài ra chỗ này đã có sẵn một lỗ rò: khi mất mạng, `fetch` tự ném lỗi của trình duyệt nên `e.message` ra chữ tiếng Anh như `"Failed to fetch"` bất kể người dùng đang xem ngữ nào.

Cách sửa: `api.js` ném lỗi kèm **mã** thay vì câu chữ (`IDEAS_LOAD_FAILED`, `IDEAS_SAVE_FAILED`, `CALC_LOAD_FAILED`, `CALC_SAVE_FAILED`). Trang lưu mã vào state, lúc render mới ánh xạ mã sang câu đã dịch, có nhánh mặc định cho mã lạ và lỗi mạng.

### 6.3 `tagLabel()` là hàm ngoài component nên không gọi hook được

Hàm `tagLabel(tag)` trả về chữ `Chưa gắn nhãn`, nhưng nằm ngoài component nên không dùng được `useLingui()`.

Cách sửa: đổi chữ ký thành `tagLabel(tag, t)`, truyền `t` từ component gọi nó. Phụ thuộc trở nên tường minh và cả hai chỗ gọi (chip trong bộ lọc, và chip-ghost lúc kéo thả) dùng chung một đường.

### Ghi chú: không cần macro `msg`

Macro `msg` (dịch trễ) chỉ cần khi có chuỗi dịch nằm ở **cấp module** — vốn chỉ chạy một lần lúc nạp file nên sẽ đóng băng ở ngữ đầu tiên. Trong dự án này, hằng số cấp module duy nhất chứa chữ tiếng Việt là `STATUS` và `TAG_SUGGESTIONS`, mà **cả hai đều không dịch**. Vì vậy chỉ cần `<Trans>` cho chữ trong JSX và `t` từ `useLingui()` cho chữ trong thuộc tính.

## 7. Files đụng tới

### Thêm mới

```
client/lingui.config.js                    sourceLocale vi, locales [vi, en]
client/src/lib/i18n.js                     sở hữu trạng thái ngôn ngữ
client/src/components/LocaleToggle.jsx     nút chuyển ngữ
client/src/locales/vi/messages.po          catalog nguồn
client/src/locales/en/messages.po          bản dịch tiếng Anh
```

### Sửa

```
client/package.json          + @lingui/core @lingui/react
                             + dev: @lingui/cli @lingui/vite-plugin
                                    @lingui/babel-plugin-lingui-macro
                             + script i18n:extract
client/vite.config.js        + babel macro plugin, + lingui(); giữ nguyên proxy
client/src/main.jsx          + I18nProvider
client/src/index.css         + style .btn.lang cho nút chuyển ngữ
client/src/lib/api.js        ném mã lỗi thay vì câu chữ  (mục 6.2)
client/src/pages/Home.jsx        ~8 chuỗi + LocaleToggle
client/src/pages/IdeaMap.jsx     ~30 chuỗi + LocaleToggle + sửa saveError/loadError/tagLabel
client/src/pages/Calculator.jsx  ~30 chuỗi + LocaleToggle + sửa duelResult/saveError/loadError
```

### Không đụng

```
server/  toàn bộ  ·  client/src/styles/idea-map.css  ·  client/src/styles/calculator.css
client/src/lib/useTheme.js
```

## 8. Cách kiểm chứng

Dự án hiện **không có test framework nào** — không vitest, không testing-library, không có test nào. Spec này không đề xuất dựng hạ tầng test vì đó là thêm một mảng mới nằm ngoài phạm vi. Quyết định này đã được chủ dự án xác nhận.

Kiểm chứng gồm ba lớp:

1. **`npx lingui extract` báo 0 chuỗi thiếu bản dịch.** Đây là lưới an toàn tự động duy nhất và là lý do chính chọn hướng macro: chuỗi nào quên dịch sẽ lộ ra trong `.po` dưới dạng chưa dịch.
2. **`npm run build` pass.**
3. **Kiểm bằng mắt cả 3 trang ở cả 2 ngữ.** Ba kịch bản bắt buộc, tương ứng ba chỗ sửa logic ở mục 6:
   - Bấm "Mô phỏng đối đầu" → đổi ngữ → câu kết quả phải đổi theo.
   - Tắt server → gây lỗi lưu → đổi ngữ → câu lỗi phải đổi theo.
   - Bản đồ có thẻ chưa gắn nhãn → chip phải hiện `Chưa gắn nhãn` / `No tag` đúng ngữ, và kéo thả chip đó vào thẻ vẫn xoá nhãn như cũ.

Ngoài ra cần xác nhận **không hồi quy**: nhãn trạng thái, tên thẻ, tên chỉ số, gợi ý nhãn phải giữ nguyên tiếng Việt ở cả hai ngữ.

## 9. Rủi ro

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Sửa chữ tiếng Việt sau này làm mất bản dịch EN câu đó | Thấp | Hệ quả cố hữu của việc chọn tiếng Việt làm gốc, đã chấp nhận. `lingui extract` sẽ báo câu đó thành chưa dịch nên không âm thầm hỏng |
| Ngoại lệ ở mục 3 làm DB lẫn `"New idea"` | Thấp | Có chủ đích. Người dùng gõ đè ngay; nếu sau này thấy phiền thì đổi sang hướng để trống dùng placeholder |
| Thêm babel plugin làm chậm dev server | Thấp | Macro của Lingui chỉ chạy trên file có import macro |
| Bỏ sót chuỗi trong nhánh hiếm gặp (ví dụ màn hình lỗi tải) | Trung bình | `lingui extract` chỉ bắt được chuỗi **đã bọc**, không bắt được chuỗi quên bọc. Cần rà thủ công từng file một lần cuối |

## 10. Việc kế tiếp

Sau dự án này: spec riêng cho **đưa danh sách trạng thái vào DB**, để người dùng tự thêm/xoá/đổi tên/đổi màu trạng thái cho hợp dự án của họ. Khi đó nhãn trạng thái chính thức trở thành dữ liệu người dùng và quy tắc "trong DB thì không dịch" áp dụng trọn vẹn, không còn ngoại lệ nào.
