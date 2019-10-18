const vscode = require('vscode')
const runtime = require('./runtime.js')
const package = require('./package.json')

const activate = context => {
	context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.start', () => runtime.activate(context)))
	context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.stop', () => runtime.dispose()))
	context.subscriptions.push(vscode.commands.registerCommand('neteasemusic.reset', () => (
		Object.keys(package.contributes.configuration.properties).forEach(key => vscode.workspace.getConfiguration().update(key, undefined, vscode.ConfigurationTarget.Global)),
		Object.keys(context.globalState._value).forEach(key => context.globalState.update(key, undefined))
	)))
}
exports.activate = activate

const deactivate = () => {}
exports.deactivate = deactivate