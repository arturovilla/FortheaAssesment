"use client";

// JSON upload UI — implements the four-step async ingest flow from the
// backend (Part 2 §2.2):
//
//   1. POST /uploads/initiate         → { upload_id, presigned_url }
//   2. PUT  {presigned_url}           bytes → 204
//   3. POST /uploads/{id}/commit      → 202 { status: "processing" }
//   4. GET  /uploads/{id}             poll until succeeded | failed
//
// Step 2 hits the backend's PUT /uploads/{id}/blob in local dev (the
// "filesystem storage" backend can't issue real out-of-band URLs); in prod
// the URL is a real Azure Blob SAS and would skip the Authorization header.
// We always send the header for now — harmless on the backend route, and a
// future prod swap can branch on URL origin if needed.
//
// On success we invalidate performance / anomalies / clients queries so the
// dashboard repaints with the new data without a manual refresh.

import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, FileJson, Upload, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  type CommitResponse,
  type InitiateResponse,
  type UploadStatusResponse,
  type UploadType,
} from "@/lib/api";
import { useActiveTenant } from "@/lib/use-active-tenant";

// =============================================================================
// Types + constants
// =============================================================================

interface TypeOption {
  value: UploadType;
  label: string;
  hint: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { value: "google_ads", label: "Google Ads", hint: "stg_google_ads rows" },
  { value: "meta", label: "Meta", hint: "stg_meta_ads rows" },
  { value: "clients", label: "Clients", hint: "dim_client rows" },
];

// State machine for the upload lifecycle. `idle` covers both the initial
// form and the after-failure retry state.
type Phase =
  | { kind: "idle" }
  | { kind: "initiating" }
  | { kind: "uploading" }
  | { kind: "committing" }
  | { kind: "polling"; attempts: number }
  | { kind: "succeeded"; final: UploadStatusResponse }
  | { kind: "failed"; message: string };

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_ATTEMPTS = 60; // ~60s ceiling on background worker time

// =============================================================================
// Button (the entry point exported to the dashboard page)
// =============================================================================

