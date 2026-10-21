import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createWorkspaceController, workspaceProfile } from "./workspace-state.js";

export function useWorkspaceState(email, boardId) {
  const [profile, setProfile] = useState(() => workspaceProfile(window.innerWidth));
  useEffect(() => {
    const resize = () => setProfile(workspaceProfile(window.innerWidth));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const controller = useMemo(() => createWorkspaceController({ email: email || "", boardId, profile, storage: window.localStorage }), [email, boardId, profile]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    void controller.start();
    const flush = () => { void controller.flush(); };
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("online", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("online", flush); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", hidden);
      flush(); controller.dispose();
    };
  }, [controller]);
  return { ...snapshot, profile, controller, update: controller.update, flush: controller.flush };
}
