import { useEffect } from "react";

export function useCloseOnOutside(ref, onClose) {
  useEffect(() => {
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose]);
}
