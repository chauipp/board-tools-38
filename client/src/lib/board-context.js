import { createContext, useContext } from "react";

// Ngữ cảnh CHỈ ĐỌC của một board đang mở: { store, selection, camera } — đúng
// ba object mà useBoardStore, useBoardSelection, useCamera trả về. IdeaMap cấp
// nó; các component con nhận quá ~15 prop (BoardCanvas, BoardTopBar, …) lấy ba
// thứ này từ đây thay vì nhận từng giá trị qua prop.
//
// "Chỉ đọc" là quy ước: component con vẫn gọi được hàm ghi của store (commit,
// undo…) như trước, nhưng không thay object trong ngữ cảnh.
export const BoardContext = createContext(null);

export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard() phải nằm trong <BoardContext.Provider>");
  return value;
}
