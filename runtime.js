const fs = require('fs')
const path = require('path')
const events = require('events')
const vscode = require('vscode')
const mpris = require('mpris-service')

const ActiveEditor = () => {
	let activeTextEditor = vscode.window.activeTextEditor
	return {
		reveal: () => activeTextEditor && (vscode.window.showTextDocument(activeTextEditor.document, activeTextEditor.viewColumn, false), activeTextEditor = null)
	}
}

const GlobalStorage = context => {
	return {
		get: key => JSON.parse(context.globalState.get(key) || 'null'),
		set: (key, value) => context.globalState.update(key, JSON.stringify(value))
	}
}

const PreferenceReader = context => {
	let preference = {}
	return {
		get: key => key in preference ? preference[key] : preference[key] = vscode.workspace.getConfiguration().get(`NeteaseMusic.${key}`),
		dispose: () => preference = null
	}
}

const StateManager = context => {
	let state = {}
	return {
		get: key => state[key],
		set: (key, value) => vscode.commands.executeCommand('setContext', `neteasemusic.${key}`, state[key] = value),
		dispose: () => (Object.keys(state).forEach(key => vscode.commands.executeCommand('setContext', `neteasemusic.${key}`, undefined)), state = null)
	}
}

const PlayerBar = context => {
	let color = [255, 255, 255]
	const buttons = {
		previous: {
			command: 'neteasemusic.previous',
			icon: '$(chevron-left)',
			title: '上一首',
			state: { radio: false }
		},
		next: {
			command: 'neteasemusic.next',
			icon: '$(chevron-right)',
			title: '下一首'
		},
		// /* button name indicates the next state
		repeat: {
			command: 'neteasemusic.mode.loop',
			icon: '$(sync)',
			title: '播放模式: 循环播放',
			state: { mode: 0, radio: false }
		},
		random: {
			command: 'neteasemusic.mode.repeat',
			icon: '$(pin)',
			title: '播放模式: 单曲循环',
			state: { mode: 1, radio: false }
		},
		intelligent: {
			command: 'neteasemusic.mode.random', // action to intelligent or loop
			icon: '$(question)',
			title: '播放模式: 随机播放',
			state: { mode: 2, radio: false }
		},
		loop: {
			command: 'neteasemusic.mode.intelligent',
			icon: '$(pulse)',
			title: '播放模式: 心动模式',
			state: { mode: 3, radio: false }
		},
		// */
		play: {
			command: 'neteasemusic.play',
			icon: '$(play)',
			title: '播放',
			state: { playing: false }
		},
		pause: {
			command: 'neteasemusic.pause',
			icon: '$(primitive-square)', // $(debug-pause) cannot override color
			title: '暂停',
			state: { playing: true }
		},
		trash: {
			command: 'neteasemusic.trash',
			icon: '$(trash)',
			title: '不喜欢',
			state: { radio: true }
		},
		like: {
			command: 'neteasemusic.like',
			icon: '$(heart)',
			title: '红心',
			ghost: true,
			state: { liked: false }
		},
		dislike: {
			command: 'neteasemusic.dislike',
			icon: '$(heart)',
			title: '取消红心',
			state: { liked: true }
		},
		mute: {
			command: 'neteasemusic.mute',
			icon: '$(unmute)',
			title: '静音',
			state: { muted: false }
		},
		unmute: {
			command: 'neteasemusic.unmute',
			icon: '$(mute)',
			title: '取消静音',
			ghost: true,
			state: { muted: true }
		},
		volume: {
			command: 'neteasemusic.volume',
			text: '100',
			title: '音量调节'
		},
		list: {
			command: 'neteasemusic.list',
		},
		more: {
			command: 'neteasemusic.more',
			icon: '$(kebab-horizontal)',
			title: '更多操作'
		}
	}

	const attach = (item, button) => {
		item.text = button.icon || button.text || ''
		item.command = button.command
		item.tooltip = button.title || undefined
		item.color = button.ghost ? `rgba(${color.concat(0.5)})` : undefined
	}

	const order = [['list'], ['trash'], ['like', 'dislike'], ['previous'], ['play', 'pause'], ['next'], ['repeat', 'random', 'intelligent', 'loop'], ['mute', 'unmute'], ['volume'], ['more']].reverse()

	const items = order.map((group, index) => {
		group.forEach(name => buttons[name].index = index)
		const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 163 + index)
		attach(item, buttons[group[0]])
		return item
	})

	const update = () => {
		order.forEach((group, index) => {
			const item = items[index]
			const target = group.find(name => {
				const { state } = buttons[name] || {}
				if (!state) return true
				return Object.entries(state).every(([key, value]) => runtime.stateManager.get(key) === value)
			})
			if (target) {
				attach(item, buttons[target])
				item.show()
			} else {
				item.hide()
			}
		})
	}

	const translation = {
		like: { liked: true },
		dislike: { liked: false },
		play: { playing: true },
		pause: { playing: false },
		loop: { mode: 0 },
		repeat: { mode: 1 },
		random: { mode: 2 },
		intelligent: { mode: 3 },
	}

	const setState = state => Object.entries(state).forEach(([key, value]) => runtime.stateManager.set(key, value))

	return {
		dispose: () => items.forEach(item => item.dispose()),
		state: state => {
			setState(translation[state] || {})
			update()
		},
		text: text => {
			buttons.list.text = text
			update()
		},
		volume: data => {
			const { muted, value } = data
			setState({ muted })
			buttons.volume.ghost = muted
			buttons.volume.text = parseInt(value * 100).toString()
			update()
		},
		show: radio => {
			setState({ track: true, playing: false, radio })
			update()
		},
		hide: () => {
			setState({ track: false })
			items.forEach(item => item.hide())
		},
		color: value => {
			value = interaction.utility.format.color(value)
			if (value.length !== 3) return
			color = value
			update()
		}
	}
}

