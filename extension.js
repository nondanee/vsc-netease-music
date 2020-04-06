const vscode = require('vscode')
const runtime = require('./runtime.js')
const package = require('./package.json')

const activate = context => {
	const action = {
		start: () => runtime.activate(context),
		stop: () => runtime.dispose(),
		reset: () => {
			Object.keys(package.contributes.configuration.properties).forEach(key => vscode.workspace.getConfiguration().update(key, undefined, vscode.ConfigurationTarget.Global))
			Object.keys(context.globalState._value).forEach(key => context.globalState.update(key, undefined))
		}
	}
	Object.keys(action).forEach(name => context.subscriptions.push(vscode.commands.registerCommand(`neteasemusic.${name}`, action[name])))
}
exports.activate = activate

const deactivate = () => {}
exports.deactivate = deactivate