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
		runtime.sceneKeeper.save('radio', radio)
		if (Array.isArray(track)) {
			list = track.map(compact)
			index = 0
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
		runtime.sceneKeeper.save('mode', mode)
		runtime.playerBar.state(['loop', 'repeat', 'random'][mode])
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
	play: (target, action = true) => {
		if (list.length == 0) return
		index = ((typeof(target) != 'undefined' ? target : index) + list.length) % list.length
		runtime.sceneKeeper.save('index', index)
		let song = list[index]
		let program = song.source.type === 'djradio'
		Promise.all(program ? [api.program.url(song.id), {nolyric: true}] : [api.song.url, api.song.lyric].map(call => call(song.id)))
		.then(batch => {
			let url = batch[0].data[0].url
			let lyric = (batch[1].nolyric || batch[1].uncollected) ? [] : [batch[1].lrc.lyric, batch[1].tlyric.lyric]
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
		let muted = !!runtime.stateManager.get('muted')
		if (!muted) runtime.duplexChannel.postMessage('mute')
	},
	unmute: () => {
		let muted = !!runtime.stateManager.get('muted')
		if (muted) runtime.duplexChannel.postMessage('unmute')
	},
	refresh: () => {
		return api.user.likes().then(data => {
			if (data.ids) likes = data.ids
		})
	},
	volumeChange: value => {
		runtime.duplexChannel.postMessage('volumeChange', {value})
	}
}

module.exports = controller
const api = require('./request.js')
const runtime = require('./runtime.js')
const interaction = require('./interaction.js')