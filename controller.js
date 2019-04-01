const vscode = require('vscode')

let likes = []
let list = []
let random = []
let mode = 0
let index = 0

const compact = song => interaction.utility.extract(song, ['id', 'name', 'album', 'artists', 'source'])

const controller = {
	add: (track, radio = false) => {
		if (radio != runtime.stateManager.get('radio')) list = []
		runtime.stateManager.set('radio', radio)
		if (Array.isArray(track)) {
			list = track.map(compact)
			index = 0
		}
		else {
			index = list.length
			list.splice(index, 0, compact(track))
		}
		let sequence = list.map((_, index) => index)
		random = Array.apply(0, {length: sequence.length}).map(() => sequence.splice(Math.floor(Math.random() * sequence.length), 1)[0])
		runtime.playerBar.show(radio)
	},
	remove: target => {
		list.splice(target, 1)
		random = random.filter(value => value != target).map(value => value < target ? value : value - 1)
		index = index < list.length ? index : 0
		if (list.length == 0) runtime.playerBar.hide()
	},
	previous: () => {
		if (list.length == 0) return
		let mapped = random[(random.indexOf(index) - 1 + random.length) % random.length]
		index = (mode === 2 ? mapped : index - 1)
		controller.play()
	},
	next: auto => {
		if (list.length == 0) return
		if (runtime.stateManager.get('radio') && index === list.length - 1) return interaction.recommend.radio()
		let mapped = random[(random.indexOf(index) + 1 + random.length) % random.length]
		index = (auto && mode == 1) ? index : (mode === 2 ? mapped : index + 1)
		controller.play()
	},
	mode: type => {
		mode = type
		runtime.playerBar.state(['loop', 'repeat', 'random'][type])
	},
	resume: () => {
		if (list.length == 0) return
		let paused = !runtime.stateManager.get('playing')
		if (paused) runtime.duplexChannel.postMessage('play')
		return paused
	},
	pause: () => {
		if (list.length == 0) return
		let playing = !!runtime.stateManager.get('playing')
		if (playing) runtime.duplexChannel.postMessage('pause')
		return playing
	},
	play: target => {
		if (list.length == 0) return
		index = ((typeof(target) != 'undefined' ? target : index) + list.length) % list.length
		let song = list[index]
		Promise.all([api.song.url, api.song.lyric].map(call => call(song.id)))
		.then(batch => {
			let url = batch[0].data[0].url
			let lyric = (batch[1].nolyric || batch[1].uncollected) ? [] : [batch[1].lrc.lyric, batch[1].tlyric.lyric]
			if (!url) {
				vscode.window.showWarningMessage(`无法播放: ${interaction.utility.stringify.song(song)}`)
				controller.remove(index)
				controller.play()
			}
			else {
				url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
				runtime.duplexChannel.postMessage('load', {lyric, song: Object.assign({url}, song)})
				runtime.playerBar.state(likes.includes(song.id) ? 'like' : 'dislike')
			}
		})
	},
	current: item => {
		if (list.length == 0) return
		let song = list[index]
		if (item.id === song.id && item.source.type === song.source.type) {
			if (!('id' in song.source))
				return true
			else if(item.source.id === song.source.id)
				return true
		}
	},
	list: () => {
		if (list.length == 0) return []
		let copy = JSON.parse(JSON.stringify(list))
		copy[index].play = true
		return copy
	},
	like: () => {
		if (list.length == 0) return
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
		if (list.length == 0) return
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
		if (list.length == 0) return
		let muted = !!runtime.stateManager.get('muted')
		if (!muted) runtime.duplexChannel.postMessage('mute')
	},
	unmute: () => {
		if (list.length == 0) return
		let muted = !!runtime.stateManager.get('muted')
		if (muted) runtime.duplexChannel.postMessage('unmute')
	},
	refresh: () => {
		runtime.stateManager.set('mode', 0)
		api.user.likes().then(data => {
			if (data.ids) likes = data.ids
		})
	},
	volumeChange: () => {
		runtime.duplexChannel.postMessage('volumeChange')
	}
}

module.exports = controller
const api = require('./request.js')
const runtime = require('./runtime.js')
const interaction = require('./interaction.js')