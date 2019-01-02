<img src="https://user-images.githubusercontent.com/26399680/50566307-04890700-0d73-11e9-81e5-b0c99b38306b.png" alt="logo" width="128" height="128" align="right">

# VSC Netease Music

**UNOFFICAL** Netease Music extension for Visual Studio Code (🚧Under Construction🚧)

## Features

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

使用了 [Webview API](https://code.visualstudio.com/api/extension-guides/webview)，通过 Web Audio API 播放音乐，不依赖系统播放器

由于 VS Code 使用的 Electron 版本并未编译 ffmpeg，正常使用需要替换 VS Code 自带的 ffmpeg 动态运行库。请在 "帮助 > 关于" 中查看 VS Code 所使用 Electron 版本，并于 Electron 的 [Release Page](https://github.com/electron/electron/releases) 下载对应的 Electron **完整**版本进行替换（每次更新 VS Code 后都需重复此操作）

> Windows 下载 **electron-%version%-win32-x64.zip** 并替换 `./ffmpeg.dll`
>
> macOS 下替换 **electron-%version%-darwin-x64.zip** 并替换 `./Electron.app/Contents/Frameworks/Electron\ Framework.framework/Libraries/libffmpeg.dylib`
>
> Linux 下替换 **electron-%version%-linux-x64.zip** 并替换 `./libffmpeg.so`

## TODOs

- [ ] i18n
- [ ] settings
- [ ] shortcuts

## Extension Settings

> 还没做...

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Known Issues

- 暂不支持分页 (组件的交互限制)
- 图标不合适（等 VSCode 开放其自带图标）
- 列表对齐可能有问题（因不同字体下空格和符号的宽度不等）
- Webview 标签无法隐藏，如需继续使用请不要关闭
- Webview 限制只在前台可见才能操作，需要操作时插件会强制切换到 Webview 执行后再复原 Editor，标签切换不可见但会引起编辑器滚动条闪动（不影响输入）
- 播放列表较长时无法定位到当前播放歌曲（VSCode 未实现 activeItems 的在非可视区域时的自动滚动）