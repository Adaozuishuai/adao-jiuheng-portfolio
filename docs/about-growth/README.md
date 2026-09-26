# ABOUT 成长动画交付与验收

完成日期：2026-09-12。网站目录：`/Users/Admin/Documents/adao-jiuheng-portfolio`。

## 实现

- `components/home/about-growth.tsx`：独立客户端组件，用原生 Web Animations API 控制五个人物层。没有新增网站运行时依赖。
- `app/page.tsx`：仅将 ABOUT 原有图片替换为 `AboutGrowth`；保留编号、寄语、周围布局。
- `app/home.css`：3:1 容器、完整图像定位、最终态与减少动态效果样式。
- 0–600ms 孩童出现；600–2800ms 孩童副本向前放大并交叉渐变为少年；2800–3300ms 停留；3300–5500ms 少年副本继续向前渐变为成人；5500–6000ms 三人停留。孩童与少年各自的静止层保留。
- 所有图层使用 2172×724 画布；孩童、少年、成人的脚底锚点分别为 `(604,568)`、`(809,536)`、`(1026,510)`。百分比位移和脚底缩放保持响应式对齐；人物及投影一起变换。
- 至少 30% 可见且全部渲染素材解码后开始。全部动画使用同一 `startTime`；离屏及页面隐藏时，统一固定 `currentTime` 并暂停。
- 完成后取消动画实例，用静态样式固定三个身影。无循环、无播放按钮。
- 内存与 `sessionStorage` 保存本次展示记录，兼容现有原生“返回作品”链接的整页导航；首页刷新检测到 `navigation.type=reload` 时清除记录。中途进入详情后返回也显示完成画面。
- 无 JavaScript、图片错误、API 不支持或减少动态效果时保留原图。运行中切换减少动态效果立即取消动画；恢复普通模式后已开始的展示不重播。
- 唯一可访问图片为原图的 `alt` 描述；视觉透明时仍保留在辅助技术树中。全部动画层 `aria-hidden`。卸载清理动画、观察器、页面事件及图片事件。
- 浏览器禁用 sessionStorage 时降级到内存记录；同文档客户端导航仍保留记录，但整页导航后的记录无法保证保存。

## 素材与制作边界

原图保持在 `public/images/home/about-journey.png`，没有被覆盖。

| 素材 | 项目路径 | 文件格式 |
| --- | --- | --- |
| 无人物背景 | `public/images/home/journey/background.png` | RGB PNG，2172×724 |
| 孩童与投影 | `public/images/home/journey/child.png` | RGBA PNG，2172×724 |
| 少年与投影 | `public/images/home/journey/teen.png` | RGBA PNG，2172×724 |
| 成人与投影 | `public/images/home/journey/adult.png` | RGBA PNG，2172×724 |

使用内置 imagegen 编辑原图。工具生成的三张人物图实际是带绘制棋盘格的 RGB 文件，不是透明 PNG。经用户明确同意，使用本地脚本进行分割、透明边缘去污染、灰色衣袖保护和坐标校准，才得到交付 RGBA 文件。投影按生成图形状描摹、缩短并重建为柔化的半透明遮罩，未保留绘制棋盘格。

工具对人物衣物细节及姿态有轻微重绘，道路局部纹理也不同。最终图与原图构图接近，不承诺像素一致；投影的轮廓和明暗经过后处理，因此也不是原图投影的逐像素提取。

已检查：背景无人物残影；三张素材的 alpha 最小值 0、最大值 255；浅色和深色底未见矩形底色，人物灰色衣袖没有透明孔洞。统计见 [asset-metrics.json](asset-metrics.json)，边缘检查见 [alpha-edge-check.png](alpha-edge-check.png)，对照见 [original-vs-final.png](original-vs-final.png)。

## 验收结果

在 Chrome 的生产预览 `http://localhost:3006` 上，自动化验收 **27 项通过**；另有 **1 项真实标签页切换验收通过**。这不是 Safari 或实机手机验收。

- 初次进入、低于 30% 可见不启动、全部素材解码后启动。
- 600ms、3000ms、5800ms 关键帧；1700ms、4400ms 成长过渡。
- 两种年龄交叉渐变时脚底坐标差小于 0.02 CSS 像素；两层透明度之和为 1；旧年龄静止层保持可见。
- 离开后时间戳不增加，回来后继续；完成后再次进入保持三人，动画实例数为 0。
- 完成后详情返回、播放中详情返回、首页刷新重播。
- 初始减少动态效果、运行中切换、关闭减少动态效果后不重复播放。
- 禁用 JavaScript、请求失败、运行中图片失败均显示原图。
- 延迟成人素材响应时原图持续显示；加载前后容器边界完全一致。
- 1440、768、390、320px 四个宽度无横向溢出、无图片裁切；容器维持 3:1。
- 整个画面只有一条可访问图片描述。
- 作品与博客导航通过；篮球点击后成功投中并回到 `rest`。
- 测试中没有未捕获浏览器异常。

