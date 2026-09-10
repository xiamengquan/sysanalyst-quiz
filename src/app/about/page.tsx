export default function AboutPage() {
  return (
    <>
      <h1 className="mb-1 text-[1.35rem] font-semibold">关于</h1>
      <p className="mb-5 text-[0.9rem] text-[var(--muted)]">站点说明 · 合规 · 部署</p>

      <div className="card mb-3 border-[color-mix(in_srgb,var(--warn)_40%,var(--line))] text-[0.92rem] leading-relaxed">
        <b style={{ color: "var(--warn)" }}>合规声明</b>：本站仅供<strong>个人学习</strong>
        。真题及解析请勿对外传播、商用或二次发布。
      </div>

      <div className="card about space-y-2 text-[0.92rem] leading-relaxed text-[var(--muted)]">
        <h2 className="text-[1.05rem] text-[var(--text)]">站点说明</h2>
        <p>
          Next.js 静态导出站点：选择题刷题、案例分析练习卡、知识点精炼站内阅读。进度与案例草稿保存在浏览器
          localStorage。
        </p>
      </div>

      <div className="card space-y-2 text-[0.92rem] leading-relaxed text-[var(--muted)]">
        <h2 className="text-[1.05rem] text-[var(--text)]">数据来源</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>自编练习 / 真题选择题 / 出题工坊 → <code>public/data/questions.json</code></li>
          <li>案例分析 → <code>public/data/cases.json</code></li>
          <li>知识点正式稿 → <code>public/kb/**</code> + <code>kb-index.json</code></li>
        </ul>
      </div>

      <div className="card space-y-2 text-[0.92rem] leading-relaxed text-[var(--muted)]">
        <h2 className="text-[1.05rem] text-[var(--text)]">EdgeOne Makers 部署</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>将本仓库导入 EdgeOne Makers（GitHub）</li>
          <li>构建命令：<code>npm run build</code></li>
          <li>输出目录：<code>out</code>（见 <code>edgeone.json</code>）</li>
          <li>Framework：Next.js · 静态导出（SSG）</li>
        </ol>
      </div>

      <div className="card text-[0.92rem] text-[var(--muted)]">
        <h2 className="mb-2 text-[1.05rem] text-[var(--text)]">版本</h2>
        <p>站点 v0.3.1 · Next.js 15 · 知识点精炼 v1.0 · 出题细则 v1.1</p>
      </div>
    </>
  );
}