const MprisBridge = context => {
	const { displayName } = require('./package')
	let player = null

	try {
		player = mpris({
			name: displayName.replace(/\s/g, ''),
			identity: displayName,
			supportedMimeTypes: ['audio/mpeg', 'audio/flac'],
			supportedInterfaces: ['player']
		})
	}
	catch(error) {
		return new Proxy({}, { get: () => () => null })
	}

	player.getPosition = () => 0 // TODO

	const action = {
		quit: () => runtime.dispose(),
		next: () => runtime.commandManager.execute('next'),
		previous: () => runtime.commandManager.execute('previous'),
		pause: () => runtime.commandManager.execute('pause'),
		playpause: () => runtime.commandManager.execute('auto.play.pause'),
		play: () => runtime.commandManager.execute('play'),
		volume: value => controller.volumeChange(value)
		// seek: () => null, // TODO
	}

	Object.keys(action).forEach(event => player.on(event, action[event]))

	return {
		sync: song => {
			player.metadata = {
				'mpris:trackid': player.objectPath('track/' + song.id),
				'mpris:length': parseInt(song.duration * 1e3),
				'mpris:artUrl': song.cover + '?param=200y200' || 'file:///dev/null',
				'xesam:title': song.name || '未知歌曲',
				'xesam:album': song.album.name || '未知专辑',
				'xesam:artist': song.artists.map(artist => artist.name)
			}
			player.canGoPrevious = song.source.type !== 'radio'
		},
		state: state => {
			if (['play', 'pause'].includes(state)) {
				player.playbackStatus = { play: 'Playing', pause: 'Paused' }[state]
			}
		},
		volume: value => player.volume = value,
		dispose: () => {
			player._bus.disconnect()
			player = null
		}
	}
}