真实后台测试使用独立 Chrome 测试配置和原始 CDP 标签页切换，避开 Playwright 的强制焦点模拟。切到后台后确实得到 `document.visibilityState=hidden`，五个动画全部暂停；隐藏期间 `currentTime` 保持不变，回来后五个动画继续。

机器可读证据：[browser-test-results.json](browser-test-results.json)、[background-test-results.json](background-test-results.json)。

| 检查 | 结果 |
| --- | --- |
| ABOUT 组件、首页、两份浏览器验收脚本的 oxlint | 通过 |
| TypeScript `tsc --noEmit` | 通过 |
| `next build` 生产构建 | 通过，8/8 静态页面生成完成 |
| 全仓 oxlint | 未通过：既有 `components/ui/*`、`hooks/use-mobile.ts`、`components/project-hoop.tsx`、`components/basketball-world.tsx` 等报错，另有 `postcss.config.mjs` 默认导出警告；这些文件未在本次修改 |

关键阶段截图：[孩童出现](stage-start.png) · [少年完成](stage-teen.png) · [最终三人](stage-final.png)。

响应式截图：[1440px](responsive-1440.png) · [768px](responsive-768.png) · [390px](responsive-390.png) · [320px](responsive-320.png)。

回退截图：[无 JavaScript](fallback-no-js.png) · [素材加载失败](fallback-missing-asset.png)。

## 复测

在项目根目录，使用已安装的 Node 与开发依赖中的 Playwright（不会进入生产运行依赖）：

```sh
pnpm build
pnpm start -- --port 3006
# 在另一个终端执行。
TEST_BASE_URL=http://localhost:3006 pnpm test:e2e:about
TEST_BASE_URL=http://localhost:3006 pnpm test:e2e:about-background
```

`tests/e2e/about-background.mjs` 默认使用 macOS Google Chrome；其他安装路径用 `CHROME_PATH` 指定。它新建并清理临时浏览器配置，不使用个人 Chrome 资料。

素材后处理脚本：`scripts/assets/prepare-journey-assets.py`。依赖 Pillow、NumPy、OpenCV，均仅用于素材制作。使用本轮 imagegen 输出目录作为参数重建：

```sh
python3 scripts/assets/prepare-journey-assets.py /Users/Admin/.codex/generated_images/01a09356-6961-78d1-81be-3e265697db16
```

## 内置 imagegen 提示词记录

所有输入均为原图 `public/images/home/about-journey.png`。以下记录的是实际提交的提示词；其中透明通道要求未被工具满足，已按上述流程后处理。

### 背景

> Use case: precise-object-edit. Edit target: supplied 3:1 website illustration. Produce a clean background plate, SAME 3:1 composition. Remove all THREE people and ALL their long cast shadows completely. Reconstruct the road underneath seamlessly. Keep road geometry, mountains, sun, warm ivory paper texture, colors and framing as unchanged as possible. No people, silhouettes, bags, shadows or new objects. Save image output.

输出：`exec-384ecf93-9bcd-4c42-96a4-a8f16a7042d5.png`。

### 孩童

> Use case: background-extraction. Extract ONLY the leftmost young CHILD with backpack, running toward right, including his full cast shadow extending down-left. Preserve exact original clothing, pose, proportions, direction and lighting. Remove the teenager, adult and entire background. Output actual transparent RGBA PNG, not a checkerboard or white background. Keep the ORIGINAL full 2172x724 3:1 canvas and child's ORIGINAL position and size within it, so this layer registers with original. All pixels except child and his own shadow transparent. No road texture in shadow; shadow translucent.

输出：`exec-451817f0-dc3a-4e1e-8040-7fa586fb4724.png`。

### 少年

> Use case: background-extraction. Extract ONLY the middle TEENAGER with backpack walking toward right, including his complete cast shadow down-left. Preserve exact original clothes, pose, proportions, direction and lighting. Remove child, adult and entire background. Output actual transparent RGBA PNG with alpha zero everywhere outside teenager and translucent shadow, NEVER paint a checkerboard. Keep original full 2172x724 3:1 canvas and teenager ORIGINAL position and size for exact layer registration. No ground or road texture.

输出：`exec-d4d4b203-6d69-4b94-b7ac-c278712b94a2.png`。

### 成人

> Extract rightmost ADULT person and his cast shadow as a transparent PNG sprite for web animation. IMPORTANT: actual file alpha transparency is required; do not draw checkerboard pattern. If actual transparency unsupported output pure solid bright magenta #FF00FF background suitable for chroma key, NEVER checkerboard or paper texture. Adult only, preserve dark trousers, gray rolled-sleeve top, black backpack, walking right pose and warm light exactly. Full original 2172x724 wide canvas; keep adult at original position and original scale. Remove other people, landscape and road. Shadow must extend left-down from feet as original.

输出：`exec-df360d7d-325c-48c4-9fbe-990cfcf1a6cd.png`。

动画同步实现参考浏览器 API 文档：[Animation.startTime](https://developer.mozilla.org/en-US/docs/Web/API/Animation/startTime)、[Animation.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/Animation/currentTime)。实际行为以上述本地浏览器验收为准。
