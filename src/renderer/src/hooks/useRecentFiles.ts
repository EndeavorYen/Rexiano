import { useState, useEffect, useCallback, useRef } from "react";
import type { RecentFile } from "../../../shared/types";

interface UseRecentFilesResult {
  /** List of recent files, sorted most-recent first */
  recentFiles: RecentFile[];
  /** True while the initial load is in progress */
  loading: boolean;
  /** Re-fetch the recent files list (call after loading a new song) */
  refresh: () => void;
  /** Remove a stale recent file by path, then refresh the list */
  remove: (filePath: string) => Promise<void>;
}

/**
 * Hook that loads and exposes the list of recently opened MIDI files.
 *
 * On mount, calls `window.api.loadRecentFiles()` and caches the result.
 * The `refresh()` callback re-fetches so the UI updates after a new song is loaded.
 */
export function useRecentFiles(): UseRecentFilesResult {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchRecents = useCallback(() => {
    window.api
      .loadRecentFiles()
      .then((files: RecentFile[]) => {
        if (mountedRef.current) setRecentFiles(files);
      })
      .catch((err: unknown) => {
        console.error("Failed to load recent files:", err);
        if (mountedRef.current) setRecentFiles([]);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchRecents();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchRecents]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchRecents();
  }, [fetchRecents]);

  const remove = useCallback(
    async (filePath: string) => {
      await window.api.removeRecentFile(filePath);
      fetchRecents();
    },
    [fetchRecents],
  );

  return { recentFiles, loading, refresh, remove };
}
