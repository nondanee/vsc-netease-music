const fs = require('fs')
const path = require('path')
const vscode = require('vscode')

const activate = context => {
    
    let panel = null
    let toolBar = null

    const postMessage = message => {
        if (!panel) return
        let scene = previousScene()
        if (!panel.visible) panel.reveal()
        panel.webview.postMessage(message)
        scene()
    }

    const previousScene = () => {
        let activeTextEditor = vscode.window.activeTextEditor
        if (activeTextEditor)
            return () => vscode.window.showTextDocument(activeTextEditor.document, activeTextEditor.viewColumn, false)
        else
            return () => {}
    }

    const globalStorage = {
        get: key => context.globalState.get(key),
        set: (key, value) => context.globalState.update(key, value)
    }

    const ContextState = () => {
        const state = {}
        return {
            get: key => state[key],
            set: (key, value) => {state[key] = value, vscode.commands.executeCommand('setContext', `neteasemusic.${key}`, value)}
        }
    }

    const contextState = ContextState()

    const setState = state => {
        let field = {}
        if(state == 'off')
            field = {on: false, playing: false, paused: false, track: false, type: false}  
        else if (state == 'on')
            field = {on: true, playing: false, paused: false, track: false}
        else if (state == 'playing')
            field = {playing: true, paused: false}
        else if (state == 'paused')
            field = {playing: false, paused: true}
        Object.keys(field).forEach(key => contextState.set(key, field[key]))
    }

    // console.log('global state', context.globalState.get('user'))

    const api = require('./request.js')({globalStorage, contextState})
    const controller = require('./controller.js')({postMessage, contextState, api})
    const coding = require('./coding.js')({postMessage, contextState, controller})
    const interaction = require('./interaction.js')({api, controller})
    const indexHtmlPath = vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath

    setState('off')

    // vscode.workspace.onDidChangeTextDocument(e => {
    //     console.log(e)
    // })
    // vscode.window.onDidChangeWindowState(e => {
    //     console.log(e)
    // })

    const ToolBar = () => {
        let buttons = {
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
                icon: ' $(triangle-right) '
            },
            pause: {
                command: 'neteasemusic.pause',
                // icon: ' ❚❚ '
                icon: ' $(primitive-square) '
            },
            list: {
                command: 'neteasemusic.list',
                icon: ''
            }
        }

        let order = ['previous', 'play', 'pause', 'next', 'list'].reverse()
        
        order.forEach((key, index) => {
            let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 163 + index)
            item.text = buttons[key].icon
            item.command = buttons[key].command
            buttons[key].item = item
        })
        
        return {
            dispose: () => {
                Object.keys(buttons).forEach(key => buttons[key].item.dispose())
            },
            play: () => {
                order.forEach(key => buttons[key].item.show())
                buttons.play.item.hide()
            },
            pause: () => {
                order.forEach(key => buttons[key].item.show())
                buttons.pause.item.hide()
            },
            playing: text => {
                buttons.list.item.text = text
            }
        }
    }

    const addPanelListenr = () => {
        
        // panel.onDidChangeViewState(e => {
        //     const panel = e.webviewPanel
        // }, null, context.subscriptions)

        panel.onDidDispose(() => {
            panel = null
            setState('off')
            toolBar.dispose()
            toolBar = null
        })

        panel.webview.onDidReceiveMessage(message => {
            const type = message.type
            const body = message.body
            if (type == 'event') {
                if (body.name == 'end') {
                    controller.next()
                }
                else if(body.name == 'load') {
                    toolBar.playing(`${body.data.artist} - ${body.data.name}`)
                }
                else if(body.name == 'play') {
                    setState('playing')
                    toolBar.play()
                }
                else if(body.name == 'pause') {
                    setState('paused')
                    toolBar.pause()
                }
            }
            else if(type == 'echo') {
                vscode.window.showInformationMessage(message.body)
            }
        }, undefined, context.subscriptions)
    }

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.start', () => {
        if (panel) return
        setState('on')
        let scene = previousScene()
        toolBar = ToolBar()
        panel = vscode.window.createWebviewPanel(
            'neteasemusic', "NetEaseMusic",
            {preserveFocus: true, viewColumn: vscode.ViewColumn.One},
            {enableScripts: true, retainContextWhenHidden: true}
        )
        scene()
        panel.webview.html = fs.readFileSync(indexHtmlPath)
        addPanelListenr()
    }))

    const commands = {
        'neteasemusic.toplist': interaction.toplist,
        'neteasemusic.playlist.highquality': interaction.playlist.highquality,
        'neteasemusic.playlist.hot': interaction.playlist.hot,
        'neteasemusic.new.song': interaction.new.song,
        'neteasemusic.new.album': interaction.new.album,

        'neteasemusic.user.playlist': interaction.user.playlist,
        'neteasemusic.user.artist': interaction.user.artist,
        'neteasemusic.user.album': interaction.user.album,
        'neteasemusic.recommend.song': interaction.recommend.song,
        'neteasemusic.recommend.playlist': interaction.recommend.playlist,

        'neteasemusic.login': interaction.login,
        'neteasemusic.logout': interaction.logout,

        'neteasemusic.list': interaction.list,
        'neteasemusic.pause': controller.pause,
        'neteasemusic.play': controller.resume,
        'neteasemusic.previous': controller.previous,
        'neteasemusic.next': controller.next,

        'neteasemusic.type.on': coding.on,
        'neteasemusic.type.off': coding.off,
    }

    Object.keys(commands).forEach(name => context.subscriptions.push(vscode.commands.registerCommand(name, commands[name])))
    
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(coding.onType))
    context.subscriptions.push(vscode.debug.onDidStartDebugSession(coding.debugOn))
    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(coding.debugOff))

}
exports.activate = activate

const deactivate = () => {}
exports.deactivate = deactivate