<img src="https://user-images.githubusercontent.com/26399680/50566307-04890700-0d73-11e9-81e5-b0c99b38306b.png" alt="logo" width="128" height="128" align="right">

# VSC Netease Music

**UNOFFICAL** Netease Music extension for Visual Studio Code (🚧Under Construction🚧)

## Features

- 用户登录（手机号/邮箱）
- 用户收藏（歌单/歌手/专辑）
- 每日歌曲推荐
- 发现音乐（歌单/新歌/排行榜）
- 喜欢音乐（加红心）
- 搜索（单曲/歌手/专辑/歌单）
- 歌词显示
- 无海外限制

## Requirements

使用了 [Webview API](https://code.visualstudio.com/api/extension-guides/webview)，通过 Web Audio API 播放音乐，不依赖系统播放器

由于 VS Code 使用的 Electron 版本并未编译 ffmpeg，正常使用需要替换 VS Code 自带的 ffmpeg 动态运行库。请在 "帮助>关于" 中查看 VS Code 所使用 Electron 版本，并于 [Electron Github Release Page](https://github.com/electron/electron/releases) 下载对应的 Electron 完整版本进行替换（每次更新 VS Code 后都需重复此操作）

> Windows 下替换 ffmpeg.dll，macOS 下替换 libfffmpeg.dylib

## TODOs

- [ ] i18n
- [ ] setting

## Extension Settings

> 还没做...

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Known Issues

- 不支持分页 (组件的交互限制)
- 图标不合适（等 VSCode 开放其自带图标）
- Webview 无法隐藏，如需继续使用请不要关闭 Webview 标签
- Webview 需要前台可见才能操作，后台快速切换标签会引起滚动条闪动