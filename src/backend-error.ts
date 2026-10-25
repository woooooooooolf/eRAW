import { t, type MessageKey } from "./i18n";
import type { ReorderEdge } from "./remosaic-boundary";

export function localizeReorderBoundary(edges: readonly ReorderEdge[]): string {
  const keys: Record<ReorderEdge, MessageKey> = { left: "common.left", right: "common.right", top: "common.top", bottom: "common.bottom" };
  return t("processing.reorderBoundary", { edges: edges.map((edge) => t(keys[edge])).join(", ") });
}

export interface BackendError {
  code: string;
  arguments?: Record<string, string | number | boolean>;
  cause?: string | null;
  field?: string | null;
}

const ERROR_MESSAGES: Record<string, MessageKey> = {
  update_open_failed: "backend.updateOpenFailed",
  repository_open_failed: "backend.repositoryOpenFailed",
  document_not_open: "backend.documentNotOpen",
  preview_cache_poisoned: "backend.previewCachePoisoned",
  document_session_poisoned: "backend.documentSessionPoisoned",
  file_open_failed: "backend.fileOpenFailed",
  file_metadata_failed: "backend.fileMetadataFailed",
  file_map_failed: "backend.fileMapFailed",
  tile_task_failed: "backend.tileTaskFailed",
  pixel_task_failed: "backend.pixelTaskFailed",
  analysis_task_failed: "backend.analysisTaskFailed",
  analysis_invalid_roi: "backend.analysisInvalidRoi",
  analysis_invalid_frame: "backend.analysisInvalidFrame",
  display_range_task_failed: "backend.displayRangeTaskFailed",
  display_range_invalid_frame: "backend.displayRangeInvalidFrame",
  display_invalid_window: "backend.displayInvalidWindow",
  export_task_failed: "backend.exportTaskFailed",
  export_cancelled: "backend.exportCancelled",
  backend_operation_failed: "backend.operationFailed",
  export_snapshot_stale: "backend.exportSnapshotStale",
  export_overwrites_source: "backend.exportOverwritesSource",
  export_invalid_crop: "backend.exportInvalidCrop",
  export_crop_outside: "backend.exportCropOutside",
  export_invalid_depth: "backend.exportInvalidDepth",
  export_packing_depth: "backend.exportPackingDepth",
  export_quad_required: "backend.exportQuadRequired",
  export_mono_demosaic: "backend.exportMonoDemosaic",
  export_invalid_alignment: "backend.exportInvalidAlignment",
  capture_invalid_png: "backend.captureInvalidPng",
  capture_overwrites_source: "backend.captureOverwritesSource",
  capture_save_failed: "backend.captureSaveFailed",
};

function parseBackendError(error: unknown): BackendError | null {
  if (typeof error === "object" && error !== null) {
    const value = error as Partial<BackendError>;
    if (typeof value.code === "string") return value as BackendError;
  }
  if (typeof error === "string") {
    const source = error.replace(/^Error:\s*/, "").trim();
    try {
      const parsed = JSON.parse(source) as unknown;
      return parseBackendError(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

export function backendErrorCode(error: unknown): string | null {
  return parseBackendError(error)?.code ?? null;
}

export function localizeBackendError(error: unknown): { code?: string; field?: string; message: string } {
  const backend = parseBackendError(error);
  if (!backend) {
    const raw = String(error).replace(/^Error:\s*/, "").trim();
    return { message: raw || t("backend.operationFailed") };
  }
  if (backend.code === "export_reorder_boundary") {
    const edges = (["left", "right", "top", "bottom"] as const).filter((edge) => backend.arguments?.[edge] === true);
    return { code: backend.code, message: localizeReorderBoundary(edges) };
  }
  const key = ERROR_MESSAGES[backend.code] ?? "backend.operationFailed";
  const message = t(key, backend.arguments ?? {});
  const safeCause = backend.cause?.trim();
  return {
    code: backend.code,
    field: backend.field ?? undefined,
    message: safeCause && !/\p{Script=Han}/u.test(safeCause)
      ? `${message}: ${safeCause}`
      : message,
  };
}
