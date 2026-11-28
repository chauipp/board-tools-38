// Bundle của smoke test: gom mọi kịch bản vào một file để smoke-run.mjs nạp.
// Thêm kịch bản mới: tạo src/__smoke__/scenarios/<tên>.jsx export
// `async function run(log)`, rồi thêm vào đây VÀ vào SCENARIOS trong smoke-run.mjs.
import { run as board } from "./scenarios/board.jsx";
import { run as concurrentNudge } from "./scenarios/concurrent-nudge.jsx";
import { run as gameDesignPanels } from "./scenarios/game-design-panels.jsx";
import { run as treePanel } from "./scenarios/tree-panel.jsx";
import { run as workspace } from "./scenarios/workspace.jsx";

export const scenarios = {
  board,
  "concurrent-nudge": concurrentNudge,
  "game-design-panels": gameDesignPanels,
  "tree-panel": treePanel,
  workspace
};
