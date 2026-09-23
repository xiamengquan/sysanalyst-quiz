import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_VERSION } from "@/lib/site-version";

export default function AboutPage() {
  return (
    <>
      <h1 className="page-title">关于</h1>
      <p className="page-lead">功能一览 · 合规 · 部署</p>

      <div className="stack-loose">
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 text-[0.92rem] leading-relaxed">
            <b className="text-[var(--warn)]">合规声明</b>：本站仅供<strong>个人学习</strong>
            。真题及解析请勿对外传播、商用或二次发布。
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[1.05rem] font-medium">本站是什么</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[0.92rem] leading-relaxed text-muted-foreground">
            <p>
              面向软考<strong>系统分析师</strong>的备考站点：选择题、案例分析、知识点精炼同源入库，Next.js
              静态导出，可部署到 EdgeOne 等静态托管。默认进度只存在你的浏览器里。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[1.05rem] font-medium">功能一览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-[0.92rem] leading-relaxed text-muted-foreground">
            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">刷题（综合知识）</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>自编练习、真题卷、出题工坊题源可筛选切换</li>
                <li>按章节 / 难度等过滤，支持连续作答与本机进度恢复</li>
                <li>作答后可看解析；可打开本题相关知识点抽屉（可固钉到侧栏）</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">案例分析</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>自编练习卡 + 真题包；五选三模拟包按「试题一必答、其余选两题」演练</li>
                <li>三问文本作答、本机草稿；可对照参考要点（不做自动判分）</li>
                <li>「七步法」选项卡：按答题教程拆解本题怎么做、为什么</li>
                <li>可打开相关知识点抽屉辅助回忆</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">知识点</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>正式精炼目录按篇章节浏览，站内直接阅读 Markdown 正文</li>
                <li>顶栏全局搜索（Ctrl/⌘K）：导航快捷入口 + 知识点检索</li>
                <li>正文页快速索引；可从知识点跳到对应章节刷题</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">账户与同步（可选）</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>邮箱密码注册/登录，或 Magic Link 无密码登录</li>
                <li>默认仍只写 IndexedDB；登录后<strong>显式开启云同步</strong>才上传刷题进度与案例草稿</li>
                <li>冲突按时间戳 Last-Write-Wins；支持立即同步</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">界面与主题</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>界面参照 Cursor.com 极简现代设计语言，自研纯粹轻量组件体系，移除繁重 shadcn 依赖</li>
                <li>浅色 / 深色 / 跟随系统，默认深色，本机记忆偏好</li>
                <li>
                  <a className="text-primary underline" href="/changelog/">
                    更新日志
                  </a>
                  ：历次发版要点；新版本首次打开会弹窗提示
                </li>
                <li>数字等宽显示，题号与进度对齐更稳</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[1.05rem] font-medium">数据来源</CardTitle>
          </CardHeader>
          <CardContent className="text-[0.92rem] leading-relaxed text-muted-foreground">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                源内容：<code>content/</code>（知识点、题库 JSONL、案例 MD、工坊新题）
              </li>
              <li>
                构建：<code>npm run sync:all</code> → <code>public/data/*.json</code> + <code>public/kb/**</code>
              </li>
              <li>工坊文档：<code>docs/kb-workshop</code> · <code>docs/question-workshop</code> · <code>docs/web-team</code></li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[1.05rem] font-medium">访问与部署</CardTitle>
          </CardHeader>
          <CardContent className="text-[0.92rem] leading-relaxed text-muted-foreground">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                代码仓库：
                <a
                  className="text-primary underline"
                  href="https://github.com/xiamengquan/sysanalyst-quiz"
                  target="_blank"
                  rel="noreferrer"
                >
                  github.com/xiamengquan/sysanalyst-quiz
                </a>
              </li>
              <li>EdgeOne Makers：导入仓库 → <code>npm run build</code> → 输出 <code>out/</code>；push <code>main</code> 自动构建</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[1.05rem] font-medium">版本</CardTitle>
          </CardHeader>
          <CardContent className="text-[0.92rem] leading-relaxed text-muted-foreground">
            <p>
              当前 v{SITE_VERSION} · Next.js 15 · Cursor-inspired Design · 完整变更见{" "}
              <a className="text-primary underline" href="/changelog/">
                更新日志
              </a>
              。
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
