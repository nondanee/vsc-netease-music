const vscode = require('vscode')

let likes = []
let list = []
let random = []
let mode = 0
let index = 0
let dynamic = null

const compact = song => interaction.utility.extract(song, ['id', 'name', 'cover', 'album', 'artists', 'source'])

const intelligence = (history = {}) => {
	let origin = list, start = history.start == null ? index : history.start
	let loading = true, cancelled = false
	const save = object => Object.entries(object).forEach(entry => runtime.globalStorage.set.apply(null, entry))
	const cancel = () => (cancelled = true, loading = false, save({origin: [], start: 0}))

	index = 0
	list = [origin[start]]

	if ((history.origin || []).length) origin = history.origin
	if ((history.list || []).length) list = history.list, loading = false, runtime.playerBar.show()

	const promise = loading ? api.playlist.intelligence(origin[start].id).then(data => {
		loading = false
		if (cancelled) return
		list = list.concat(data.data.map(item => interaction.utility.format.song(item.songInfo, item.recommended ? {type: 'intelligence'} : origin[start].source)))
		save({origin, start, list, intelligence: true})
	}) : Promise.resolve()

	const exit = () => {
		cancel()
		const current = list[index]
		list = origin, index = start
		save({list, intelligence: false})
		const position = list.findIndex(song => song.id === current.id)
		position === -1 ? controller.play() : index = position
	}
	return {loading: () => loading, promise, exit, cancel}
}

