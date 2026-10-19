import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_VERSION } from "@/lib/site-version";

export default function AboutPage() {
  return (
    <>
      <h1 className="page-title">关于</h1>
      <p className="page-lead">功能一览 · 合规 · 部署</p>

      <div className="stack-loose">
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="text-[0.92rem] leading-relaxed">
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
              面向软考<strong>系统分析师 · 下午一案例分析</strong>的纯阅读知识站：只学考点、背套路，
              不提供任何作答与判分交互（答题实练请前往外部真题站点）。Next.js 静态导出，可部署到
              EdgeOne 等静态托管。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[1.05rem] font-medium">功能一览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-[0.92rem] leading-relaxed text-muted-foreground">
            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">案例考点库</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>145 篇案例相关考点精炼（一考点一篇），非案例考点已按 2026-10 决策下线</li>
                <li>每考点标注案例出题区映射（caseDomains）与历年案例频次（caseFreq）</li>
                <li>按篇章节浏览，站内直接阅读 Markdown 正文，支持抽屉预览关联考点</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">音频讲透</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>需求 / Web / 微服务 / 数据库四大方面 39 点「逐点讲透」连贯朗读</li>
                <li>问答式 / 洗脑式两种播放模式，支持整组无限循环，通勤伴随复习</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">命题规律沉淀</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>197 道案例真题已按决策不留站，其命题规律蒸馏为出题区×考点×问法统计（case-map）</li>
                <li>出题区地图与考点「案例三件套」（考频问法 / 答题套路 / 易错扣分点）在后续版本陆续补齐</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[0.98rem] font-medium text-foreground">全局搜索与界面</h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>顶栏全局搜索（Ctrl/⌘K）：导航快捷入口 + 考点全文检索</li>
                <li>浅色 / 深色 / 护眼（暖色纸感） / 跟随系统，默认深色，本机记忆偏好</li>
                <li>
                  <a className="text-primary underline" href="/changelog/">
                    更新日志
                  </a>
                  ：历次发版要点；新版本首次打开会弹窗提示
                </li>
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
                <li>浅色 / 深色 / 护眼（暖色纸感） / 跟随系统，默认深色，本机记忆偏好</li>
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
                源内容：<code>content/</code>（案例考点精炼 Markdown、案例分析答题教程）
              </li>
              <li>
                构建：<code>npm run sync:all</code> → <code>public/data/*.json</code> + <code>public/kb/**</code>
              </li>
              <li>团队文档：<code>docs/kb-workshop</code> · <code>docs/web-team</code></li>
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
