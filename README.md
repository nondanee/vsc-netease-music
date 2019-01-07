# VSC Netease Music

[![release](https://vsmarketplacebadge.apphb.com/version/nondanee.vsc-netease-music.svg)](https://marketplace.visualstudio.com/items?itemName=nondanee.vsc-netease-music)
[![installs](https://vsmarketplacebadge.apphb.com/installs/nondanee.vsc-netease-music.svg)](https://marketplace.visualstudio.com/items?itemName=nondanee.vsc-netease-music)
[![rating](https://vsmarketplacebadge.apphb.com/rating-short/nondanee.vsc-netease-music.svg)](https://marketplace.visualstudio.com/items?itemName=nondanee.vsc-netease-music#review-details)

**UNOFFICAL** Netease Music extension for Visual Studio Code

## Features

使用 [Webview](https://code.visualstudio.com/api/extension-guides/webview) 实现，通过 Web Audio API 播放音乐，不依赖[系统播放器](https://github.com/shime/play-sound#options)，**灵感来自 [kangping/video](https://marketplace.visualstudio.com/items?itemName=kangping.video)**

- 发现音乐（歌单/新歌/排行榜）
- 搜索（单曲/歌手/专辑/歌单）
- 用户登录（手机号/邮箱）
- 用户收藏（歌单/歌手/专辑）
- 每日歌曲推荐
- 喜欢音乐
- 逐行歌词
- 热门评论
- 无海外限制

## Requirements

由于 [VS Code 使用的 Electron 版本不包含 ffmpeg](https://stackoverflow.com/a/51735036)，正常使用需要替换 VS Code 自带的 ffmpeg 动态运行库。请在 "帮助 > 关于" 中查看 VS Code 所使用 Electron 版本，并于 Electron 的 [Release Page](https://github.com/electron/electron/releases) 下载对应的 **Electron 完整版本**进行替换（每次更新 VS Code 后都需重复此操作）

*修改 url 可以快速定位版本 https://github.com/electron/electron/releases/tag/%version%*

### Windows
下载 **electron-%version%-win32-x64.zip** 

替换 `./ffmpeg.dll`

### macOS
下载 **electron-%version%-darwin-x64.zip** 

替换 `./Electron.app/Contents/Frameworks/Electron\ Framework.framework/Libraries/libffmpeg.dylib`

###  Linux
下载 **electron-%version%-linux-x64.zip** 

替换 `./libffmpeg.so`

## TODOs

- [x] i18n
- [ ] settings
- [ ] shortcuts
- [ ] exit point

## Extension Settings

> 还没做...

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Known Issues

- 暂不支持分页 (组件的交互限制)
- 图标不合适（[等 VS Code 增加更多图标支持](https://github.com/Microsoft/vscode/issues/10455)）
- 列表对齐可能有问题（不同字体下空格和符号的宽度不等）
- Webview 标签无法隐藏，使用时请不要关闭标签
- [Webview API 限制只在前台可见才能接收消息](https://github.com/Microsoft/vscode/issues/47534)，需要操作时插件会自动切换到 Webview 执行后再复原 Editor，标签切换不可见但会引起编辑器滚动条闪动（不影响输入）
- 播放列表较长时无法定位到当前播放歌曲（VS Code 未实现 activeItems 处于 quickPick 非可视区域时的自动聚焦）