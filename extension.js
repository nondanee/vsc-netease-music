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

    const setContext = (key, state) => vscode.commands.executeCommand('setContext', `neteasemusic.${key}`, state)
    
    const setState = (state) => {
        if(state == 'off')
            setContext('on', false), setContext('playing', false), setContext('paused', false), setContext('track', false)
        else if (state == 'on')
            setContext('on', true), setContext('playing', false), setContext('paused', false), setContext('track', false)
        else if (state == 'playing')
            setContext('playing', true), setContext('paused', false)
        else if (state == 'paused')
            setContext('playing', false), setContext('paused', true)
    }

    const globalStorage = {
        get: key => context.globalState.get(key),
        set: (key, value) => context.globalState.update(key, value)
    }

    // console.log('global state', context.globalState.get('user'))

    const api = require('./request.js')({globalStorage, setContext})
    const interaction = require('./interaction.js')({postMessage, setState, setContext, api})
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
        
        Object.keys(buttons).forEach(key => {
            let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 163)
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
                if (body.name == 'ended') {
                    interaction.next()
                }
                else if(body.name == 'play') {
                    toolBar.playing(`${body.data.artist} - ${body.data.name}`)
                    toolBar.play()
                }
                else if(body.name == 'pause') {
                    toolBar.playing(`${body.data.artist} - ${body.data.name}`)
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
        'neteasemusic.pause': interaction.pause,
        'neteasemusic.play': interaction.resume,
        'neteasemusic.previous': interaction.previous,
        'neteasemusic.next': interaction.next
    }

    Object.keys(commands).forEach(key => context.subscriptions.push(vscode.commands.registerCommand(key, commands[key])))
    
    // let timeoutHandler = 0
    // let delta = (()=>{
    //     let lastTrigger = Date.now()
    //     let delta = 999999
    //     return function(){
    //             let now = Date.now()
    //             delta = now - lastTrigger
    //             lastTrigger = now
    //             return delta
    //     }
    // })()

    // context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
    //     const key = event.contentChanges[0].text
    //     if (!key) return

    //     let velocity = delta()
    //     clearTimeout(timeoutHandler)
    //     timeoutHandler = setTimeout(() => {
    //         _statusBarItem.text = '0 apm'
    //         postMessage({ command: 'pause' })
    //     }, 5000)
    // }))
    
    // let bpCounter = (()=>{
    //     let counter = 0
    //     return function(type='p',len=0){
    //         switch(type){
    //             case 'a':
    //             counter+=len
    //             break;
    //             case 's':
    //             counter-=len
    //             break;
    //             default:
    //             return counter;
    //         }
    //     }
    // })
    // vscode.debug.onDidChangeBreakpoints(
    //     event => {
    //         if(event.added.length>0){
    //             bpCounter('a',event.added.length)
    //         }
    //         if(event.removed.length>0){
    //             bpCounter('s',event.removed.length)
    //         }
    //         console.log(bpCounter())
    //     }
    // )

}
exports.activate = activate

const deactivate = () => {}
exports.deactivate = deactivate