const DuplexChannel = context => {
	let activeEditor = ActiveEditor()

	const logger = song => {
		const translation = { playlist: 'list', artist: 'artist', album: 'album' }
		const output = {
			id: song.id,
			type: 'song',
			wifi: 0,
			download: 0,
			time: parseInt(song.duration),
			end: (runtime.stateManager.get('mode') == 1 ? 'playend' : 'ui')
		}
		if (translation[song.source.type]) {
			output.source = translation[song.source.type]
			output.sourceid = song.source.id
		}
		return output
	}

	/**
	 * Websocket
	 */
	// const server = new (require('ws')).Server({port: 16363, host: '127.0.0.1'})
	// const connection = new Promise(resolve => server.once('connection', connection => resolve(connection)))
	// connection.then(webSocket => webSocket.on('message', receiveMessage))
	// const postMessage = (command, data) => connection.then(webSocket => webSocket.send(JSON.stringify({command, data})))

	/**
	 * Long Polling
	 */
	// const caller = new events.EventEmitter()
	// const queue = []

	// const server = require('http').createServer((req, res) => {
	// 	if (req.url != '/') return
	// 	new Promise(resolve => {
	// 		let timer
	// 		if (queue.length > 0) return resolve(queue.shift())
	// 		const shift = () => {
	// 			caller.removeListener('message', shift)
	// 			clearTimeout(timer)
	// 			resolve(queue.shift())
	// 		}
	// 		caller.once('message', shift)
	// 		timer = setTimeout(shift, 5000)
	// 	})
	// 	.then(message => {
	// 		res.writeHead(message ? 200 : 204, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'})
	// 		res.end(message ? JSON.stringify(message) : undefined)
	// 	})
	// })
	// .listen(16363, '127.0.0.1')
	// const postMessage = (command, data) => (queue.push({command, data}), caller.emit('message'))

	/**
	 * Server-Sent Events
	 */
	// const caller = new events.EventEmitter()
	// const server = require('http').createServer().listen(16363, '127.0.0.1')
	// server.on('request', (req, res) => {
	// 	if (req.url === '/sender') {
	// 		res.writeHead(200, {'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*'}), res.write(': \n\n')
	// 		const listener = message => res.write('data: ' + JSON.stringify(message) + '\n\n')
	// 		caller.on('message', listener)
	// 		res.once('close', () => caller.removeListener('message', listener))
	// 	}
	// 	else if (req.url === '/receiver') {
	// 		new Promise((resolve, reject) => {
	// 			const chunks = []
	// 			req
	// 			.on('data', chunk => chunks.push(chunk))
	// 			.on('end', () => resolve(Buffer.concat(chunks).toString()))
	// 			.on('error', error => reject(error))
	// 		})
	// 		.then(receiveMessage)
	// 		.then(() => 204).catch(() => 400)
	// 		.then(code => (res.writeHead(code, {'Access-Control-Allow-Origin': '*'}), res.end()))
	// 	}
	// })
	// const postMessage = (command, data) => caller.emit('message', {command, data})

	const receiveMessage = message => {
		message = typeof(message) === 'object' ? message : JSON.parse(message)
		const { type, body } = message
		if (type == 'event') {
			if (body.name == 'ready') {
				runtime.event.emit('ready')
				activeEditor.reveal()
				activeEditor = null
			}
			else if (body.name == 'end') {
				controller.next(true)
				const song = body.data
				if (song.source.type != 'djradio') api.song.log(logger(song))
			}
			else if (body.name == 'load') {
				const song = body.data
				const program = song.source.type === 'djradio'
				const artist = interaction.utility.stringify.artist(song), album = song.album.name
				const playing = [program ? album : artist, song.name].join(' - ')
				const message = `正在播放: ${playing}`
				if (runtime.preferenceReader.get('Popup.appearance') === 'always') vscode.window.showInformationMessage(message)
				runtime.playerBar.update(playing)
				runtime.mprisBridge.sync(song)
				if (song.source.type == 'djradio') api.program.listen(song.id)
			}
			else if (body.name == 'lyric') {
				runtime.playerBar.text(body.data)
			}
			else if (body.name == 'volume') {
				runtime.playerBar.volume(body.data)
				runtime.mprisBridge.volume(body.data.value)
				runtime.globalStorage.set('muted', body.data.muted)
				runtime.globalStorage.set('volume', body.data.value)
			}
			else if (['play', 'pause'].includes(body.name)) {
				runtime.playerBar.state(body.name)
				runtime.mprisBridge.state(body.name)
			}
			else if (body.name == 'trash') {
				controller.trash(body.data)
			}
			else if (body.name == 'error') {
				const message = `无法播放: ${interaction.utility.stringify.song(body.data)}`
				if (runtime.preferenceReader.get('Popup.appearance') !== 'never') vscode.window.showWarningMessage(message)
				controller.remove()
				controller.play()
			}
			else if (body.name == 'theme') {
				runtime.playerBar.color(body.data)
			}
		}
		else if (type == 'command') {
			controller[body.action]()
		}
		else if (type == 'echo') {
			vscode.window.showInformationMessage(body.toString())
		}
	}

	const postMessage = (command, data) => runtime.webviewPanel.panel.webview.postMessage({ command, data })
	runtime.webviewPanel.panel.webview.onDidReceiveMessage(receiveMessage, undefined, context.subscriptions)

	return {
		// dispose: () => server.close(),
		postMessage,
		receiveMessage
	}
}

