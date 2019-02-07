const fs = require('fs')
const ws = require('ws')
const path = require('path')
const vscode = require('vscode')

const ActiveEditor = () => {
    let activeTextEditor = vscode.window.activeTextEditor
    return {reveal: () => activeTextEditor ? vscode.window.showTextDocument(activeTextEditor.document, activeTextEditor.viewColumn, false) : undefined}
}

const GlobalStorage = context => {
    return {
        get: key => context.globalState.get(key),
        set: (key, value) => context.globalState.update(key, value)
    }
}

const StateManager = context => {
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

const PlayerBar = context => {
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
        if (preset.state) Object.keys(preset.state).forEach(key => runtime.stateManager.set(key, preset.state[key]))
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
            if (state.includes('like')) runtime.stateManager.get('logged') ? items[buttons.like.index].show() : items[buttons.like.index].hide()
            let index = buttons[state].index
            let name = order[index].find(name => name != state)
            bind(items[index], buttons[name])
        },
        update: text => {
            items[buttons.list.index].text = text
        },
        show: () => {
            runtime.stateManager.set('track', true)
            items.forEach(item => item.show())
        },
        hide: () => {
            runtime.stateManager.set('track', false)
            items.forEach(item => item.hide())
        }
    }
}

const DuplexChannel = context => {
    let webSocket = null
    let activeEditor = ActiveEditor()
    
    const webSocketd = new ws.Server({port: 16363})
    .once('connection', connection => {
        webSocket = connection
        .on('message', message => {
            let data = JSON.parse(message)
            receiveMessage(data.type, data.body)
        })
    })

    const receiveMessage = (type, body) => {
        if (type == 'event') {
            if (body.name == 'ready' && activeEditor) {
                activeEditor.reveal()
                activeEditor = null
            }
            else if (body.name == 'end') {
                runtime.commandManager.execute('next')
            }
            else if (body.name == 'load') {
                runtime.playerBar.update(`${body.data.artist} - ${body.data.name}`)
            }
            else if (body.name == 'lyric') {
                runtime.playerBar.update(body.data)
            }
            else if (['play', 'pause', 'mute', 'unmute'].includes(body.name)) {
                runtime.playerBar.state(body.name)
            }
        }
        else if (type == 'echo') {
            vscode.window.showInformationMessage(body)
        }
    }

    return {
        dispose: () => webSocketd.close(),
        postMessage: (command, data) => {
            if (webSocket) webSocket.send(JSON.stringify({command, data}))
        }
    }
}

const WebviewPanel = context => {
    const panel = vscode.window.createWebviewPanel(
        'neteasemusic', 'NeteaseMusic',
        {preserveFocus: true, viewColumn: vscode.ViewColumn.One},
        {enableScripts: true, retainContextWhenHidden: true}
    )
    panel.webview.html = fs.readFileSync(vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath)

    panel.onDidDispose(() => {
        runtime.commandManager.dispose()
        runtime.duplexChannel.dispose()
        runtime.stateManager.dispose()
        runtime.playerBar.dispose()
        runtime.commandManager = null
        runtime.duplexChannel = null
        runtime.stateManager = null
        runtime.playerBar = null
        runtime.webviewPanel = null
    })

    return {
        dispose: () => panel.dispose()
    }
}

const CommandManager = context => {
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

const runtime = {
    stateManager: null,
    globalStorage: null,
    playerBar: null,
    webviewPanel: null,
    commandManager: null,
    dispose: () => {
        if (runtime.webviewPanel) runtime.webviewPanel.dispose()
    },
    activate: context => {
        if (runtime.webviewPanel) return
        // console.log('global state', context.globalState.get('user'))

        runtime.globalStorage = GlobalStorage(context)
        runtime.stateManager = StateManager(context)
        runtime.playerBar = PlayerBar(context)
        runtime.duplexChannel = DuplexChannel(context)
        runtime.webviewPanel = WebviewPanel(context)
        runtime.commandManager = CommandManager(context)

        api.refresh()
        controller.refresh()
        runtime.stateManager.set('on', true)
    }
}

module.exports = runtime
const api = require('./request.js')
const controller = require('./controller.js')
const interaction = require('./interaction.js')