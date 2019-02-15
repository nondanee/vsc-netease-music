<div align="center">

<img src="https://raw.githubusercontent.com/nondanee/vsc-netease-music/master/icon.png" alt="icon" width="128px">

# VSC Netease Music

**UNOFFICAL** Netease Music extension for Visual Studio Code

[![Visual Studio Marketplace](https://img.shields.io/badge/Visual%20Studio-Marketplace-007acc.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=nondanee.vsc-netease-music)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/nondanee.vsc-netease-music.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=nondanee.vsc-netease-music)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/nondanee.vsc-netease-music.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=nondanee.vsc-netease-music)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/stars/nondanee.vsc-netease-music.svg?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=nondanee.vsc-netease-music)
[![GitHub Stars](https://img.shields.io/github/stars/nondanee/vsc-netease-music.svg?style=flat-square)](https://github.com/nondanee/vsc-netease-music)

![demo](https://user-images.githubusercontent.com/26399680/50915155-240ae880-1473-11e9-91b6-731183a6b26a.gif)

</div>



## Feature

使用 [Webview](https://code.visualstudio.com/api/extension-guides/webview) 实现，通过 Web Audio API 播放音乐，不依赖[命令行播放器](https://github.com/shime/play-sound#options)，**灵感来自 [kangping/video](https://marketplace.visualstudio.com/items?itemName=kangping.video)**

- 发现音乐 (歌单 / 新歌 / 排行榜)
- 搜索 (单曲 / 歌手 / 专辑 / 歌单)
- 用户登录 (手机号 / 邮箱)
- 用户收藏 (歌单 / 歌手 / 专辑)
- 每日歌曲推荐
- 喜欢音乐
- 逐行歌词
- 热门评论
- 无海外限制

## Requirement

**自 1.31.0 起，VS Code 自带完整的 ffmpeg 动态链接库 (不知是 feature 还是 bug)，无需自行替换，安装插件即可使用**

~~[VS Code 使用的 Electron 版本不包含 ffmpeg](https://stackoverflow.com/a/51735036)，需替换自带的 ffmpeg 动态链接库才能正常播放 (每次更新 VS Code 都需重新替换)~~

<details>
<summary>Deprecated</summary>

### Manual Replacement
通过你的 VS Code 版本在 https://raw.githubusercontent.com/Microsoft/vscode/%version%/.yarnrc  查看其使用 Electron 版本，并于 https://github.com/electron/electron/releases/tag/%version% 下载对应的 **Electron 完整版本**进行替换

#### Windows
下载 **electron-%version%-win32-%arch%.zip**

替换 `./ffmpeg.dll`

#### macOS
下载 **electron-%version%-darwin-x64.zip** 

替换 `./Electron.app/Contents/Frameworks/Electron\ Framework.framework/Libraries/libffmpeg.dylib`

####  Linux
下载 **electron-%version%-linux-%arch%.zip**

替换 `./libffmpeg.so`

### Automatic Replacement
要求 Python 环境 (Python 2/3 均可，无额外依赖)

#### Windows Powershell

```powershell
Invoke-RestMethod https://gist.githubusercontent.com/nondanee/f157bbbccecfe29e48d87273cd02e213/raw | python
```

#### Unix Shell

```
curl https://gist.githubusercontent.com/nondanee/f157bbbccecfe29e48d87273cd02e213/raw | python
```

如果你的 VS Code 未修改默认安装位置，脚本会自动寻找并替换，若自定义了安装位置，需自行修改 [installation](https://gist.github.com/nondanee/f157bbbccecfe29e48d87273cd02e213#file-helper-py-L20)

**默认安装位置下 macOS 不需管理员权限，Linux 和 Windows 需要**

</details>

## Usage

按下 <kbd>F1</kbd> 或 <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>P</kbd> 打开命令面板

输入命令前缀 `网易云音乐` 或 `NeteaseMusic` 开始探索 :D

## Todo

- [x] i18n
- [ ] setting
- [ ] shortcuts
- [ ] exit point

## Extension Setting

> 还没做...

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Known Issue

- 由于未找到**支持播放在线音乐**、**能够正常遥控**又**足够小巧**的命令行播放器而借助 Webview 实现 ([mpg123 在 windows 下的控制有 bug](https://sourceforge.net/p/mpg123/mailman/mpg123-users/thread/CAN5OgQWuYFt4mbbjDZcxMMdTQLZoNiF8AgH5S8Z8rwraN%2B65uA%40mail.gmail.com/))
- 暂不支持分页 (组件的交互限制)
- 图标不合适 ([等 VS Code 增加更多图标支持](https://github.com/Microsoft/vscode/issues/10455))
- 列表对齐可能有问题 (不同字体下字符宽度不等)
- Webview 标签无法隐藏，使用时请不要关闭标签
- ~~[Webview API 限制只在前台可见才能接收 postMessage 消息](https://code.visualstudio.com/api/references/vscode-api#Webview)，需要通信时插件会自动切换到 Webview 再复原 Editor，标签切换不可见但会引起编辑器滚动条闪动 (不影响输入)~~ 
- 自 1.31.0 开始 reveal 后 postMessage 会有可见的切换延迟，已改用 WebSocket 实现双向通信
- 1.31.0 升级使用 Electron 3.x，受制于 [Chrome 66 内核的 Autoplay Policy](https://developers.google.com/web/updates/2017/09/autoplay-policy-changes)，用户需先与 Webview 交互才能播放
- 播放列表较长时无法定位到当前播放歌曲 (VS Code 未实现 activeItems 处于 quickPick 非可视区域时的滚动聚焦)