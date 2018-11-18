// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')
// const axios = require('axios')
// const player = require('./player')
const path = require('path')

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
const activate = context => {

    // axios.get('http://baidu.com')
    // .then(function(res){
    //     console.log(res)
    // })


    // vscode.workspace.onDidChangeTextDocument(e => {
    //     console.log(e)
    // })

    // const onDiskPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'a.mp3'))
    // const mp3Src = onDiskPath.with({ scheme: 'vscode-resource' })

    const panel = vscode.window.createWebviewPanel('neteasemusic', "Netease Music", {preserveFocus: false, viewColumn: vscode.ViewColumn.One}, {
        enableScripts: true,
        retainContextWhenHidden: true
    })
    panel.webview.html = require('./load.html')

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
    
    // // setTimeout(() => {
    // //     panel.dispose()
    // // }, 20000)

    //     // And set its HTML content
    
    panel.onDidChangeViewState(e => {
        const panel = e.webviewPanel
    }, null, context.subscriptions)

    // vscode.window.onDidChangeWindowState(e => {
    //     console.log(e)
    // })

    context.subscriptions.push(vscode.commands.registerCommand('extension.pause', () => {
        if (!panel) {
            return
        }
        postMessage(panel, { command: 'pause' })
    }))

    context.subscriptions.push(vscode.commands.registerCommand('extension.play', () => {
        if (!panel) {
            return
        }
        postMessage(panel, { command: 'play' })
    }))

    const postMessage = (panel, message) => {
        let activeTextEditor = vscode.window.activeTextEditor
        if (activeTextEditor) {
            panel.reveal()
            vscode.window.showTextDocument(activeTextEditor.document, activeTextEditor.viewColumn, false)
        }
        panel.webview.postMessage(message)
    }



    // player.load('C:\\Users\\Nzix\\Desktop\\a.mp3')
    // player.pause()
    // console.log('Congratulations, your extension "vs-netease-music" is now active!')

    // let disposable = vscode.commands.registerCommand('extension.play', function () {
    //     // The code you place here will be executed every time your command is executed
    //     player.resume()
    //     // Display a message box to the user
    //     vscode.window.showInformationMessage('play now')
    // })

    // let disposable2 = vscode.commands.registerCommand('extension.pause', function () {
    //     // The code you place here will be executed every time your command is executed
    //     player.pause()
    //     // Display a message box to the user
    //     vscode.window.showInformationMessage('pause now')
    // })

    // context.subscriptions.push(disposable)
    // context.subscriptions.push(disposable2)

}
exports.activate = activate

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate