const vscode = require('vscode')

let likes = []
let list = []
let random = []
let mode = 0
let index = 0
let dynamic = null

const compact = song => interaction.utility.extract(song, ['id', 'name', 'album', 'artists', 'source'])

const intelligence = (state = {}) => {
	let origin = list, start = state.start || index
	let loading = true, cancelled = false
	const cancel = () => (cancelled = true, loading = false)
	const save = () => Object.entries({origin, start, list}).forEach(entry => runtime.sceneKeeper.save.apply(null, entry))

	index = 0
	list = [origin[start]]

	if (state.origin && state.origin.length) origin = state.origin
	if (state.list && state.list.length) list = state.list, loading = false, runtime.playerBar.show()

	const promise = loading ? api.playlist.intelligence(origin[start].id)
	.then(data => {
		loading = false
		if (cancelled) return
		list = list.concat(data.data.map(item => interaction.utility.format.song(item.songInfo, {type: item.recommended ? 'intelligence' : origin[start].source})))
		save()
	}) : Promise.resolve()

	const exit = () => {
		cancel()
		let current = list[index]
		list = origin, index = start
		origin = [], start = 0
		save()
		let position = list.findIndex(song => song.id === current.id)
		position === -1 ? controller.play() : index = position
	}
	return {loading: () => loading, promise, exit, cancel}
}

const controller = {
	add: (track, radio = false) => {
		if (radio != runtime.stateManager.get('radio')) list = []
		runtime.stateManager.set('radio', radio)
		runtime.sceneKeeper.save('radio', radio)
		if (Array.isArray(track)) {
			list = track.map(compact)
			index = 0
			if (!radio && mode == 3 && !controller.favorite()) controller.mode(0, null, true), (dynamic && dynamic.cancel())
		}
		else {
			index = list.length
			list.splice(index, 0, compact(track))
		}
		let sequence = Array.from(list.keys())
		random = Array.from(list.keys()).map(() => sequence.splice(Math.floor(Math.random() * sequence.length), 1)[0])
		runtime.sceneKeeper.save('list', list)
		runtime.playerBar.show(radio)
	},
	remove: target => {
		list.splice(target, 1)
		random = random.filter(value => value != target).map(value => value < target ? value : value - 1)
		index = target < index ? index - 1 : index
		index = index < list.length ? index : 0
		runtime.sceneKeeper.save('list', list)
		if (list.length == 0) runtime.playerBar.hide()
	},
	previous: () => {
		let mapped = random[(random.indexOf(index) - 1 + random.length) % random.length]
		index = (mode === 2 ? mapped : index - 1)
		controller.play()
	},
	next: auto => {
		let radio = runtime.stateManager.get('radio')
		if (radio && index === list.length - 1) return interaction.recommend.radio()
		let mapped = random[(random.indexOf(index) + 1 + random.length) % random.length]
		index = radio ? index + 1 : ((auto && mode === 1) ? index : (mode === 2 ? mapped : index + 1))
		controller.play()
	},
	mode: (type, state, keep) => {
		if (type === 3 && (controller.favorite() || state)) dynamic = intelligence(state)
		else if (type === 3) return
		else if (mode === 3 && !keep) dynamic && (dynamic.exit(), dynamic = null)
		mode = type
		runtime.sceneKeeper.save('mode', mode)
		runtime.playerBar.state(['loop', 'repeat', 'random', 'intelligent'][mode])
	},
	resume: () => {
		let paused = !runtime.stateManager.get('playing')
		if (paused) runtime.duplexChannel.postMessage('play')
		return paused
	},
	pause: () => {
		let playing = !!runtime.stateManager.get('playing')
		if (playing) runtime.duplexChannel.postMessage('pause')
		return playing
	},
	play: (target, action = true) => {
		index = ((target == null ? index : target) + list.length) % list.length
		if (controller.favorite() && dynamic && mode != 3) controller.mode(3)
		return ((mode === 3 && dynamic) ? dynamic.promise : Promise.resolve())
		.then(() => {
			runtime.sceneKeeper.save('index', index)
			let song = list[index]
			let program = song.source.type === 'djradio'
			return Promise.all(program ? [api.program.url(song.id), {}] : [api.song.url, api.song.lyric].map(call => call(song.id)))
			.then(batch => {
				let url = batch[0].data[0].url
				let lyric = batch[1].lrc ? [batch[1].lrc.lyric, batch[1].tlyric.lyric] : []
				if (!url) {
					vscode.window.showWarningMessage(`无法播放: ${interaction.utility.stringify.song(song)}`)
					controller.remove(index)
					controller.play()
				}
				else {
					if (runtime.preferenceReader.get('CDN.redirect')) url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
					runtime.duplexChannel.postMessage('load', {action, lyric, song: Object.assign({url}, song)})
					runtime.stateManager.set('program', program)
					runtime.playerBar.state(likes.includes(song.id) ? 'like' : 'dislike')
				}
			})
		})
	},
	current: item => {
		let song = list[index]
		if (item.id === song.id && item.source.type === song.source.type) {
			if (!('id' in song.source))
				return true
			else if(item.source.id === song.source.id)
				return true
		}
	},
	favorite: () => list[index] && list[index].source.type === 'playlist' && api.user.favorite(list[index].source.id),
	list: () => {
		let copy = JSON.parse(JSON.stringify(list))
		copy[index].play = true
		return copy
	},
	like: () => {
		let id = list[index].id
		if (likes.includes(id)) return
		api.song.like(id).then(data => {
			if (data.code == 200) {
				likes.push(id)
				runtime.playerBar.state('like')
			}
		})
	},
	dislike: () => {
		let id = list[index].id
		if (!likes.includes(id)) return
		api.song.dislike(id).then(data => {
			if (data.code == 200) {
				likes.splice(likes.indexOf(id), 1)
				runtime.playerBar.state('dislike')
			}
		})
	},
	mute: () => {
		let muted = !!runtime.stateManager.get('muted')
		if (!muted) runtime.duplexChannel.postMessage('mute')
	},
	unmute: () => {
		let muted = !!runtime.stateManager.get('muted')
		if (muted) runtime.duplexChannel.postMessage('unmute')
	},
	volumeChange: value => {
		runtime.duplexChannel.postMessage('volumeChange', {value})
	},
	refresh: () => {
		return api.user.likes().then(data => {
			if (data.ids) likes = data.ids
		})
	}
}

const proxy = new Proxy(controller, {
	get: (target, property) => (...payload) => {
		if (['remove', 'previous', 'next', 'resume', 'pause', 'play', 'current', 'favorite', 'list', 'like', 'dislike'].includes(property)) {
			if (list.length === 0) return property === 'list' ? [] : undefined
			if (['previous', 'next'].includes(property) && dynamic.loading()) return
		}
		return target[property].apply(null, payload)
	}
})

module.exports = proxy
const api = require('./request.js')
const runtime = require('./runtime.js')
const interaction = require('./interaction.js')