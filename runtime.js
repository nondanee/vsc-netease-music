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
		set: (key, value) => context.globalState.update(key, value),
		dispose: () => {}
	}
}

const SceneKeeper = context => {
	return {
		save: (key, value) => {

		},
		restore: () => {
			
		}
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
			vscode.commands.executeCommand('setContext', `neteasemusic.${key}`, undefined)
		)
	}
}

const PlayerBar = context => {
	const buttons = {
		previous: {
			command: 'neteasemusic.previous',
			icon: ' $(chevron-left) ',
			title: '上一首'
		},
		next: {
			command: 'neteasemusic.next',
			icon: ' $(chevron-right) ',
			title: '下一首'
		},
		repeat: {
			command: 'neteasemusic.mode.loop',
			icon: ' $(sync) ',
			title: '播放模式: 循环播放',
			state: {mode: 0}
		},
		random: {
			command: 'neteasemusic.mode.repeat',
			icon: ' $(pin) ',
			title: '播放模式: 单曲循环',
			state: {mode: 1}
		},
		loop: {
			command: 'neteasemusic.mode.random',
			icon: ' $(light-bulb) ',
			title: '播放模式: 随机播放',
			state: {mode: 2}
		},
		play: {
			command: 'neteasemusic.play',
			// icon: '▶'
			icon: ' $(triangle-right) ',
			title: '播放',
			state: {playing: false}
		},
		pause: {
			command: 'neteasemusic.pause',
			// icon: ' ❚❚ '
			icon: ' $(primitive-square) ',
			title: '暂停',
			state: {playing: true}
		},
		like: {
			command: 'neteasemusic.like',
			icon: ' $(heart) ',
			title: '红心',
			color: 'rgba(255,255,255,0.5)',
			state: {liked: false}
		},
		dislike: {
			command: 'neteasemusic.dislike',
			icon: ' $(heart) ',
			title: '取消红心',
			state: {liked: true}
		},
		mute: {
			command: 'neteasemusic.mute',
			icon: '$(unmute)',
			title: '静音',
			state: {muted: false}
		},
		unmute: {
			command: 'neteasemusic.unmute',
			icon: '$(mute)',
			title: '取消静音',
			color: 'rgba(255,255,255,0.5)',
			state: {muted: true}
		},
		volume: {
			command: 'neteasemusic.volume',
			icon: '100',
			title: '音量调节'
		},
		list: {
			command: 'neteasemusic.list',
			icon: ''
		},
		more: {
			command: 'neteasemusic.more',
			icon: '$(kebab-horizontal)',
			title: '更多操作'
		}
	}

	const bind = (item, button) => {
		item.color = button.color || undefined
		item.text = button.icon
		item.command = button.command
		item.tooltip = button.title || undefined
		if (button.state) Object.keys(button.state).forEach(key => runtime.stateManager.set(key, button.state[key]))
	}

	const order = [['list'], ['like', 'dislike'], ['previous'], ['play', 'pause'], ['next'], ['repeat', 'random', 'loop'], ['mute', 'unmute'], ['volume'], ['more']].reverse()
	
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
			if (state.includes('like')) api.user.logged() ? items[buttons.like.index].show() : items[buttons.like.index].hide()
			let index = buttons[state].index
			let name = order[index][(order[index].indexOf(state) + 1) % order[index].length]
			bind(items[index], buttons[name])
		},
		update: text => {
			items[buttons.list.index].text = text
		},
		volume: state => {
			bind(items[buttons.mute.index], buttons[(state.muted ? 'unmute' : 'mute')])
			items[buttons.volume.index].color = items[buttons.mute.index].color
			items[buttons.volume.index].text = `${state.value.toFixed(2) * 100}`
		},
		show: radio => {
			runtime.stateManager.set('track', true)
			items.forEach(item => item.show())
			if (radio) ['previous', 'repeat'].map(name => buttons[name].index).forEach(index => items[index].hide())
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
		.on('close', () => runtime.dispose())
	})

	const receiveMessage = (type, body) => {
		if (type == 'event') {
			if (body.name == 'ready' && activeEditor) {
				activeEditor.reveal()
				activeEditor = null
			}
			else if (body.name == 'end') {
				controller.next(true)
			}
			else if (body.name == 'load') {
				let playing = `${interaction.utility.stringify.song(body.data)}`
				vscode.window.showInformationMessage(`正在播放: ${playing}`)
				runtime.playerBar.update(playing)
				api.song.log(body.data.id)
			}
			else if (body.name == 'lyric') {
				runtime.playerBar.update(body.data)
			}
			else if (body.name == 'volume') {
				runtime.playerBar.volume(body.data)
			}
			else if (['play', 'pause'].includes(body.name)) {
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
	// const panel = vscode.env.openExternal(vscode.Uri.file(path.join(context.extensionPath, 'index.html')))
	const panel = vscode.window.createWebviewPanel(
		'neteasemusic', 'NeteaseMusic',
		{preserveFocus: true, viewColumn: vscode.ViewColumn.One},
		{enableScripts: true, retainContextWhenHidden: true}
	)
	panel.webview.html = fs.readFileSync(vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath)
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
		'recommend.radio': interaction.recommend.radio,

		'login': interaction.login,
		'login.cookie': interaction.clone,
		'logout': interaction.logout,
		'sign': interaction.sign,

		'more': interaction.more,
		'list': interaction.list.show,
		'list.edit': interaction.list.edit,
		'play': controller.resume,
		'pause': controller.pause,
		'previous': controller.previous,
		'next': controller.next,

		'like': controller.like,
		'dislike': controller.dislike,

		'mute': controller.mute,
		'unmute': controller.unmute,
		'volume': controller.volumeChange,

		'auto.mute.unmute': () => controller[runtime.stateManager.get('muted') ? 'unmute' : 'mute'](),
		'auto.play.pause': () => controller[runtime.stateManager.get('playing') ? 'pause' : 'resume'](),

		'mode.loop': () => controller.mode(1),
		'mode.repeat': () => controller.mode(2),
		'mode.random': () => controller.mode(0)
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
	duplexChannel: null,
	commandManager: null,
	dispose: () => {
		Object.keys(runtime).filter(key => typeof runtime[key] != 'function' && runtime[key])
		.forEach(key => {
			runtime[key].dispose()
			runtime[key] = null
		})
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