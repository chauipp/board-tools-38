// Font của skin vẽ tay, tách ra một module riêng để useSkin() nạp LƯỜI — chỉ
// chạy khi người dùng bật skin lần đầu, nên ai không dùng thì bundle không đổi
// một byte.
//
// Vì sao là Shantell Sans chứ không phải Excalifont — font của chính Excalidraw:
// đã tải về đếm glyph, Excalifont phủ 561 ký tự và chỉ có 8/256 ký tự của khối
// U+1E00–1EFF, tức gần như không có chữ có dấu thanh của tiếng Việt. Nó có "á"
// (khối Latin-1, font Latin nào cũng có) nên nhìn qua tưởng chạy được, nhưng
// "ư", "ơ" và toàn bộ "ế ậ ữ ộ" thì rơi về font dự phòng — một chữ trong câu
// trông khác hẳn phần còn lại. Caveat, Architects Daughter, Kalam, Indie Flower,
// Gochi Hand, Nanum Pen cũng vậy. Chỉ Patrick Hand và Shantell Sans có subset
// vietnamese; chọn Shantell Sans vì Patrick Hand chỉ có một cân nặng, mà tiêu đề
// thẻ cần đậm hơn phần mô tả.
//
// Chỉ hai subset và hai cân nặng: thiếu vietnamese là hỏng như trên, thừa các
// subset khác thì tải phí.
import "@fontsource/shantell-sans/latin-400.css";
import "@fontsource/shantell-sans/latin-600.css";
import "@fontsource/shantell-sans/vietnamese-400.css";
import "@fontsource/shantell-sans/vietnamese-600.css";
