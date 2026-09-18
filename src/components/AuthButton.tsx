"use client";

import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useId, useState } from "react";
import { Modal } from "@/components/portal";
import {
  isCloudSyncEnabled,
  pullAndApplyProgress,
  pushProgressNow,
  setCloudSyncEnabled,
} from "@/lib/cloud-sync";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "syncing" | "error";

function shortEmail(email: string | undefined) {
  if (!email) return "已登录";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  if (name.length <= 4) return email;
  return `${name.slice(0, 2)}…@${domain}`;
}

async function applyPull(reloadIfCloud: boolean): Promise<string> {
  const decision = await pullAndApplyProgress();
  if (decision === "cloud") {
    if (reloadIfCloud) {
      window.location.reload();
      return "已从云端恢复进度…";
    }
    return "已从云端写入本机，刷新后生效";
  }
  if (decision === "local") return "本机较新，已上传云端";
  if (decision === "equal") return "本机与云端一致";
  return "未同步（需登录并开启云同步）";
}

export function AuthButton() {
  const titleId = useId();
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncOn, setSyncOn] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const refreshSyncFlag = useCallback(async () => {
    setSyncOn(await isCloudSyncEnabled());
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigured(false);
      setReady(true);
      return;
    }
    setConfigured(true);
    const sb = getSupabase();
    if (!sb) {
      setReady(true);
      return;
    }

    let unsub = () => undefined;

    void (async () => {
      const { data } = await sb.auth.getSession();
      setUser(data.session?.user ?? null);
      await refreshSyncFlag();
      setReady(true);

      if (data.session?.user && (await isCloudSyncEnabled())) {
        try {
          await applyPull(true);
        } catch {
          /* ignore boot pull errors */
        }
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ?? null);
      void refreshSyncFlag();
    });
    unsub = () => {
      sub.subscription.unsubscribe();
    };

    return () => unsub();
  }, [refreshSyncFlag]);

  if (!ready || !configured) return null;

  const closeLogin = () => {
    setLoginOpen(false);
    setStatus("idle");
    setMessage("");
  };

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setStatus("error");
      setMessage("请输入有效邮箱");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;

    setStatus("sending");
    setMessage("");
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;
    const { error } = await sb.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message || "发送失败");
      return;
    }
    setStatus("sent");
    setMessage("邮件已发送，请点击链接完成登录");
  };

  const toggleSync = async (next: boolean) => {
    setStatus("syncing");
    setMessage("");
    try {
      await setCloudSyncEnabled(next);
      setSyncOn(next);
      if (next) {
        const msg = await applyPull(true);
        setMessage(msg);
      } else {
        setMessage("已关闭云同步（本机进度仍保留）");
      }
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "同步失败");
    }
  };

  const syncNow = async () => {
    setStatus("syncing");
    setMessage("");
    try {
      if (!syncOn) {
        setStatus("error");
        setMessage("请先开启云同步");
        return;
      }
      const pulled = await applyPull(false);
      const pushed = await pushProgressNow();
      setMessage(pushed ? `${pulled}；已推送本机` : pulled);
      setStatus("idle");
      if (pulled.includes("云端写入")) {
        window.location.reload();
      }
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "同步失败");
    }
  };

  const signOut = async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    setPanelOpen(false);
    setMessage("");
  };

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="rounded-full border border-[var(--line)] px-3 py-2 text-[0.82rem] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
        >
          登录
        </button>
        <Modal open={loginOpen} onClose={closeLogin} labelledBy={titleId}>
          <div className="flex flex-col gap-3 p-1">
            <h2 id={titleId} className="text-[1.05rem] font-semibold text-[var(--text)]">
              邮箱登录
            </h2>
            <p className="text-[0.85rem] leading-relaxed text-[var(--muted)]">
              使用 Magic Link，无需密码。默认只存本机；登录后可自行开启云同步。
            </p>
            <label className="flex flex-col gap-1.5 text-[0.82rem] text-[var(--muted)]">
              邮箱
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendMagicLink();
                }}
                placeholder="you@example.com"
                className="rounded-lg border border-[var(--line)] bg-[color-mix(in_srgb,var(--panel)_80%,#0a0e12)] px-3 py-2.5 text-[0.95rem] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            {message ? (
              <p
                className={`text-[0.82rem] ${status === "error" ? "text-red-400" : "text-[var(--muted)]"}`}
                role="status"
              >
                {message}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeLogin}
                className="rounded-full border border-[var(--line)] px-3.5 py-2 text-[0.85rem] text-[var(--muted)]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void sendMagicLink()}
                disabled={status === "sending"}
                className="rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-3.5 py-2 text-[0.85rem] text-[var(--accent)] disabled:opacity-60"
              >
                {status === "sending" ? "发送中…" : status === "sent" ? "已发送" : "发送链接"}
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="max-w-[9.5rem] truncate rounded-full border border-[var(--line)] px-3 py-2 text-[0.78rem] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
        title={user.email || "账户"}
      >
        {shortEmail(user.email)}
      </button>
      <Modal open={panelOpen} onClose={() => setPanelOpen(false)} labelledBy={titleId}>
        <div className="flex flex-col gap-3 p-1">
          <h2 id={titleId} className="text-[1.05rem] font-semibold text-[var(--text)]">
            账户与同步
          </h2>
          <p className="break-all text-[0.85rem] text-[var(--muted)]">{user.email}</p>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5 text-[0.88rem] text-[var(--text)]">
            <span>
              云同步
              <span className="mt-0.5 block text-[0.75rem] text-[var(--muted)]">
                开启后上传刷题进度与案例草稿
              </span>
            </span>
            <input
              type="checkbox"
              checked={syncOn}
              onChange={(e) => void toggleSync(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>

          {message ? (
            <p
              className={`text-[0.82rem] ${status === "error" ? "text-red-400" : "text-[var(--muted)]"}`}
              role="status"
            >
              {message}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={status === "syncing" || !syncOn}
              className="rounded-full border border-[var(--line)] px-3.5 py-2 text-[0.85rem] text-[var(--muted)] disabled:opacity-50"
            >
              {status === "syncing" ? "同步中…" : "立即同步"}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border border-[var(--line)] px-3.5 py-2 text-[0.85rem] text-[var(--muted)] hover:text-[var(--text)]"
            >
              退出
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
