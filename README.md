# Jia Li · 李嘉

个人学术主页：**[li2ga.github.io](https://li2ga.github.io/)**。

这里是网站的公开发布仓库，包含静态页面、公开简历、媒体素材和公开统计快照。可编辑的资料与页面生成工具保存在独立的本地源码目录；发布时只复制明确允许公开的文件。

## 页面与入口

| 入口 | 用途 |
| --- | --- |
| [个人主页](https://li2ga.github.io/) | 研究简介、论文、经历、荣誉与联系方式；支持中英文切换 |
| [在线简历](https://li2ga.github.io/cv.html) | 可打印的英文简历 |
| [PDF 简历](https://li2ga.github.io/assets/documents/Jia-Li-CV.pdf) | 公开版 PDF |
| [Leave a hello](https://jia-li-website-analytics.yrweexnfqa.chatgpt.site/hello) | 访客自愿留言，登录可选 |
| [Owner dashboard](https://jia-li-website-analytics.yrweexnfqa.chatgpt.site/) | 仅站主登录后可查看的访问记录与管理页面 |

Owner 与 Leave 属于同一个已有服务，共用数据库。公开仓库不包含访客明细、留言内容、账号认证或运行密钥。

## 本地预览

克隆此仓库后，在仓库目录启动静态服务器：

```powershell
python -m http.server 8788 --bind 127.0.0.1
```

然后访问 <http://127.0.0.1:8788/>。本机配置的独立 Python 环境也可使用 `research-python` 替代 `python`。按 `Ctrl+C` 停止服务。

预览静态页面不需要安装 Node.js 依赖。访问统计和留言入口依赖线上服务，离线时可阅读主页及简历。

## 文件说明

| 文件 / 目录 | 内容 |
| --- | --- |
| `index.html` | 生成后的中英文主页 |
| `site.css` | 布局、字体、背景和交互样式 |
| `script.js` | 语言切换、开场、背景控制、点击 emoji 等交互 |
| `art-loops.js` | 火莲图像内部的流焰动画及静态回退 |
| `analytics.js` | 访问记录请求、统计刷新、公开快照和联系备用入口 |
| `cv.html` / `cv.css` | 在线简历与打印样式 |
| `assets/profile/` | 本人照片与微信二维码 |
| `assets/research/` | 论文配图及演示视频 |
| `assets/backgrounds/` | 火莲、意象和背景角色素材 |
| `assets/icons/` | 保留的旧版火莲与 JL 图标 |
| `assets/favicon.png` / `assets/favicon.ico` | 当前金色火莲标签页图标 |
| `assets/analytics/` | 仅包含公开汇总的统计快照与国家地图 |
| `.github/workflows/update-public-stats.yml` | 更新公开统计快照的工作流 |

## 在可编辑源码中修改

以下生成工具存在于独立的本地源码中，公开发布仓库只保留成品和统计更新工具。

- **正文、论文、经历与奖项**：编辑 `content.json` 的相应中英文内容，再运行 `python tools/build_site.py`。姓名在两种语言下均保留 `Jia Li | 李嘉`。
- **点击 emoji**：编辑 `script.js` 中的 emoji 数组。当前暂停十二生肖，以及月相组中带暗面或表情的月亮；旧项目保留在注释中。
- **配色、布局与动态**：修改 `site.css`、`script.js` 或 `art-loops.js`。背景选择、显淡控制、固定 / 滚动布局和系统“减少动态效果”的回退均应保留。
- **标题字体**：经典衬线字体与原版字体均保留，可由页面控制切换。
- **标签页图标**：当前使用已有的金色火莲 `assets/backgrounds/fire-lotus-gold-v1.png`。运行 `python tools/prepare_favicon.py` 后重新生成页面；小图标导出需要 FFmpeg。背景原图不改变，PNG 与 ICO 保留透明度。原环莲、粉金火莲及蓝色 JL 方块仍保留，便于切回。
- **PDF 简历**：确需更新 PDF 时再运行 `python tools/render_cv.py`，并检查实际分页；单改网站图标无需重新渲染 PDF。

原照片保持完整比例。火莲背景保留原始分辨率的无损 PNG；浏览器标签页另导出标准小尺寸图标。首次进入有开场动画，再访行为和显示偏好保存在当前浏览器中。

火莲演变新增“金枝柔焰 / Golden branches”：细金枝从中心有序向外展开，粉白火焰沿枝架柔和散开。新图保留原生透明 PNG，内部动画对金属骨架作保护；“凝聚形态”和“重铸流焰”等旧版仍可切换对照。可直接访问 `?background=lotus&lotus=branches&artmotion=loop`。

[动态对比页](https://li2ga.github.io/motion-preview.html)保留了早期真正的 GIF 样片（512×512、96帧、8秒、约8MB），可与当前原图实时绘制效果并排查看。GIF 是此前实验的固定导出，并非当前火焰渲染的录像；实时面板支持全部十三形态，构建时与主页共用形态列表和渲染器版本。金焰、绿色流焰以及侧面较低的火舌使用火焰流场，金属保护只用于带骨架的形态；原始素材保持不变。对比页不采集访问记录。

## 异火图鉴与实时流焰

[二十三种异火图鉴](https://li2ga.github.io/heavenly-flames.html)使用四张原生 1536×1024 透明 PNG，按图集坐标逐一展示二十三种异火。原图完整保留，不切割或有损转码；只加载当前选择所需的图版。深浅底色、静态/动态与逐焰选择均可切换。

名称、已知配色与形态作为创作依据，图片是原创视觉演绎，不能作为动画官方定稿。没有逐种核对动画登场镜头；火云水炎、万兽灵火的外观特别标注为推演。官方参考视频与截帧不随网站发布。

图鉴和十三种火莲共用 `art-loops.js`：192×192 持续燃料场通过双缓冲纹理向上输送，时变卷流改变路径，冷却使火舌消失。原图仍以原分辨率作为纹理，实际显示按屏幕像素绘制；燃料场分辨率不等于原图降质。该方案是二维输送近似，并非完整三维燃烧。已有金属骨架保持不动，原图、静态/减少动态回退、显淡及布局控制保留。图鉴支持手机动态；主站窄屏继续使用原来的静态回退。图鉴不采集访问记录。

## 统计与可用性

主页优先读取线上公开汇总，正常情况下每 15 秒刷新。原服务不可达时，自动显示本站保存的公开统计与国家地图，并注明最近同步时间。

公开快照工作流设置为每小时第 17 分钟（UTC）运行，也可手动触发；实际执行时间可能有延迟。它只更新汇总和国家地图，不发布 IP、访客明细或登记信息。工作流显式请求 GitHub Pages 构建，避免快照只更新仓库、网页却未更新。

**已知限制**：原留言 / 统计服务在部分网络下仍可能被托管层返回 403。主页的备用统计和邮件联系入口已提供替代路径，但不代表原服务的拦截已解除；无法连到记录接口的访问也不能保证入库。邮件联系不会自动保存为原站留言。Owner 是仅站主可用的管理入口，普通访客无法查看记录。

Owner / Leave 的新版界面和金色图标已经在本地准备，但原站源码发布连接尚未恢复，线上仍可能显示旧版。恢复连接时应更新原服务，保留原数据库和管理员配置。

## 发布与维护

日常修改在可编辑源码中完成，通过已有的 `tools/publish_github_pages.cmd` 发布。它使用独立的发布 checkout 和本机既有 Git 登录，将公开文件打包后推送到本仓库。**不要向沿用的模板作者仓库推送，也不要把整个源码目录直接上传。**

在源码目录也可仅生成发布 ZIP：

```powershell
python tools/package_site.py ../Jia-Li-homepage-publish.zip
```

发布前应同步工作流最新生成的两份 `assets/analytics/` 快照，避免用旧本地文件覆盖较新的统计。发布后应核对对应的 Pages 构建和实际网页资源；刷新浏览器不能替代发布。

旧站 <https://huster-lishuangjia.github.io/> 保留到新地址的跳转。当前组织站点为 `li2ga/li2ga.github.io`，无需修改个人 GitHub 用户名。

## 来源与许可

页面起源于 [Haoran Geng](https://geng-haoran.github.io/) 与 [Jon Barron](https://jonbarron.info/) 的学术主页模板，随后按本人资料和偏好修改。保留相关署名与素材许可。

照片、论文配图和演示片段分别来自本人及对应研究项目。学校标志来自相应官方来源；华科校徽采用[学校官方 VI 规范](https://vi.hust.edu.cn/jcbf/bzgf/xhgf.htm)。国家轮廓采用 [Natural Earth](https://www.naturalearthdata.com/) 数据。

火莲及部分意象为参考重绘或生成素材；角色、武器和标志的权利属于各自权利人，不作为官方制作素材发布。字体许可保留在 `assets/fonts/` 中。请勿将本人的照片、简历、微信二维码或第三方素材视为可自由复用的模板资源。
