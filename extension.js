const fs = require('fs')
const path = require('path')
const vscode = require('vscode')

const activate = context => {

    const ActiveEditor = () => {
        let activeTextEditor = vscode.window.activeTextEditor
        return {reveal: () => {if (activeTextEditor) vscode.window.showTextDocument(activeTextEditor.document, activeTextEditor.viewColumn, false)}}
    }

    const Daemon = context => {
        
        let playerBar = null
        let webviewPanel = null
        let stateManager = null
        let commandManager = null
        
        const indexHtml = fs.readFileSync(vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath)

        const globalStorage = {
            get: key => context.globalState.get(key),
            set: (key, value) => context.globalState.update(key, value)
        }

        const StateManager = () => {
            const state = {}
            return {
                get: key => state[key],
                set: (key, value) => {
                    state[key] = value
                    vscode.commands.executeCommand('setContext', `neteasemusic.${key}`, value)
                },
                dispose: () => Object.keys(state).forEach(key => 
                    vscode.commands.executeCommand('setContext', `neteasemusic.${key}`, false)
                )
            }
        }

        const PlayerBar = () => {
            const buttons = {
                previous: {
                    command: 'neteasemusic.previous',
                    icon: ' $(chevron-left) '
                },
                next: {
                    command: 'neteasemusic.next',
                    icon: ' $(chevron-right) '
                },
                play: {
                    command: 'neteasemusic.play',
                    // icon: '▶'
                    icon: ' $(triangle-right) ',
                    state: {playing: false}
                },
                pause: {
                    command: 'neteasemusic.pause',
                    // icon: ' ❚❚ '
                    icon: ' $(primitive-square) ',
                    state: {playing: true}
                },
                like: {
                    command: 'neteasemusic.like',
                    icon: ' $(heart) ',
                    color: 'rgba(255,255,255,0.5)',
                    state: {liked: false}
                },
                dislike: {
                    command: 'neteasemusic.dislike',
                    icon: ' $(heart) ',
                    state: {liked: true}
                },
                mute: {
                    command: 'neteasemusic.mute',
                    icon: '$(unmute)',
                    state: {muted: false}
                },
                unmute: {
                    command: 'neteasemusic.unmute',
                    icon: '$(mute)',
                    color: 'rgba(255,255,255,0.5)',
                    state: {muted: true}
                },
                comment: {
                    command: 'neteasemusic.comment',
                    icon: '$(comment-discussion)'
                },
                list: {
                    command: 'neteasemusic.list',
                    icon: ''
                }
            }

            const bind = (item, preset) => {
                item.color = preset.color || undefined
                item.text = preset.icon
                item.command = preset.command
                if (preset.state) Object.keys(preset.state).forEach(key => stateManager.set(key, preset.state[key]))
            }
    
            const order = [['list'], /*['comment'],*/ ['like', 'dislike'], ['previous'], ['play', 'pause'], ['next'], ['mute', 'unmute']].reverse()
            
            const items = order.map((group, index) => {
                group.forEach(name => buttons[name].index = index)
                let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 163 + index)
                bind(item, buttons[group[0]])
                return item
            })
            
            return {
                dispose: () => {
                    items.forEach(item => item.dispose())
                },
                state: state => {
                    if (!(state in buttons)) return
                    if (state.includes('like')) stateManager.get('logged') ? items[buttons.like.index].show() : items[buttons.like.index].hide()
                    let index = buttons[state].index
                    let name = order[index].find(name => name != state)
                    bind(items[index], buttons[name])
                },
                update: text => {
                    items[buttons.list.index].text = text
                },
                show: () => {
                    stateManager.set('track', true)
                    items.forEach(item => item.show())
                },
                hide: () => {
                    stateManager.set('track', false)
                    items.forEach(item => item.hide())
                }
            }
        }

        const WebviewPanel = () => {
            let activeEditor = ActiveEditor()
            const panel = vscode.window.createWebviewPanel(
                'neteasemusic', 'NetEaseMusic',
                {preserveFocus: true, viewColumn: vscode.ViewColumn.One},
                {enableScripts: true, retainContextWhenHidden: true}
            )
            panel.webview.html = indexHtml
            activeEditor.reveal()
            activeEditor = null

            panel.onDidDispose(() => {
                commandManager.dispose()
                stateManager.dispose()
                playerBar.dispose()
                commandManager = null
                stateManager = null
                webviewPanel = null
                playerBar = null
            })

            panel.webview.onDidReceiveMessage(message => {
                const type = message.type
                const body = message.body
                if (type == 'event') {
                    if (body.name == 'end') {
                        commandManager.execute('next')
                    }
                    else if (body.name == 'load') {
                        playerBar.update(`${body.data.artist} - ${body.data.name}`)
                    }
                    else if (body.name == 'lyric') {
                        playerBar.update(body.data)
                    }
                    else if (['play', 'pause', 'mute', 'unmute'].includes(body.name)) {
                        playerBar.state(body.name)
                    }
                }
                else if (type == 'echo') {
                    vscode.window.showInformationMessage(body)
                }
            }, undefined, context.subscriptions)

            return {
                dispose: () => panel.dispose(),
                postMessage: (command, data) => {
                    let shift = !panel.visible
                    let activeEditor = ActiveEditor()
                    if (shift) panel.reveal()
                    panel.webview.postMessage({command, data})
                    if (shift) activeEditor.reveal()
                    activeEditor = null
                }
            }
        }

        const CommandManager = () => {
            const api = require('./request.js')({globalStorage, stateManager})
            const controller = require('./controller.js')({webviewPanel, playerBar, stateManager, api})
            const interaction = require('./interaction.js')({api, controller})

            const commands = {
                'toplist': interaction.toplist,
                'playlist.highquality': interaction.playlist.highquality,
                'playlist.hot': interaction.playlist.hot,
                'new.song': interaction.new.song,
                'new.album': interaction.new.album,
                'search': interaction.search,

                'user.playlist': interaction.user.playlist,
                'user.artist': interaction.user.artist,
                'user.album': interaction.user.album,
                'recommend.song': interaction.recommend.song,
                'recommend.playlist': interaction.recommend.playlist,

                'login': interaction.login,
                'logout': interaction.logout,

                'comment': interaction.comment,
                'list': interaction.list,
                'pause': controller.pause,
                'play': controller.resume,
                'previous': controller.previous,
                'next': controller.next,

                'like': controller.like,
                'dislike': controller.dislike,

                'mute': controller.mute,
                'unmute': controller.unmute,
            }
            
            const registration = Object.keys(commands).map(name => vscode.commands.registerCommand(`neteasemusic.${name}`, commands[name]))
            registration.forEach(command => context.subscriptions.push(command))

            return {
                execute: name => {if (name in commands) commands[name]()},
                dispose: () => registration.forEach(command => command.dispose())
            }
        }

        return{
            stop: () => {
                if (webviewPanel) webviewPanel.dispose()
            },
            start: () => {
                if (webviewPanel) return
                // console.log('global state', context.globalState.get('user'))

                stateManager = StateManager()
                playerBar = PlayerBar()
                webviewPanel = WebviewPanel()
                commandManager = CommandManager()

                stateManager.set('on', true)
            }
        }
    }
    
    const daemon = Daemon(context)
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.start',  daemon.start))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.stop',  daemon.stop))

}
exports.activate = activate

const deactivate = () => {}
exports.deactivate = deactivate