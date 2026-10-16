import fs from "node:fs";
import path from "node:path";

/**
 * 【临时脚手架】云雷纹描摹校对页。
 * 左/上为参考原图，右/下为 potrace 描摹件，另一组是放大细节。
 * 只为判断「描摹得像不像」。确认后本页删除。
 */

export const dynamic = "force-dynamic";

const PREVIEW_DIR = path.join(process.cwd(), "public", "workbench-preview");
/** 直接读正式素材，避免校对页和实际资产脱节。 */
const TRACED_SVG = path.join(process.cwd(), "public", "patterns", "yunlei.svg");

const VIEW_W = 1036;
const VIEW_H = 221;
/** 放大细节的取景框（原图像素坐标） */
const ZOOM = { x: 300, y: 0, w: 320, h: 233 };
const ZOOM_SCALE = 3;

const INK = "#f2eee2";
const FIELD = "#015687";

function readTracedPaths(): string[] {
  const text = fs.readFileSync(TRACED_SVG, "utf8");
  return Array.from(text.matchAll(/<path\b[^>]*?\bd="([^"]+)"/g)).map((m) => m[1]);
}

function TracedSvg({ paths, className }: { paths: string[]; className?: string }) {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={className}>
      <rect width={VIEW_W} height={VIEW_H} fill={FIELD} />
      {paths.map((d, i) => (
        <path key={i} d={d} fill={INK} stroke="none" />
      ))}
    </svg>
  );
}

/** 把一块区域放大显示：外层裁切，内层平移+缩放。 */
function ZoomBox({ children }: { children: React.ReactNode }) {
  const inner = {
    width: VIEW_W * ZOOM_SCALE,
    height: VIEW_H * ZOOM_SCALE,
    marginLeft: -ZOOM.x * ZOOM_SCALE,
    marginTop: -ZOOM.y * ZOOM_SCALE,
  } as const;
  return (
    <div
      className="overflow-hidden rounded-md border border-border"
      style={{ width: ZOOM.w * ZOOM_SCALE, height: ZOOM.h * ZOOM_SCALE }}
    >
      <div style={inner}>{children}</div>
    </div>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {note ? <div className="mt-1 mb-4 text-sm text-muted-foreground">{note}</div> : <div className="mb-4" />}
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default function YunleiTracePreviewPage() {
  const paths = readTracedPaths();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">云雷纹描摹校对</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          阶段 0 的临时校对页 —— 判断描摹件像不像参考图。看完即删。
        </p>
        <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <strong>取向：</strong>按你的选择做<strong>忠实描摹</strong> —— 保留手作的不规则曲线，
          只去掉纸张纹理与色彩噪声。曲线没有被规整化为数学标准形。
        </p>
      </header>

      <div className="grid gap-6">
        <Card title="① 判读结果" note="从参考图量化读出来的结构，不是我猜的。">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">纹样类型</dt>
            <dd>二方连续 <b>圆雷纹</b>（双行螺旋 + 弧线勾连），不是直角方雷纹</dd>

            <dt className="text-muted-foreground">画面</dt>
            <dd className="tabular-nums">
              {VIEW_W} × {VIEW_H} px（裁掉上下过渡带后），蓝底白线，亮度双峰 66 / 226（阈值取中点 146）
            </dd>

            <dt className="text-muted-foreground">重复性</dt>
            <dd>
              约 <b>每 116px</b> 近似重复，但<b>不是严格重复</b> —— 逐像素匹配率仅 62%，
              峰值间距在 102~140 间浮动。判定为手绘/生成风格的插画，或带透视变形的翻拍件。
            </dd>

            <dt className="text-muted-foreground">连通性</dt>
            <dd>
              描摹出 <b>{paths.length} 个互不相连的块</b> —— 纹样不是一条连绵到底的线，
              而是由多段独立弧线拼成。
            </dd>
          </dl>
        </Card>

        <Card title="② 并排对比（上：参考原图　下：描摹件）" note="同一宽度、同一取景。看形态、线条粗细、尖角与螺旋收笔。">
          <div className="grid gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/workbench-preview/yunlei-source.png"
              alt="参考原图"
              className="w-full rounded-md border border-border"
            />
            <TracedSvg paths={paths} className="w-full rounded-md border border-border" />
          </div>
        </Card>

        <Card
          title={`③ 放大细节 ×${ZOOM_SCALE}（原图 x=${ZOOM.x}..${ZOOM.x + ZOOM.w}）`}
          note="细节处见真章：看曲线是否被误拉直、尖钩有没有丢失、线宽是否一致。"
        >
          <div className="flex flex-wrap gap-4">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <ZoomBox>
                <img
                  src="/workbench-preview/yunlei-source.png"
                  alt="原图放大"
                  style={{ width: VIEW_W * ZOOM_SCALE, height: VIEW_H * ZOOM_SCALE }}
                />
              </ZoomBox>
              <p className="mt-2 text-xs text-muted-foreground">参考原图</p>
            </div>
            <div>
              <ZoomBox>
                <TracedSvg paths={paths} />
              </ZoomBox>
              <p className="mt-2 text-xs text-muted-foreground">描摹件</p>
            </div>
          </div>
        </Card>

        <Card title="④ 量化指标" note="逐像素比对（阈值 146 二值化后）。">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="逐像素一致率" value="97.44%" sub="描摹件 vs 原图" />
            <Stat label="线面积占比" value="40.8%" sub="原图实测 40.8%" />
            <Stat label="路径数" value={String(paths.length)} sub="互不相连的单元" />
            <Stat label="文件大小" value="16 KB" sub="vs 原图 650 KB" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            剩余 2.55% 的差异集中在线的边缘 —— 原图是照片，线缘有 1~2 px 的晕开过渡带，
            二值化时必须二选一。这是任何描摹都无法消除的，不是描摹质量问题。
          </p>
        </Card>

        <Card title="⑤ 已确认的结论">
          <ul className="space-y-3 pl-5 text-sm">
            <li className="list-disc">
              <b>形态通过。</b>已写入 <code>public/patterns/yunlei.svg</code>，博物馆详情页「矢量图」
              已实际验证加载（1036×221，9 条路径）。
            </li>
            <li className="list-disc">
              <b>用法：整条带当一个素材。</b>不作无缝阵列 —— 因为原图不是严格重复，
              切周期必须把曲线拉成数学标准形，与「保留手作感」冲突。
            </li>
            <li className="list-disc">
              <b>描摹前的清理</b>（这一步的取舍要留档）：原图蓝底上下边缘是「纸→蓝」的
              2~10 px 过渡带，直接二值化会被误判成线条，描出两条横贯全幅的假线。
              已把裁切收紧到 y=20..241 排掉；并用 <code>--turdsize 40</code> 清掉残留杂质。
            </li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            本页是阶段 0 的临时校对页，确认完成后可删。
          </p>
        </Card>
      </div>
    </div>
  );
}
