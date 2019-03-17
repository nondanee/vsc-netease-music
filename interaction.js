const vscode = require('vscode')

const quickPick = vscode.window.createQuickPick()
quickPick.canSelectMany = false
quickPick.matchOnDescription = true
quickPick.matchOnDetail = true
quickPick.onDidAccept(() => {
	quickPick.busy = true
	let item = quickPick.selectedItems[0]
	if (typeof item.action === 'function') item.action()
})

const fillQuickPick = (items, title) => {
	quickPick.busy = false
	quickPick.value = ''
	quickPick.items = items
	quickPick.placeholder = title
	quickPick.show()
}

const alignCenter = (string, space) => {
	space = space < 4 ? 4 : space
	let idle = space - string.toString().length * 2 * (isNaN(string) ? 2 : 1)
	let blank = Array(idle / 2 + 1).join(' ')
	return blank + string + blank
}

const addIndex = (item, index, all) => {
	let space = all.length.toString().length * 2
	item.index = index
	item.label = ` ${alignCenter(item.play ? '♬' : (index + 1), space)}   ${item.label}`
	return item
}

const songFormat = song => ({
	id: song.id,
	name: song.name,
	album: (song.al || song.album).name,
	artist: (song.ar || song.artists).map(artist => artist.name).join(' / ')
})

const songDisplay = item => {
	item.label = item.name
	item.description = `${item.artist} - ${item.album}`
	return item
}

const dateFormat = timestamp => {
	if (!timestamp) return ''
	let date = new Date(timestamp)
	let year = date.getFullYear()
	let month = date.getMonth() + 1
	let day = date.getDate()
	return `${year}.${month}.${day}`
}

const numberReadable = number => {
	if (number / 100000 >= 1)
		return parseInt(number / 10000) + '万'
	else
		return number
}

const dateFriendly = timestamp => {
	let date = new Date(timestamp)
	let delta = parseInt((Date.now() - date) / 1000)
	if (delta < 60)
		return '刚刚'
	else if (delta < 3600)
		return parseInt(delta / 60) + '分钟'
	else if (delta < 86400)
		return parseInt(delta / 3600) + '小时'
	else if (delta < 2592000)
		return parseInt(delta / 86400) + '天'
	else if (delta < 31536000)
		return parseInt(delta / 2592000) + '月'
	else
		return parseInt(delta / 31536000) + '年'
}

