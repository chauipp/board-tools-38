// ESLint (flat config) — CHỈ hai luật của React hooks, không luật định dạng nào.
//
// - rules-of-hooks: error. Gọi hook có điều kiện là lỗi thật (IdeaMap có nhánh
//   `if (!board) return` ở giữa — xem các ghi chú "phải khai ở đây").
// - exhaustive-deps: warn. Code đã có sẵn các `eslint-disable-line
//   react-hooks/exhaustive-deps` có chủ đích. Mỗi cảnh báo còn lại là một thay
//   đổi hành vi tiềm ẩn nếu "sửa" theo gợi ý, nên xử lý từng cái riêng, KHÔNG
//   sửa hàng loạt (plan refactor, task 7.1).
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "smoke-dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];
