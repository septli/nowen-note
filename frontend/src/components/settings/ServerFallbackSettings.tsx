import { useEffect, useState } from "react";
import { getServerUrl, getFallbackServerUrl, setFallbackServerUrl, setServerUrl } from "@/lib/api";

/**
 * 服务器双地址设置：主地址（当前生效）+ 备用地址。
 * 用途：家里填局域网、外出填 Tailscale；主地址探测不通时启动会自动切到备用。
 * 主地址沿用当前连接地址，这里只允许修改备用地址，避免误改把当前会话打断。
 */
export default function ServerFallbackSettings() {
  const [primary, setPrimary] = useState("");
  const [fallback, setFallback] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const readPrimary = () => {
    // 桌面端 getServerUrl() 可能是内置后端的 127.0.0.1:xxxxx，
    // 这里优先取「上次连接的服务器地址」，没有再退回 getServerUrl()。
    try {
      const last = localStorage.getItem("nowen-server-url-last") || "";
      if (/^https?:\/\//i.test(last)) return last;
    } catch { /* ignore */ }
    return getServerUrl();
  };

  useEffect(() => {
    setPrimary(readPrimary());
    setFallback(getFallbackServerUrl());
  }, []);

  const normalize = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  };

  const handleSave = () => {
    setError("");
    setNotice("");
    const next = normalize(fallback);
    if (next && !/^https?:\/\/[^\s/]+/i.test(next)) {
      setError("备用地址格式不对，需要形如 http://host:port 或 https://host");
      return;
    }
    setFallbackServerUrl(next);
    setFallback(next);
    setNotice(next ? "已保存，主地址不通时会自动切到这个地址" : "已清除备用地址");
  };

  return (
    <section className="space-y-3 rounded-lg border border-app-border bg-app-surface p-4">
      <div>
        <h3 className="text-sm font-medium text-tx-primary">服务器地址</h3>
        <p className="mt-1 text-xs text-tx-secondary">
          主地址不通时自动切到备用地址。主地址填局域网、备用填 Tailscale，出门在家都不用改设置。
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-tx-secondary">主地址（当前生效）</label>
        <div className="break-all rounded-lg border border-app-border bg-app-hover/40 px-3 py-2 text-sm text-tx-primary">
          {primary || "未设置"}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-tx-secondary" htmlFor="nowen-fallback-server">
          备用地址（可选）
        </label>
        <input
          id="nowen-fallback-server"
          type="text"
          value={fallback}
          onChange={(event) => { setFallback(event.target.value); setNotice(""); setError(""); }}
          placeholder="https://your-server.your-tailnet.ts.net:3001"
          className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-tx-primary outline-none focus:ring-2 focus:ring-accent-primary"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-tx-secondary">
          支持 http:// 或 https://。留空表示不启用自动切换。
        </p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {notice && <p className="text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          保存
        </button>
        <button
          type="button"
          onClick={() => { setFallback(""); setFallbackServerUrl(""); setNotice("已清除备用地址"); setError(""); }}
          className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-tx-secondary hover:bg-app-hover"
        >
          清除
        </button>
        <button
          type="button"
          onClick={() => { setPrimary(readPrimary()); setFallback(getFallbackServerUrl()); setNotice(""); setError(""); }}
          className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-tx-secondary hover:bg-app-hover"
        >
          刷新
        </button>
      </div>
    </section>
  );
}