const interaction = {
	user: {
		playlist: id => api.user.playlist(id).then(data => {
			id = id || data.playlist[0].creator.userId
			const show = playlist => ({
				label: '     ' + playlist.name,
				description: `${(playlist.trackCount || 0)}首`,
				action: () => interaction.playlist.detail(playlist.id)
			})
			let users = data.playlist.filter(playlist => playlist.creator.userId === id)
			let others = data.playlist.filter(playlist => playlist.creator.userId != id)
			const playlists = (create, collect) => Array.from([]).concat(
				[{
					label: `${create ? '▿' : '▹'}  创建的歌单(${users.length})`,
					action: () => {
						fillQuickPick(playlists(!create, collect), '我的歌单')
						quickPick.activeItems = [quickPick.items[0]]
					}
				}],
				create ? users.map(show) : [],
				[{
					label: `${collect ? '▿' : '▹'}  收藏的歌单(${others.length})`,
					action: () => {
						fillQuickPick(playlists(create, !collect), '我的歌单')
						quickPick.activeItems = [quickPick.items[(create ? users.length : 0) + 1]]
					}
				}],
				collect ? others.map(show) : []
			)
			fillQuickPick(playlists(true, true), '我的歌单')
			quickPick.activeItems = [quickPick.items[1]]
		}),
		artist: () => api.user.artist().then(data => {
			fillQuickPick(data.data.map(artist => ({
				label: artist.name,
				description: `${artist.albumSize || 0}张专辑`,
				action: () => interaction.artist.album(artist.id)
			})), '我的歌手')
		}),
		album: () => api.user.album().then(data => {
			fillQuickPick(data.data.map(album => ({
				label: album.name,
				description: `${album.artists.map(artist => artist.name).join(' / ')}  ${album.size}首`,
				action: () => interaction.album(album.id)
			})), '我的专辑')
		})
	},
	artist: {
		song: id => api.artist.song(id).then(data => {
			fillQuickPick(data.hotSongs.map(songFormat).map(songDisplay).map(addIndex)
			.map((song, index, track) => Object.assign(song, {
				description: song.album,
				action: () => {
					controller.add(track)
					controller.play(index)
					quickPick.hide()
				}
			})), `${data.artist.name} 热门单曲`)
		}),
		album: id => api.artist.album(id).then(data => {
			fillQuickPick([{
				label: '热门单曲',
				description: 'TOP 50',
				action: () => interaction.artist.song(id)
			}].concat(data.hotAlbums.map(album => ({
				label: album.name,
				description: dateFormat(album.publishTime),
				action: () => interaction.album(album.id)
			}))), data.artist.name)
		})
	},
	album: id => api.album(id).then(data => {
		fillQuickPick(data.songs.map(songFormat).map(songDisplay).map(addIndex)
		.map((song, index, track) => Object.assign(song, {
			description: song.artist,
			action: () => {
				controller.add(track)
				controller.play(index)
				quickPick.hide()
			}
		})), data.album.name)
	}),
	toplist: () => api.toplist().then(data => {
		fillQuickPick(data.list.map(playlist => ({
			label: playlist.name,
			description: `${dateFriendly(playlist.updateTime)}前更新`,
			action: () => interaction.playlist.detail(playlist.id)
		})), '排行榜')
	}),
	playlist: {
		detail: id => api.playlist.detail(id).then(data => {
			fillQuickPick(data.playlist.tracks.map(songFormat).map(songDisplay).map(addIndex)
			.map((song, index, track) => Object.assign(song, {
				action: () => {
					controller.add(track)
					controller.play(index)
					quickPick.hide()
				}
			})), `${data.playlist.name} by ${data.playlist.creator.nickname}`)
		}),
		hot: () => api.playlist.hot().then(data => {
			fillQuickPick(data.playlists.map(playlist => ({
				label: playlist.name,
				description: `by ${playlist.creator.nickname}  ${numberReadable(playlist.playCount)}次播放`,
				action: () => interaction.playlist.detail(playlist.id)
			})), '热门歌单')
		}),
		highquality: () => api.playlist.highquality().then(data => {
			fillQuickPick(data.playlists.map(playlist => ({
				label: playlist.name,
				description: `by ${playlist.creator.nickname}  ${numberReadable(playlist.playCount)}次播放`,
				action: () => interaction.playlist.detail(playlist.id)
			})), '精品歌单')
		})
	},
	recommend: {
		song: () => api.recommend.song().then(data => {
			fillQuickPick(data.recommend.map(songFormat).map(songDisplay).map(addIndex)
			.map((song, index, track) => Object.assign(song, {
				action: () => {
					controller.add(track)
					controller.play(index)
					quickPick.hide()
				}
			})), '每日歌曲推荐')
		}),
		playlist: () => api.recommend.playlist().then(data => {
			fillQuickPick(data.result.map(playlist => ({
				label: playlist.name,
				description: playlist.copywriter,
				action: () => interaction.playlist.detail(playlist.id)
			})), '推荐歌单')
		}),
		radio: () => api.recommend.radio().then(data => {
			controller.add(data.data.map(songFormat), true)
			controller.play(0)
		})
	},
	new: {
		song: () => api.new.song().then(data => {
			fillQuickPick(data.data.map(songFormat).map(songDisplay)
			.map(song => Object.assign(song, {
				action: () => {
					controller.add(song)
					controller.play()
					quickPick.hide()
				}
			})), '新歌速递')
		}),
		album: () => api.new.album().then(data => {
			fillQuickPick(data.albums.map(album => ({
				label: album.name,
				description: `${album.artists.map(artist => artist.name).join(' / ')}  ${dateFormat(album.publishTime)}`,
				action: () => interaction.album(album.id)
			})), '新碟上架')
		})
	},
	login: () => {
		vscode.window.showInputBox({
			placeHolder: "邮箱或手机号",
			prompt: "请输入网易云账号"
		})
		.then(account => {
			vscode.window.showInputBox({
				password: true,
				prompt: "请输入密码"
			})
			.then(password => {
				if (account && password) {
					api.login(account, password)
					.then(data => {vscode.window.showInformationMessage(`登录成功: ${data.profile.nickname}(${data.account.id})`)})
					.then(() => controller.refresh())
					.catch(e => {vscode.window.showErrorMessage(`登录失败: ${e.code == 502 ? '账号或密码错误' : '未知错误'}(${e.code})`)})
				}
			})
		})
	},
	logout: () => api.logout(),
	list: {
		show: () => {
			let track = controller.list().map(songDisplay).map(addIndex)
			let play = track.findIndex(song => song.play)
			fillQuickPick(track.map((song, index) => Object.assign(song, {
				action: () => {
					song.play ? (controller.pause() || controller.resume()) : controller.play(index)
					quickPick.hide()
				}
			})), `播放列表 (${track.length})`)
			quickPick.activeItems = [quickPick.items[play]]
		},
		edit: () => {
			let track = controller.list().map(songDisplay).map(addIndex)
			let play = track.findIndex(song => song.play)
			fillQuickPick(track.map((song, index) => Object.assign(song, {
				action: () => {
					controller.remove(index)
					if (index == play) controller.play()
					interaction.list.edit()
				}
			})), `编辑播放列表 (${track.length})`)
		}
	},
	search: () => {
		let hot = []
		let timer = 0
		let autoComplete = {}
		const operation = item => Object.assign(item, {alwaysShow: true, action: () => search(item.label)})
		const suggest = () => {
			const value = quickPick.value
			if (!value) quickPick.items = hot
			else api.search.keyword(value).then(data => {
				let items = (data.result && data.result.allMatch) ? data.result.allMatch.map(item => ({label: item.keyword})) : []
				if (!items.length || items[0].label != value) items.unshift({label: value})
				quickPick.items = items.map(operation)
			})
		}

		const search = (text, type) => {
			autoComplete.dispose()
			let code = {song: 1, artist: 100, album: 10, playlist: 1000}[type]
			if (!code) api.search.suggest(text).then(data => display(text, data))
			else api.search.type(text, code).then(data => display(text, data, type))
		}
		
		const display = (text, data, type) => {
			const indent = item => Object.assign(item, {label: '     ' + item.label})
			let songs = (data.result.songs || []).map(songFormat).map(songDisplay).map(song => Object.assign(song, {
				action: () => {
					controller.add(song)
					controller.play()
					quickPick.hide()
				}
			}))
			let artists = (data.result.artists || []).map(artist => ({
				label: artist.name,
				action: () => interaction.artist.album(artist.id)
			}))
			let albums = (data.result.albums || []).map(album => ({
				label: album.name,
				description: `${album.artist.name} ${album.size}首`,
				action: () => interaction.album(album.id)
			}))
			let playlists = (data.result.playlists || []).map(playlist => ({
				id: playlist.id,
				label: playlist.name,
				description: `${numberReadable(playlist.playCount)}次播放 ${numberReadable(playlist.bookCount)}次收藏`,
				action: () => interaction.playlist.detail(playlist.id)
			}))
			fillQuickPick(Array.from([]).concat(
				[{
					label: `${songs.length ? '▿' : '▹'}  单曲`,
					action: type != 'song' ? () => search(text, 'song') : null
				}],
				songs.map(indent),
				[{
					label: `${artists.length ? '▿' : '▹'}  歌手`,
					action: type != 'artist' ? () => search(text, 'artist') : null
				}],
				artists.map(indent),
				[{
					label: `${albums.length ? '▿' : '▹'}  专辑`,
					action: type != 'album' ? () => search(text, 'album') : null
				}],
				albums.map(indent),
				[{
					label: `${playlists.length ? '▿' : '▹'}  歌单`,
					action: type != 'playlist' ? () => search(text, 'playlist') : null
				}],
				playlists.map(indent)
			), `“${text}”的${{song: '歌曲', artist: '歌手', album: '专辑', playlist: '歌单'}[type] || ''}搜索结果`)
			quickPick.activeItems = [quickPick.items[{song: 0, artist: 1, album: 2, playlist: 3}[type] || 0]]
		}
		api.search.hot().then(data => {
			hot = data.result.hots.map(item => ({label: item.first})).map(operation)
			fillQuickPick(hot, '搜索歌曲、歌手、专辑、歌单')
			autoComplete = quickPick.onDidChangeValue(() => {
				clearTimeout(timer)
				timer = setTimeout(suggest, 250)
			})
		})
	},
	more: () => {
		let id = controller.list().find(song => song.play).id
		api.song.detail(id).then(data => data.songs[0]).then(data => {
			fillQuickPick([
				{
					label: `专辑: ${data.al.name}`, 
					action: () => interaction.album(data.al.id)
				},
				{
					label: `歌手: ${data.ar.map(artist => artist.name).join(' / ')}`, 
					action: () => data.ar.length > 1 ? fillQuickPick(data.ar.map(artist => ({
						label: artist.name,
						action: () => interaction.artist.album(artist.id)
					})), '查看歌手') : interaction.artist.album(data.ar[0].id)
				},
				{
					label: '查看热门评论',
					action: () => api.song.comment(id).then(data => {
						fillQuickPick(data.hotComments.map(comment => ({
							label: `${numberReadable(comment.likedCount)} $(heart)`,
							description: comment.content,
							// action: () => comment.commentId
						})), `热门评论 (${data.hotComments.length})`)
					})
				},
				runtime.stateManager.get('logged') ? {
					label: "收藏到歌单", 
					action: () => api.user.playlist().then(data => data.playlist).then(playlists => {
						fillQuickPick(playlists.filter(playlist => playlist.creator.userId === playlists[0].creator.userId)
						.map(playlist => ({
							label: playlist.name,
							description: `${(playlist.trackCount || 0)}首`,
							action: () => api.song.collect(id, playlist.id).then(data => {
								if (data.code === 200) vscode.window.showInformationMessage('收藏成功')
								else if (data.code === 502) vscode.window.showWarningMessage('歌曲已存在')
								else vscode.window.showWarningMessage(`未知错误(${data.code})`)
								quickPick.hide()
							})
						})), '添加到歌单')
					})
				} : null,
				{
					label: '在浏览器中打开', 
					action: () => vscode.env.openExternal(vscode.Uri.parse(`https://music.163.com/#/song?id=${id}`)) && quickPick.hide()
				}
			].filter(item => item), `正在播放: ${data.ar.map(artist => artist.name).join(' / ')} - ${data.name}`)
		})
	}
}

module.exports = interaction
const api = require('./request.js')
const runtime = require('./runtime.js')
const controller = require('./controller.js')
