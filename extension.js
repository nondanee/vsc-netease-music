const fs = require('fs')
const path = require('path')
const vscode = require('vscode')


const activate = context => {
    
    let panel = null

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
            setContext('on', true)
        else if (state == 'playing')
            setContext('playing', true), setContext('paused', false)
        else if (state == 'paused')
            setContext('playing', false), setContext('paused', true)
    }

    const api = require('./api/request.js')
    const interaction = require('./interaction.js')({postMessage, setState, setContext, api})
    const indexHtmlPath = vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath

    setState('off')
    setContext('logged', false)

    // vscode.workspace.onDidChangeTextDocument(e => {
    //     console.log(e)
    // })
    // vscode.window.onDidChangeWindowState(e => {
    //     console.log(e)
    // })

    const addPanelListenr = () => {
        // panel.onDidChangeViewState(e => {
        //     const panel = e.webviewPanel
        // }, null, context.subscriptions)

        panel.onDidDispose(() => {
            panel = null
            setState('off')
        })

        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text)
                    return
                case 'log':
                    vscode.window.showInformationMessage(message.text)
                    return
            }
        }, undefined, context.subscriptions)
    }

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.start', () => {
        if (panel) return
        setState('on')
        let scene = previousScene()
        panel = vscode.window.createWebviewPanel(
            'neteasemusic', "NetEaseMusic", 
            {preserveFocus: true, viewColumn: vscode.ViewColumn.One}, 
            {enableScripts: true, retainContextWhenHidden: true}
        )
        scene()
        panel.webview.html = fs.readFileSync(indexHtmlPath)
        addPanelListenr()
    }))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.toplist',  () => interaction.toplist()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.playlist.highquality',  () => interaction.playlist.highquality()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.playlist.hot',  () => interaction.playlist.hot()))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.new.song',  () => interaction.new.song()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.new.album',  () => interaction.new.album()))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.user.playlist',  () => interaction.user.playlist(38050391)))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.user.artist',  () => interaction.user.artist()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.user.album',  () => interaction.user.album()))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.recommend.song',  () => interaction.recommend.song()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.recommend.playlist',  () => interaction.recommend.playlist()))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.login',  () => interaction.login()))
    
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.list',  () => interaction.list()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.pause', () => interaction.pause()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.play', () => interaction.resume()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.previous', () => interaction.previous()))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.next', () => interaction.next()))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.help', () => {
        postMessage({command: 'help'})
    }))

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