const controller = {
	add: (track, radio = false) => {
		if (radio !== !!runtime.stateManager.get('radio')) list = []
		runtime.stateManager.set('radio', radio)
		runtime.globalStorage.set('radio', radio)
		if (Array.isArray(track)) {
			list = track.map(compact)
			index = 0
			if (!radio && mode == 3 && !controller.favorite()) controller.mode(0, {keep: true})
		}
		else {
			index = list.length
			list.splice(index, 0, compact(track))
		}
		const sequence = Array.from(list.keys())
		random = Array.from(list.keys()).map(() => sequence.splice(Math.floor(Math.random() * sequence.length), 1)[0])
		runtime.globalStorage.set('list', list)
		runtime.playerBar.show(radio)
	},
	remove: target => {
		target = target == null ? index : target
		list.splice(target, 1)
		random = random.filter(value => value != target).map(value => value < target ? value : value - 1)
		index = target < index ? index - 1 : index
		index = index < list.length ? index : 0
		runtime.globalStorage.set('list', list)
		if (list.length === 0) (runtime.playerBar.hide(), runtime.duplexChannel.postMessage('stop'))
	},
	previous: () => {
		const mapped = random[(random.indexOf(index) - 1 + random.length) % random.length]
		index = (mode === 2 ? mapped : index - 1)
		controller.play()
	},
	next: auto => {
		const radio = runtime.stateManager.get('radio')
		if (radio && index === list.length - 1) return interaction.recommend.radio()
		const mapped = random[(random.indexOf(index) + 1 + random.length) % random.length]
		index = radio ? index + 1 : ((auto && mode === 1) ? index : (mode === 2 ? mapped : index + 1))
		controller.play()
	},
	mode: (type, intelligent = {}) => {
		if (type === 3) { // enter
			if (!intelligent.history && !controller.favorite()) return
			dynamic = intelligence(intelligent.history)
		}
		else if (mode === 3) { // leave
			dynamic && dynamic[intelligent.keep ? 'cancel' : 'exit']()
			dynamic = null
		}
		mode = type
		runtime.globalStorage.set('mode', mode)
		runtime.playerBar.state(['loop', 'repeat', 'random', 'intelligent'][mode])
	},
	resume: () => {
		const paused = !runtime.stateManager.get('playing')
		if (paused) runtime.duplexChannel.postMessage('play')
		return paused
	},
	pause: () => {
		const playing = !!runtime.stateManager.get('playing')
		if (playing) runtime.duplexChannel.postMessage('pause')
		return playing
	},
	play: (target, action = true, potential = false) => {
		index = ((target == null ? index : target) + list.length) % list.length
		if (potential && controller.favorite() && runtime.globalStorage.get('intelligence')) controller.mode(3)
		return ((mode === 3 && dynamic) ? dynamic.promise : Promise.resolve())
		.then(() => {
			runtime.globalStorage.set('index', index)
			const song = list[index]
			const program = song.source.type === 'djradio'
			return Promise.resolve(program ? {} : api.song.lyric(song.id))
			.then(data => {
				const lyric = data.lrc ? [data.lrc.lyric, data.tlyric.lyric] : []
				runtime.duplexChannel.postMessage('load', {action, lyric, song})
				runtime.stateManager.set('program', program)
				runtime.playerBar.state(likes.includes(song.id) ? 'like' : 'dislike')
			})
		})
	},
	current: item => {
		const song = list[index]
		if (item.id === song.id && item.source.type === song.source.type) {
			if (!('id' in song.source))
				return true
			else if(item.source.id === song.source.id)
				return true
		}
	},
	favorite: () => list[index] && list[index].source.type === 'playlist' && api.user.favorite(list[index].source.id),
	list: () => {
		const copy = JSON.parse(JSON.stringify(list))
		copy[index].play = true
		return copy
	},
	trash: song => {
		if (!song || !song.id) return runtime.duplexChannel.postMessage('trash') // require currentTime callback
		api.song.trash(song.id, song.time).then(() => {
			const last = index === list.length - 1
			if (last)
				interaction.recommend.radio()
			else
				controller.remove(), controller.play()
		})
	},
	like: () => {
		const {id} = list[index]
		if (likes.includes(id)) return
		api.song.like(id).then(data => {
			if (data.code == 200) {
				likes.push(id)
				runtime.playerBar.state('like')
			}
		})
	},
	dislike: () => {
		const {id} = list[index]
		if (!likes.includes(id)) return
		api.song.dislike(id).then(data => {
			if (data.code == 200) {
				likes.splice(likes.indexOf(id), 1)
				runtime.playerBar.state('dislike')
			}
		})
	},
	mute: () => {
		const muted = !!runtime.stateManager.get('muted')
		if (!muted) runtime.duplexChannel.postMessage('mute')
	},
	unmute: () => {
		const muted = !!runtime.stateManager.get('muted')
		if (muted) runtime.duplexChannel.postMessage('unmute')
	},
	volumeChange: value => runtime.duplexChannel.postMessage('volumeChange', {value}),
	refresh: () => api.user.likes().then(data => ((likes = data.ids ? data.ids : []), runtime.playerBar.state(likes.includes((list[index] || {}).id) ? 'like' : 'dislike'))),
	restore: () => {
		list = [], random = [], index = 0, mode = 0, dynamic = null
		const history = ['list', 'origin', 'index', 'start', 'mode', 'volume', 'muted', 'radio'].reduce((result, key) => Object.assign(result, {[key]: runtime.globalStorage.get(key)}), {})
		controller.volumeChange(history.volume || 1)
		if (history.muted) controller.mute()
		if (history.mode === 3) controller.mode(3, {history})
		else if ((history.list || []).length) controller.add(history.list, history.radio || false), controller.mode(history.mode || 0)
		proxy.play(history.index || 0, false)
	}
}

const proxy = new Proxy(controller, {
	get: (target, property) => (...payload) => {
		if (['remove', 'previous', 'next', 'resume', 'pause', 'play', 'current', 'favorite', 'list', 'like', 'dislike'].includes(property)) {
			if (list.length === 0) return property === 'list' ? [] : undefined
			if (['previous', 'next'].includes(property) && (dynamic && dynamic.loading())) return
			if (property === 'previous' && !!runtime.stateManager.get('radio')) return
		}
		return target[property].apply(null, payload)
	}
})

module.exports = proxy
const api = require('./request.js')
const runtime = require('./runtime.js')
const interaction = require('./interaction.js')