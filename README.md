# GitHub Collapse Markdown

![Version](https://img.shields.io/badge/version-5.2.4-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Userscript](https://img.shields.io/badge/userscript-Tampermonkey%2FViolentmonkey-orange.svg)

给 GitHub Markdown 页面加上标题折叠能力的 userscript。

装上以后，你可以像看文档工具一样折叠 README、Issue、PR、Gist 和 GitHub Docs 里的章节，只看当前关心的内容。

## 它解决什么问题

GitHub 上的长文档通常有这些问题：

- README 太长，滚动成本高
- Issue / PR 讨论里夹着大段 Markdown，不容易快速扫读
- Gist 和 Docs 页面缺少顺手的折叠交互
- 看某一节时，其他内容会持续干扰视线

这个脚本的目标很简单：

- 让 Markdown 标题可以直接折叠 / 展开
- 让长页面更容易扫读
- 让你快速定位、收起、展开你关心的章节

## 功能

- 标题折叠
  点击标题即可折叠或展开当前章节
- 同级批量折叠
  `Shift + 点击标题` 可以同时折叠或展开当前层级的同级标题
- 页面大纲
  仓库页面的目录放在 GitHub 原生侧栏的 About、Releases、Languages 等信息之后，默认展开。目录先随侧栏自然滚动，到达顶部后保持在侧栏跟随阅读，接近正文末尾时避让页面底部
- 自适应插入
  只要原生侧栏实际可见，就优先使用侧栏，不按固定窗口宽度降级；只有侧栏隐藏或不存在时，才尝试在 Markdown 内嵌入紧凑的 Contents 入口
- 浮动目录
  只有找不到安全插入位置时才显示浮窗入口。拖动 Contents 标题可移动窗口，也可聚焦标题后用方向键移动（Shift 加速）；窗口不会锁住背景页面
- 全部折叠 / 全部展开
  适合快速收起长文或恢复完整视图
- 页面记忆
  会记住当前页面的折叠状态，下次回来继续看
- 动态页面兼容
  GitHub 内部跳转、局部刷新、评论区更新后会自动重新挂载；侧栏延迟加载或被替换时，目录也会自动重新选择位置

## 支持页面

- `github.com`
  - README / Markdown 文件页
  - Issue 正文
  - Pull Request 正文
  - 评论区 Markdown 内容
  - Wiki
  - Discussions、Releases、代码审查评论和可见的 Markdown 预览
- `gist.github.com`
- `docs.github.com`
- `help.github.com`
- `support.github.com`

只有在页面里真正检测到 Markdown 标题时，脚本才会激活。

## 使用方式

- 点击标题左侧箭头：折叠 / 展开当前章节
- 点击整个标题行：折叠 / 展开当前章节
- `Shift + 点击标题`：批量折叠 / 展开同级章节
- 打开侧边面板：浏览大纲并跳转到指定标题
- 点击目录标题旁的 `⋯` 打开操作菜单
  - `Collapse all`：折叠全部章节
  - `Expand all`：展开全部章节

## 快捷键

- `Ctrl/Cmd + Shift + M`
  切换大纲面板
- `Ctrl/Cmd + Shift + C`
  折叠全部
- `Ctrl/Cmd + Shift + E`
  展开全部

## 安装

1. 安装脚本管理器
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [Violentmonkey](https://violentmonkey.github.io/)
2. 安装脚本
   - 直接安装仓库根目录脚本：
     [`main.js` 原始链接](https://raw.githubusercontent.com/zeya-labs/GitHub-Collapse-Markdown/main/main.js)
   - 或使用构建产物：
     `dist/github-collapse-markdown.user.js`
3. 更新后刷新 GitHub 页面，让新脚本生效；已安装的版本以脚本管理器显示为准

## 适合谁

- 经常看开源项目 README 的人
- 需要在长 Issue / PR 里快速找重点的人
- 习惯边看边收起内容、保持页面干净的人
- 想让 GitHub Markdown 更接近文档阅读器体验的人

## 许可证

[MIT](LICENSE)
