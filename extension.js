// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
// const axios = require('axios')
const path = require('path')
const api = require('./api/main.js')
const fs = require('fs')

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
const activate = context => {
    
    // vscode.workspace.onDidChangeTextDocument(e => {
    //     console.log(e)
    // })

    const htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath

    // vscode.window.onDidChangeWindowState(e => {
    //     console.log(e)
    // })

    let panel

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
        panel = vscode.window.createWebviewPanel('neteasemusic', "NetEaseMusic", {preserveFocus: true, viewColumn: vscode.ViewColumn.One}, {
            enableScripts: true,
            retainContextWhenHidden: true
        })
        state()
        panel.webview.html = fs.readFileSync(htmlPath)
        addPanelListenr(panel)
        
        api.getResourcebyId(28138080)
        .then((url) => {
            // postMessage(panel, {command: 'load', data: 'https://dev.aidoru.tk/a.mp3'})
            postMessage(panel, {command: 'load', data: url})
        })
        
    }))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.pause', () => {
        if (!panel) return
        postMessage(panel, {command: 'pause'})
    }))

    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.play', () => {
        if (!panel) return
        postMessage(panel, {command: 'play'})
    }))

    let _statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    let delta = (()=>{
        let lastTrigger = Date.now()
        let delta = 999999
        return function(){
                let now = Date.now()
                delta = now - lastTrigger
                lastTrigger = now
                return delta;
        }
    })()

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(
        event => {
            const key = event.contentChanges[0].text
            if(!key){
                return;
            }
            _statusBarItem.show()
            sbi(delta())
            setTimeout(()=>{_statusBarItem.text='0 apm',postMessage(panel, { command: 'pause' })},5000)
        }
    ))
    
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
        event=>{
            if(event.added.length>0){
                bpCounter('a',event.added.length)
            }
            if(event.removed.length>0){
                bpCounter('s',event.removed.length)
            }
            console.log(bpCounter())
        }
    )

    const postMessage = (panel, message) => {
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

}
exports.activate = activate

// this method is called when your extension is deactivated
const deactivate = () => {}
exports.deactivate = deactivate