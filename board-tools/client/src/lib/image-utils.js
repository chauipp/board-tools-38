// DOM-dependent (FileReader) — no node --test coverage, kept tiny.

// Đọc nguyên xi file ảnh thành data URL: KHÔNG vẽ lại qua canvas, không nén lại.
// Bản cũ (compressImage) hạ về 480px rồi mã hoá lại JPEG chất lượng 0.8 trên nền
// trắng — ảnh dán vào bị mờ hẳn so với ảnh gốc, ảnh PNG mất luôn phần trong suốt,
// và phóng to lên là vỡ vì dữ liệu 480px không còn gì để mà phóng. Đọc thẳng
// bytes gốc thì dán vào chất lượng nào ra đúng chất lượng đó, PNG vẫn là PNG.
export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("bad image"));
    reader.readAsDataURL(file);
  });
}
