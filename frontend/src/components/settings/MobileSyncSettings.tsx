import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { connectSyncServer, disableSync, fetchSyncDiagnostics, fetchSyncSettings, triggerSyncNow, type SyncDiagnostics, type SyncSettingsResponse } from "@/lib/syncLocalApi";
import { getServerUrl, getFallbackServerUrl, setFallbackServerUrl } from "@/lib/api";
import { isMobileLocalMode, requestMobileAccountLogin } from "@/lib/mobileLocalMode";
import { OfflineAvailability } from "./OfflineAvailability";

export default function MobileSyncSettings() {
  const { t, i18n } = useTranslation();
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics | null>(null);
  const [settings, setSettings] = useState<SyncSettingsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState(() => getFallbackServerUrl());
  const syncEnabled = settings?.mode === "server";
  const reload = useCallback(async () => {
    try {
      const next = await fetchSyncSettings();
      setSettings(next);
      setDiagnostics(await fetchSyncDiagnostics());
      setError(null);
    } catch {
      setError("mobileSync.settingsReadFailed");
    }
  }, []);
  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => { void reload(); }, 5000);
    return () => window.clearInterval(timer);
  }, [reload]);
  const changeMode = async (enabled: boolean) => {
    if (enabled && (isMobileLocalMode() || !settings?.authorized)) {
      requestMobileAccountLogin();
      window.location.reload();
      return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      if (enabled) {
        const primary = settings?.profiles[0]?.serverUrl || getServerUrl();
        const fallback = fallbackUrl.trim();
        try {
          await connectSyncServer({ serverUrl: primary });
        } catch (primaryErr) {
          if (!fallback || fallback === primary) throw primaryErr;
          await connectSyncServer({ serverUrl: fallback });
          setNotice(`主地址连接失败，已改用备用地址 ${fallback}`);
        }
      } else {
        await disableSync();
      }
      await reload();
    } catch {
      setError("mobileSync.settingsChangeFailed");
    } finally { setBusy(false); }
  };
  const saveFallback = () => {
    setFallbackServerUrl(fallbackUrl.trim());
    setNotice(fallbackUrl.trim() ? "备用地址已保存" : "备用地址已清空");
  };
  return <div className="space-y-4">
    <section className="space-y-3">
      <h3 className="text-sm font-medium">{t("mobileSync.title")}</h3>
      {settings ? <>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-app-border p-4">
          <input type="radio" name="mobile-sync-mode" className="mt-1" checked={!syncEnabled} disabled={busy}
            onChange={() => { void changeMode(false); }} />
          <span className="space-y-1">
            <span className="block text-sm font-medium">{t("mobileSync.deviceOnly")}</span>
            <span className="block text-xs text-tx-tertiary">{t("mobileSync.deviceOnlyHint")}</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-app-border p-4">
          <input type="radio" name="mobile-sync-mode" className="mt-1" checked={syncEnabled} disabled={busy}
            onChange={() => { void changeMode(true); }} />
          <span className="space-y-1">
            <span className="block text-sm font-medium">{t("mobileSync.ownServer")}</span>
            <span className="block text-xs text-tx-tertiary">{t("mobileSync.ownServerHint")}</span>
            {syncEnabled && <span className="block text-xs text-tx-secondary">{t("mobileSync.connected", { url: settings.activeProfile?.serverUrl || "" })}</span>}
          </span>
        </label>
        <div className="space-y-2 rounded-lg border border-app-border p-4">
          <span className="block text-sm font-medium">备用地址（可选）</span>
          <input
            type="url"
            value={fallbackUrl}
            onChange={(event) => setFallbackUrl(event.target.value)}
            placeholder="留空则不启用"
            disabled={busy}
            className="w-full rounded border border-app-border bg-transparent px-3 py-2 text-sm"
          />
          <p className="text-xs text-tx-tertiary">主地址不通时自动切换；留空表示不启用。</p>
          <button type="button" onClick={saveFallback} disabled={busy}
            className="rounded-md border border-app-border px-3 py-2 text-sm disabled:opacity-50">
            保存备用地址
          </button>
        </div>
        <p className="text-xs text-tx-tertiary">{t("mobileSync.devicesHint")}</p>
      </> : <p className="text-sm text-tx-tertiary">{error ? t(error) : t("mobileSync.loadingSettings")}</p>}
      {notice && <p className="text-xs text-tx-secondary">{notice}</p>}
    </section>
    <OfflineAvailability offline={diagnostics?.offline} />
    {settings?.authorizationState === "expired" && <div className="space-y-2 text-xs">
      <p>{t("offlineAvailability.authExpired")}</p>
      <button type="button" className="rounded border px-3 py-2" onClick={() => { requestMobileAccountLogin(); window.location.reload(); }}>{t("auth.loginButton")}</button>
    </div>}
    {syncEnabled &&
    <section className="space-y-3 rounded-lg border border-app-border p-4">
      <h3 className="text-sm font-medium">{t("mobileSync.statusTitle")}</h3>
      <p className="text-sm text-tx-secondary">{diagnostics?.lastError ? t("mobileSync.waitingRecovery") : diagnostics ? t("mobileSync.enabled") : t("mobileSync.loadingStatus")}</p>
        <p className="text-xs text-tx-tertiary">{t("mobileSync.pendingChanges", { pending: diagnostics?.pendingMutations ?? "—" })}</p>
        <p className="text-xs text-tx-tertiary">{t("mobileSync.pendingAttachments", { pending: diagnostics?.pendingAttachments ?? "—" })}</p>
        <p className="text-xs text-tx-tertiary">{t("mobileSync.lastSync", { time: diagnostics?.lastSyncAt ? new Date(diagnostics.lastSyncAt).toLocaleString(i18n.language) : t("mobileSync.neverSynced") })}</p>
        <button type="button" disabled={busy} className="rounded-md border border-app-border px-3 py-2 text-sm disabled:opacity-50" onClick={async () => {
          setBusy(true);
          try { await triggerSyncNow(); await reload(); }
          catch { setError("mobileSync.startFailed"); }
          finally { setBusy(false); }
        }}>{busy ? t("mobileSync.requestingSync") : t("mobileSync.syncNow")}</button>
    </section>}
    {settings && error && <p className="text-xs text-tx-tertiary">{t(error)}</p>}
  </div>;
}
