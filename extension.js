const fs = require('fs')
const path = require('path')
const vscode = require('vscode')

const activate = context => {
    
    let panel

    const postMessage = message => {
        if (!panel) return
        let state = previousState()
        panel.reveal()
        panel.webview.postMessage(message)
        state()
    }

    const previousState = () => {
        let activeTextEditor = vscode.window.activeTextEditor
        if (activeTextEditor)
            return () => vscode.window.showTextDocument(activeTextEditor.document, activeTextEditor.viewColumn, false)
        else
            return () => {}
    }

    const interaction = require('./interaction.js')({postMessage})
    const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath


    // vscode.workspace.onDidChangeTextDocument(e => {
    //     console.log(e)
    // })
    // vscode.window.onDidChangeWindowState(e => {
    //     console.log(e)
    // })

    const addPanelListenr = panel => {
        // panel.onDidChangeViewState(e => {
        //     const panel = e.webviewPanel
        // }, null, context.subscriptions)

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
        let state = previousState()
        panel = vscode.window.createWebviewPanel(
            'neteasemusic', "NetEaseMusic", 
            {preserveFocus: true, viewColumn: vscode.ViewColumn.One}, 
            {enableScripts: true, retainContextWhenHidden: true}
        )
        state()
        panel.webview.html = fs.readFileSync(htmlPath)
        addPanelListenr(panel)
    }))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.playlist',  () => {
        interaction.user.playlist(38050391)
    }))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.pause', () => {
        postMessage({command: 'pause'})
    }))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.play', () => {
        postMessage({command: 'play'})
    }))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.help', () => {
        postMessage({command: 'help'})
    }))


    let timeoutHandler = 0
    let delta = (()=>{
        let lastTrigger = Date.now()
        let delta = 999999
        return function(){
                let now = Date.now()
                delta = now - lastTrigger
                lastTrigger = now
                return delta
        }
    })()

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const key = event.contentChanges[0].text
        if (!key) return

        let velocity = delta()
        clearTimeout(timeoutHandler)
        timeoutHandler = setTimeout(() => {
            _statusBarItem.text = '0 apm'
            postMessage({ command: 'pause' })
        }, 5000)
    }))
    
    let bpCounter = (()=>{
        let counter = 0
        return function(type='p',len=0){
            switch(type){
                case 'a':
                counter+=len
                break;
                case 's':
                counter-=len
                break;
                default:
                return counter;
            }
        }
    })
    vscode.debug.onDidChangeBreakpoints(
        event => {
            if(event.added.length>0){
                bpCounter('a',event.added.length)
            }
            if(event.removed.length>0){
                bpCounter('s',event.removed.length)
            }
            console.log(bpCounter())
        }
    )

}
exports.activate = activate

const deactivate = () => {}
exports.deactivate = deactivate