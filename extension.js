const vscode = require('vscode')
const runtime = require('./runtime.js')

const activate = context => {
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.start', () => runtime.activate(context)))
    context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.stop', () => runtime.dispose()))
}
exports.activate = activate

const deactivate = () => {}
exports.deactivate = deactivate