const AssistServer = context => {
	const urlParse = require('url').parse
	const queryify = require('querystring').stringify
	const queryParse = require('querystring').parse

	const state = { song: {}, program: {} }
	const mediaResponse = async (type, id, headers) => {
		const cache = (state[type] || {})[id]
		if (cache) {
			const response = await api.request('GET', cache, headers)
			if (response.statusCode < 300) return response
			delete state[type][id]
			return mediaResponse(type, id, headers)
		}

		const body = await api[type].url(id)
		let { url } = ((body || {}).data || [])[0] || {}
		if (!url) throw Error('empty')
		if (runtime.preferenceReader.get('CDN.redirect')) {
			url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
		}
		state[type][id] = url
		return mediaResponse(type, id, headers)
	}

	const server = require('http').createServer()
	.on('request', (req, res) => {
		if (req.method === 'option') return res.end()
		const url = urlParse(req.url)
		const query = queryParse(url.query)
		const headers = Object.assign({}, req.headers)
		
		const [, type, id] = (url.pathname.match(/^\/(song|program)\/(\d+)$/) || [])
		if (id) {
			['host', 'referer'].filter(key => key in headers).forEach(key => delete headers[key])
			mediaResponse(type, id, headers)
			.then(response => (res.writeHead(response.statusCode, response.headers), response.pipe(res)))
			.catch(error => ['empty'].includes(error.message) ? (res.writeHead(404, { 'content-type': 'audio/*' }), res.end()) : error)
		}
		else if (url.pathname === '/song/file' && query.path) {
			let file = decodeURIComponent(urlParse(query.path).pathname), meta = {}
			file = process.platform === 'win32' ? file.replace(/^\//, '') : file
			try {meta = fs.statSync(file)} 
			catch(error) {return (res.writeHead(404, { 'content-type': 'audio/*' }), res.end())}
			let [start, end] = (headers['range'] || '').split('-')
			start = parseInt(start) || 0
			end = parseInt(end) || Infinity
			const bytes = `bytes ${start}-${end === Infinity ? meta.size - 1 : end}/${meta.size}`
			res.writeHead(headers['range'] ? 206 : 200, { 'content-type': 'audio/*', 'content-range': headers['range'] ? bytes : null })
			fs.createReadStream(file, { start, end }).pipe(res)
		}
		else {
			res.socket.destroy()
		}
	})
	.listen(16363, '127.0.0.1')

	return {
		dispose: () => server.close()
	}
}

const WebviewPanel = context => {
	// const panel = vscode.env.openExternal(vscode.Uri.file(path.join(context.extensionPath, 'index.html')))
	const panel = vscode.window.createWebviewPanel(
		'neteasemusic', 'NeteaseMusic',
		{ preserveFocus: true, viewColumn: vscode.ViewColumn.One },
		{ enableScripts: true, retainContextWhenHidden: true, portMapping: [{ webviewPort: 16363, extensionHostPort: 16363 }] }
	)
	panel.iconPath = ['light', 'dark'].reduce((uri, theme) => Object.assign(uri, { [theme]: vscode.Uri.file(path.join(context.extensionPath, `${theme}.svg`)) }), {})
	panel.webview.html =
		fs.readFileSync(vscode.Uri.file(path.join(context.extensionPath, 'index.html')).fsPath, 'utf-8')
		.replace('<base>', `<base href="${panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, '/')))}">`)

	if (runtime.preferenceReader.get('PIN.auto')) vscode.commands.executeCommand('workbench.action.pinEditor')
	// panel.webview.onDidReceiveMessage(runtime.duplexChannel.receiveMessage, undefined, context.subscriptions)
	panel.onDidDispose(() => runtime.event.emit('suspend'), null, context.subscriptions)

	return {
		panel,
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
		'user.djradio': interaction.user.djradio,
		'user.record': interaction.user.record,
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
		'trash': controller.trash,

		'mute': controller.mute,
		'unmute': controller.unmute,
		'volume': controller.volumeChange,

		'auto.mute.unmute': () => controller[runtime.stateManager.get('muted') ? 'unmute' : 'mute'](),
		'auto.play.pause': () => controller[runtime.stateManager.get('playing') ? 'pause' : 'resume'](),

		'mode.loop': () => controller.mode(1),
		'mode.repeat': () => controller.mode(2),
		'mode.random': () => controller.mode(controller.favorite() ? 3 : 0),
		'mode.intelligent': () => controller.mode(0)
	}

	const registration = Object.keys(commands).map(name => vscode.commands.registerCommand(`neteasemusic.${name}`, commands[name]))
	registration.forEach(command => context.subscriptions.push(command))

	return {
		execute: name => name in commands && commands[name].call(),
		dispose: () => registration.forEach(command => command.dispose())
	}
}

const runtime = {
	event: null,
	stateManager: null,
	globalStorage: null,
	preferenceReader: null,
	playerBar: null,
	assistServer: null,
	webviewPanel: null,
	duplexChannel: null,
	commandManager: null,
	dispose: () => {
		Object.keys(runtime).filter(key => typeof runtime[key] != 'function' && runtime[key])
		.forEach(key => {
			if (typeof runtime[key].dispose === 'function') runtime[key].dispose()
			runtime[key] = null
		})
	},
	activate: context => {
		if (runtime.webviewPanel) return

		runtime.event = new events.EventEmitter()
		runtime.stateManager = StateManager(context)
		runtime.globalStorage = GlobalStorage(context)
		runtime.preferenceReader = PreferenceReader(context)
		runtime.playerBar = PlayerBar(context)
		runtime.mprisBridge = MprisBridge(context)
		// runtime.duplexChannel = DuplexChannel(context)
		runtime.assistServer = AssistServer(context)
		runtime.webviewPanel = WebviewPanel(context)
		runtime.duplexChannel = DuplexChannel(context)
		runtime.commandManager = CommandManager(context)

		process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = runtime.preferenceReader.get('SSL.strict') ? undefined : 0

		runtime.event.once('ready', () =>
			Promise.all([api, controller].map(component => component.refresh()))
			.then(() => controller.restore())
			.then(() => runtime.stateManager.set('on', true))
		)
		runtime.event.once('suspend', () => runtime.dispose())
	}
}

module.exports = runtime
const api = require('./request.js')
const controller = require('./controller.js')
const interaction = require('./interaction.js')