export function UploadData() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-ctp-surface0/60 bg-ctp-base/60 px-3 py-1.5 text-sm font-medium text-ctp-text transition-colors duration-150 hover:bg-ctp-surface0/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40"
      >
        <Upload className="h-4 w-4 text-ctp-subtext0" />
        Upload data
      </button>
      {open ? <UploadDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// =============================================================================
// Dialog
// =============================================================================

function UploadDialog({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<UploadType>("google_ads");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getToken } = useAuth();
  const { active } = useActiveTenant();
  const queryClient = useQueryClient();

  // Close on Escape — but not while the upload is mid-flight.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (canDismiss(phase)) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  const run = useCallback(async () => {
    if (!file) return;

    try {
      // ----- Step 1: initiate -----------------------------------------------
      setPhase({ kind: "initiating" });
      const token = await getToken({ template: "forthea" });
      if (!token) throw new ApiError("Not signed in", 401);

      const initRes = await fetchJson<InitiateResponse>({
        url: `${apiBase()}/uploads/initiate`,
        method: "POST",
        token,
        tenant: active,
        body: JSON.stringify({ type }),
      });

      // ----- Step 2: PUT bytes ---------------------------------------------
      setPhase({ kind: "uploading" });
      const putRes = await fetch(initRes.presigned_url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(active ? { "X-Active-Tenant": active } : {}),
          "Content-Type": "application/octet-stream",
        },
        body: file,
      });
      if (!putRes.ok) {
        throw new ApiError(
          `Upload to blob failed (${putRes.status})`,
          putRes.status,
        );
      }

      // ----- Step 3: commit ------------------------------------------------
      setPhase({ kind: "committing" });
      await fetchJson<CommitResponse>({
        url: `${apiBase()}/uploads/${initRes.upload_id}/commit`,
        method: "POST",
        token,
        tenant: active,
      });

      // ----- Step 4: poll --------------------------------------------------
      let attempts = 0;
      while (attempts < POLL_MAX_ATTEMPTS) {
        attempts += 1;
        setPhase({ kind: "polling", attempts });
        await sleep(POLL_INTERVAL_MS);
        const status = await fetchJson<UploadStatusResponse>({
          url: `${apiBase()}/uploads/${initRes.upload_id}`,
          method: "GET",
          token,
          tenant: active,
        });
        if (status.status === "succeeded") {
          setPhase({ kind: "succeeded", final: status });
          // Refresh every panel that reads the marts. The TanStack keys are
          // prefix-based so we hit performance/anomalies/clients in one go.
          queryClient.invalidateQueries({ queryKey: ["performance"] });
          queryClient.invalidateQueries({ queryKey: ["anomalies"] });
          queryClient.invalidateQueries({ queryKey: ["clients"] });
          return;
        }
        if (status.status === "failed") {
          setPhase({ kind: "failed", message: status.error ?? "Upload failed." });
          return;
        }
      }
      setPhase({ kind: "failed", message: "Upload still processing after 60s — check the server." });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase({ kind: "failed", message });
    }
  }, [file, type, getToken, active, queryClient]);

  function reset() {
    setPhase({ kind: "idle" });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload data"
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ctp-crust/70 backdrop-blur-sm"
        onClick={() => {
          if (canDismiss(phase)) onClose();
        }}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-ctp-surface0/80 bg-ctp-mantle p-5 shadow-2xl shadow-black/60">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ctp-text">Upload data</h2>
            <p className="mt-0.5 text-xs text-ctp-subtext0">
              JSON file matching the schema for the selected type. Server validates each record;
              tenant_id is bound from your active tenant.
            </p>
          </div>
          {canDismiss(phase) ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-ctp-subtext0 transition-colors hover:bg-ctp-surface0/60 hover:text-ctp-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        {phase.kind === "succeeded" ? (
          <SuccessState final={phase.final} onClose={onClose} />
        ) : phase.kind === "failed" ? (
          <FailureState message={phase.message} onRetry={reset} onClose={onClose} />
        ) : phase.kind === "idle" ? (
          <IdleForm
            type={type}
            onTypeChange={setType}
            file={file}
            onFileChange={setFile}
            fileInputRef={fileInputRef}
            onSubmit={run}
            onCancel={onClose}
          />
        ) : (
          <ProgressState phase={phase} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-views (one per dialog state)
// =============================================================================

function IdleForm({
  type,
  onTypeChange,
  file,
  onFileChange,
  fileInputRef,
  onSubmit,
  onCancel,
}: {
  type: UploadType;
  onTypeChange: (t: UploadType) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (file) onSubmit();
      }}
      className="space-y-4"
    >
      <div>
        <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
          Type
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((opt) => {
            const active = type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTypeChange(opt.value)}
                title={opt.hint}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40 ${
                  active
                    ? "border-ctp-blue/50 bg-ctp-blue/10 text-ctp-blue"
                    : "border-ctp-surface0/60 bg-ctp-base/60 text-ctp-subtext1 hover:bg-ctp-surface0/40 hover:text-ctp-text"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">
          File
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-ctp-surface0/80 bg-ctp-base/40 px-4 py-3 text-left text-sm text-ctp-subtext1 transition-colors duration-150 hover:border-ctp-overlay0/60 hover:bg-ctp-base/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-overlay0/40"
        >
          <FileJson className="h-4 w-4 flex-shrink-0 text-ctp-subtext0" />
          {file ? (
            <span className="flex-1 truncate">
              <span className="text-ctp-text">{file.name}</span>
              <span className="ml-2 text-xs text-ctp-subtext0">{formatBytes(file.size)}</span>
            </span>
          ) : (
            <span className="flex-1">Choose a JSON file…</span>
          )}
        </button>
      </div>

      <footer className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-ctp-subtext1 transition-colors hover:bg-ctp-surface0/60 hover:text-ctp-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!file}
          className="inline-flex items-center gap-1.5 rounded-md border border-ctp-blue/50 bg-ctp-blue/15 px-3 py-1.5 text-sm font-medium text-ctp-blue transition-colors hover:bg-ctp-blue/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ctp-blue/15"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
      </footer>
    </form>
  );
}

function ProgressState({ phase }: { phase: Phase }) {
  const steps: { key: Phase["kind"]; label: string }[] = [
    { key: "initiating", label: "Reserving upload" },
    { key: "uploading", label: "Uploading file bytes" },
    { key: "committing", label: "Triggering server processing" },
    { key: "polling", label: "Validating records" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === phase.kind);

  return (
    <div className="space-y-2.5">
      {steps.map((step, idx) => {
        const status: "done" | "active" | "pending" =
          idx < currentIdx ? "done" : idx === currentIdx ? "active" : "pending";
        return (
          <div key={step.key} className="flex items-center gap-3 text-sm">
            <StepDot status={status} />
            <span
              className={
                status === "done"
                  ? "text-ctp-subtext1"
                  : status === "active"
                    ? "text-ctp-text"
                    : "text-ctp-subtext0"
              }
            >
              {step.label}
              {step.key === "polling" && phase.kind === "polling" ? (
                <span className="ml-2 font-mono text-xs text-ctp-subtext0">
                  (attempt {phase.attempts})
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SuccessState({
  final,
  onClose,
}: {
  final: UploadStatusResponse;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-ctp-green/30 bg-ctp-green/5 p-3">
        <CheckCircle2 className="h-5 w-5 text-ctp-green" />
        <div>
          <div className="text-sm font-medium text-ctp-green">Upload succeeded</div>
          <div className="text-xs text-ctp-subtext0">
            type: <span className="font-mono">{final.type}</span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Accepted" value={final.accepted?.toLocaleString() ?? "—"} tone="good" />
        <Stat
          label="Rejected"
          value={final.rejected?.toLocaleString() ?? "—"}
          tone={final.rejected && final.rejected > 0 ? "warn" : "neutral"}
        />
      </dl>

      <footer className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-ctp-surface0/60 bg-ctp-base/60 px-3 py-1.5 text-sm text-ctp-text transition-colors hover:bg-ctp-surface0/60"
        >
          Done
        </button>
      </footer>
    </div>
  );
}

function FailureState({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-ctp-red/30 bg-ctp-red/5 p-3">
        <XCircle className="h-5 w-5 flex-shrink-0 text-ctp-red" />
        <div>
          <div className="text-sm font-medium text-ctp-red">Upload failed</div>
          <div className="mt-1 break-words text-xs text-ctp-red/80">{message}</div>
        </div>
      </div>
      <footer className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-ctp-subtext1 transition-colors hover:bg-ctp-surface0/60 hover:text-ctp-text"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-ctp-blue/50 bg-ctp-blue/15 px-3 py-1.5 text-sm font-medium text-ctp-blue transition-colors hover:bg-ctp-blue/25"
        >
          Try again
        </button>
      </footer>
    </div>
  );
}

// =============================================================================
// Bits
// =============================================================================

function StepDot({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ctp-green/15 text-ctp-green">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "active") {
    return <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ctp-blue" />;
  }
  return <span className="h-2.5 w-2.5 rounded-full border border-ctp-surface0" />;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  const valueClass =
    tone === "good" ? "text-ctp-green" : tone === "warn" ? "text-ctp-peach" : "text-ctp-text";
  return (
    <div className="rounded-md border border-ctp-surface0/60 bg-ctp-base/60 p-3">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-ctp-subtext0">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}

// =============================================================================
// HTTP helper — apiFetch is GET-only; uploads need POST/PUT and a different
// URL for the blob PUT, so we inline a small fetch wrapper here.
// =============================================================================

interface FetchJsonArgs {
  url: string;
  method: "GET" | "POST";
  token: string;
  tenant?: string | null;
  body?: string;
}

async function fetchJson<T>({ url, method, token, tenant, body }: FetchJsonArgs): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(tenant ? { "X-Active-Tenant": tenant } : {}),
    },
    body,
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const json = await res.json();
      if (typeof json?.detail === "string") detail = json.detail;
      else if (json?.detail) detail = JSON.stringify(json.detail);
    } catch {
      // not JSON
    }
    throw new ApiError(detail ?? `${res.status} ${res.statusText}`, res.status, detail);
  }
  return res.json() as Promise<T>;
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canDismiss(phase: Phase): boolean {
  return phase.kind === "idle" || phase.kind === "succeeded" || phase.kind === "failed";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}
