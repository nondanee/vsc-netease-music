const vscode = require('vscode')
let likes = []
let list = []
let index = 0
let backup = []
let arr = []
let n, mode, song
const format = song => ({
	id: song.id,
	name: song.name,
	album: song.album,
	artist: song.artist
})

const controller = {
	add: track => {
		if (Array.isArray(track)) {
			list = track.map(format)
			index = 0
		} else {
			index = list.length
			list.splice(index, 0, format(track))
		}
		arr = list.map((val, index) => {
			return val = index
		})
		backup = list.map((val, index) => {
			return val = index
		})
		runtime.playerBar.show()
	},
	remove: target => {
		list.splice(target, 1)
		arr.splice(arr.indexOf(target), 1)
		backup.splice(backup.indexOf(target), 1)
		index = index < list.length ? index : 0
		if (list.length == 0) runtime.playerBar.hide()
	},
	previous: () => {
		if (list.length == 0) return
		n--
		index = backup[(n + backup.length) % backup.length]
		controller.play()
	},
	next: () => {
		if (list.length == 0) return
		n++
		index = backup[(n) % backup.length]
		controller.play()
	},
	mode: (mode) => {
		if (list.length == 0) return
		if (mode === 3) {
			for (var i = 0; i < backup.length; i += 1) {
				backup[i] = arr.splice(Math.floor(Math.random() * arr.length), 1)[0];
			}
			arr = list.map((val, index) => {
				return val = index
			})

		} else if (mode === 1) {
			backup = arr;
		} else if (mode === 2) {
			backup = arr
		}
		runtime.playerBar.state(['repeat', 'random', 'loop'][mode - 1])
	},
	// repeat: () => {
	// 	if (list.length == 0) return
	// 	mode = runtime.stateManager.get('mode')
	// 		backup = arr
	// 	runtime.playerBar.state('random')
	// 	console.log()
	// },
	// loop: () => {
	// 	if (list.length == 0) return
	// 	mode = runtime.stateManager.get('mode')
	// 	if (mode === 1)
	// 		backup = arr
	// 	runtime.playerBar.state('repeat')

	// },
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
		index = typeof (target) != 'undefined' ? target % list.length : index
		n = backup.indexOf(index)
		song = list[index]
		Promise.all([api.song.url(song.id), api.song.lyric(song.id)])
			.then(data => {
				let url = data[0].data[0].url
				if (!url) {
					vscode.window.showWarningMessage(`无法播放: ${song.artist} - ${song.name}`)
					controller.remove(index)
					controller.play()
				} else {
					url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
					song.url = url
					song.lyric = data[1].nolyric ? [] : [data[1].lrc.lyric, data[1].tlyric.lyric]
					runtime.duplexChannel.postMessage('load', song)
					runtime.playerBar.state(likes.includes(song.id) ? 'like' : 'dislike')
					vscode.window.showInformationMessage(`正在播放: ${song.artist} - ${song.name}`)
				}
			})
	},
	list: () => {
		if (list.length == 0) return []
		let copy = JSON.parse(JSON.stringify(list))
		copy[index].play = true
		return copy
	},
	dlist: () => {
		if (list.length == 0) return []
		let copy = JSON.parse(JSON.stringify(list))
		copy[index].play = true
		return copy
	},
	delete: target => {
		list.splice(target, 1)
		index = list.indexOf(song)
		arr = list.map((val, index) => {
			return val = index
		})
		controller.mode(1)
		controller.mode(mode)
		if (list.length == 0) runtime.playerBar.hide()
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
		api.user.likes().then(data => {
			if (data.ids) likes = data.ids
		})
	}
}

module.exports = controller
const api = require('./request.js')
const runtime = require('./runtime.js')