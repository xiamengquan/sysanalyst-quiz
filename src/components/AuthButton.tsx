"use client";

import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import {
  isCloudSyncEnabled,
  pullAndApplyProgress,
  pushProgressNow,
  setCloudSyncEnabled,
} from "@/lib/cloud-sync";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Status = "idle" | "busy" | "sent" | "syncing" | "error";
type AuthMode = "password" | "register" | "magic";

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
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncOn, setSyncOn] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    void (async () => {
      const { data } = await sb.auth.getSession();
      setUser(data.session?.user ?? null);
      await refreshSyncFlag();
      setReady(true);
      if (data.session?.user && (await isCloudSyncEnabled())) {
        try {
          await applyPull(true);
        } catch {
          /* ignore */
        }
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ?? null);
      void refreshSyncFlag();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshSyncFlag]);

  if (!ready || !configured) return null;

  const closeLogin = () => {
    setLoginOpen(false);
    setStatus("idle");
    setMessage("");
    setPassword("");
  };

  const validateEmail = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setStatus("error");
      setMessage("请输入有效邮箱");
      return null;
    }
    return trimmed;
  };

  const signInPassword = async () => {
    const trimmed = validateEmail();
    if (!trimmed) return;
    if (password.length < 6) {
      setStatus("error");
      setMessage("密码至少 6 位");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setStatus("busy");
    setMessage("");
    const { error } = await sb.auth.signInWithPassword({ email: trimmed, password });
    if (error) {
      setStatus("error");
      setMessage(error.message || "登录失败");
      return;
    }
    closeLogin();
  };

  const signUpPassword = async () => {
    const trimmed = validateEmail();
    if (!trimmed) return;
    if (password.length < 6) {
      setStatus("error");
      setMessage("密码至少 6 位");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setStatus("busy");
    setMessage("");
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined;
    const { data, error } = await sb.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message || "注册失败");
      return;
    }
    if (data.session) {
      closeLogin();
      return;
    }
    setStatus("sent");
    setMessage("注册成功。若已开启邮箱确认，请查收邮件后再登录；否则可直接用密码登录。");
  };

  const sendMagicLink = async () => {
    const trimmed = validateEmail();
    if (!trimmed) return;
    const sb = getSupabase();
    if (!sb) return;
    setStatus("busy");
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

  const submitLogin = () => {
    if (mode === "password") void signInPassword();
    else if (mode === "register") void signUpPassword();
    else void sendMagicLink();
  };

  const toggleSync = async (next: boolean) => {
    setStatus("syncing");
    setMessage("");
    try {
      await setCloudSyncEnabled(next);
      setSyncOn(next);
      setMessage(next ? await applyPull(true) : "已关闭云同步（本机进度仍保留）");
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
      if (pulled.includes("云端写入")) window.location.reload();
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
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setLoginOpen(true)}>
          登录
        </Button>
        <Dialog open={loginOpen} onOpenChange={(v) => (!v ? closeLogin() : setLoginOpen(true))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>登录账户</DialogTitle>
              <DialogDescription>
                默认进度只存本机；登录后可自行开启云同步。支持密码或 Magic Link。
              </DialogDescription>
            </DialogHeader>
            <Tabs
              value={mode}
              onValueChange={(v) => {
                setMode(v as AuthMode);
                setStatus("idle");
                setMessage("");
              }}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="password">密码登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
                <TabsTrigger value="magic">Magic Link</TabsTrigger>
              </TabsList>
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="auth-email">邮箱</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                    placeholder="you@example.com"
                  />
                </div>
                <TabsContent value="password" className="mt-0 space-y-2">
                  <Label htmlFor="auth-password">密码</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                    placeholder="至少 6 位"
                  />
                </TabsContent>
                <TabsContent value="register" className="mt-0 space-y-2">
                  <Label htmlFor="auth-password-new">密码</Label>
                  <Input
                    id="auth-password-new"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                    placeholder="至少 6 位"
                  />
                </TabsContent>
                <TabsContent value="magic" className="mt-0 text-sm text-muted-foreground">
                  将向邮箱发送登录链接，无需密码。
                </TabsContent>
              </div>
            </Tabs>
            {message ? (
              <p className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`} role="status">
                {message}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={closeLogin}>
                取消
              </Button>
              <Button onClick={submitLogin} disabled={status === "busy"}>
                {status === "busy"
                  ? "请稍候…"
                  : mode === "password"
                    ? "登录"
                    : mode === "register"
                      ? "注册"
                      : status === "sent"
                        ? "已发送"
                        : "发送链接"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="max-w-[9.5rem] truncate rounded-full"
        onClick={() => setPanelOpen(true)}
        title={user.email || "账户"}
      >
        {shortEmail(user.email)}
      </Button>
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>账户与同步</DialogTitle>
            <DialogDescription className="break-all">{user.email}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
            <div>
              <div className="text-sm font-medium">云同步</div>
              <p className="text-xs text-muted-foreground">开启后上传刷题进度与案例草稿</p>
            </div>
            <Switch checked={syncOn} onCheckedChange={(v) => void toggleSync(v)} />
          </div>
          {message ? (
            <p className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`} role="status">
              {message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => void syncNow()} disabled={status === "syncing" || !syncOn}>
              {status === "syncing" ? "同步中…" : "立即同步"}
            </Button>
            <Button variant="secondary" onClick={() => void signOut()}>
              退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
