const vscode = require('vscode')

const quickPick = vscode.window.createQuickPick()
quickPick.canSelectMany = false
quickPick.matchOnDescription = true
quickPick.matchOnDetail = true
quickPick.onDidAccept(() => {
	let item = quickPick.selectedItems[0]
	if (typeof item.action === 'function' && !quickPick.busy) {
		quickPick.busy = true
		item.action()
	}
})

const selector = (items, title) => {
	quickPick.busy = false
	quickPick.value = ''
	quickPick.items = items.filter(item => item)
	quickPick.placeholder = title
	quickPick.show()
}

const utility = {
	extract: (item, keys = ['id', 'name']) =>
		Object.keys(item).filter(key => keys.includes(key)).reduce((result, key) => Object.assign(result, {[key]: item[key]}), {}),
	format: {
		song: (song, source) => {
			let item = utility.extract(song, ['id', 'name', 'listen'])
			item.album = utility.extract(song.al || song.album)
			item.artists = (song.ar || song.artists).map(artist => utility.extract(artist))
			item.source = source
			return item
		},
		program: (program, source) => {
			let item = utility.extract(program, ['id', 'name', 'duration'])
			item.album = utility.extract(program.radio)
			item.artists = [{id: 0, name: program.dj.nickname}]
			item.create = program.createTime
			item.listen = program.listenerCount
			item.source = source
			return item
		}
	},
	lift: {
		song: (song, index, flags, action) => {
			song.label = song.name
			song.action = action
			if (index) {
				let indicate = controller.current(song) ? '\u2006♬' : (index[0] + 1).toString()
				song.label = (new Array(Math.max(index[1].toString().length, 2) - indicate.length + 1)).join('\u2007') + indicate + '   ' + song.label
			}
			let listen = `${utility.stringify.number(song.listen)}次播放`
			song.description = flags.program ? [
				utility.stringify.date(song.create),
				listen,
				`(${utility.stringify.duration(song.duration)})`
			].join('  ') : [
				flags.artist === false ? null : utility.stringify.artist(song),
				flags.album === false ? null : song.album.name
			].filter(item => item).join(' - ') + (flags.listen ? '  ' + listen : '') + ((song.source || {}).type === 'intelligence' ? ' 【荐】' : '')
			return song
		}
	},
	stringify: {
		date: timestamp => {
			if (!timestamp) return ''
			let date = new Date(timestamp)
			let year = date.getFullYear()
			let month = date.getMonth() + 1
			let day = date.getDate()
			return `${year}.${month}.${day}`
		},
		interval: timestamp => {
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
		},
		number: value => {
			if (value / 100000 >= 1)
				return parseInt(value / 10000) + '万'
			else
				return value
		},
		duration: value => {
			value = value / 1000
			const pad = number => ('0' + number).slice(-2)
			let minute = Math.floor(value / 60)
			let second = Math.floor(value - minute * 60)
			return `${minute}:${pad(second)}`
		},
		artist: item => item.artists.map(artist => artist.name).join(' / '),
		song: item => `${utility.stringify.artist(item)} - ${item.name}`
	},
	check: {
		logged: (pass, failed) => {
			if (!api.user.account()) {
				vscode.window.showWarningMessage('请先登录')
				if (typeof failed === 'function') failed()
			}
			else {
				if (typeof pass === 'function') pass()
			}
		}
	},
	indicate: {
		expand: fill => `${fill ? '⯆' : '⯈'}  `,
		collect: done => `${done ? '【 $(check) 已收藏 】' : '【 $(plus) 收藏 】'}`
	},
	indent: {
		expand: item => Object.assign(item, {label: `\u2002\u2005\u2006  ${item.label}`})
	}
}

const interaction = {
	utility,
	user: {
		playlist: id => api.user.playlist(id).then(data => {
			id = id || data.playlist[0].creator.userId
			const show = (playlist, creator) => ({
				label: api.user.favorite(playlist.id) ? '我喜欢的音乐' : playlist.name,
				description: `${(playlist.trackCount || 0)}首${creator ? ' by ' + playlist.creator.nickname : ''}`,
				action: () => interaction.playlist.detail(playlist.id)
			})
			let users = data.playlist.filter(playlist => playlist.creator.userId === id)
			let others = data.playlist.filter(playlist => playlist.creator.userId != id)
			const playlists = (created, collected) => Array.prototype.concat(
				[{
					label: `${utility.indicate.expand(created)}创建的歌单`,
					description: `(${users.length})`,
					action: () => {
						selector(playlists(!created, collected), '我的歌单')
						quickPick.activeItems = [quickPick.items[0]]
					}
				}],
				created ? users.map(playlist => show(playlist, false)).map(utility.indent.expand) : [],
				[{
					label: `${utility.indicate.expand(collected)}收藏的歌单`,
					description: `(${others.length})`,
					action: () => {
						selector(playlists(created, !collected), '我的歌单')
						quickPick.activeItems = [quickPick.items[(created ? users.length : 0) + 1]]
					}
				}],
				collected ? others.map(playlist => show(playlist, true)).map(utility.indent.expand) : []
			)
			selector(playlists(true, true), '我的歌单')
			quickPick.activeItems = [quickPick.items[1]]
		}),
		artist: () => api.user.artist().then(data => {
			selector(data.data.map(artist => ({
				label: artist.name,
				description: `${artist.albumSize || 0}张专辑`,
				action: () => interaction.artist.album(artist.id)
			})), '我的歌手')
		}),
		album: () => api.user.album().then(data => {
			selector(data.data.map(album => ({
				label: album.name,
				description: `${utility.stringify.artist(album)}  ${album.size}首`,
				action: () => interaction.album(album.id)
			})), '我的专辑')
		}),
		djradio: () => api.user.djradio().then(data => {
			selector(data.djRadios.map(djradio => ({
				label: djradio.name,
				description: `第${djradio.programCount}期 (${utility.stringify.date(djradio.lastProgramCreateTime)})  ${djradio.lastProgramName}`,
				action: () => interaction.djradio.program(djradio.id)
			})), '我的电台')
		}),
		record: all => api.user.record().then(data => {
			const show = (array, week) =>
				array.map(item => Object.assign(item.song, {listen: item.playCount}))
				.map(song => utility.format.song(song, {type: 'record', week}))
				.map((song, index, track) => utility.lift.song(song, [index, 100], {listen: true}, () => {
					controller.add(track)
					controller.play(index)
					quickPick.hide()
				}))
			const label = week => week ? '最近一周' : '所有时间'
			const record = week => Array.prototype.concat(
				[{
					label: `${label(week)}`,
					description: ` ❘  ${label(!week)}`,
					action: () => {
						selector(record(!week), '听歌排行')
						quickPick.activeItems = [quickPick.items[1]]
					}
				}],
				week ? show(data.weekData, week) : show(data.allData, week),
			)
			selector(record(!all), '听歌排行')
			quickPick.activeItems = [quickPick.items[1]]
		})
	},
	djradio: {
		program: id => api.djradio.program(id).then(data => {
			const radio = data.programs[0].radio
			radio.dj = data.programs[0].dj
			const refresh = () => {
				selector(Array.prototype.concat(
					[{
						label: utility.indicate.collect(radio.subed),
						description: `${utility.stringify.number(radio.subCount)}人收藏`,
						action: () => utility.check.logged(api.djradio.subscribe(id, !radio.subed).then(result => {
							if (result.code === 200) {
								radio.subed = !radio.subed
								radio.subCount += (radio.subed ? 1 : -1)
							}
							refresh()
						}), refresh)
					}],
					data.programs.map(program => utility.format.program(program, {type: 'djradio', id, name: radio.name}))
					.map((program, index, track) => utility.lift.song(program, [track.length - index - 1, track.length], {program: true}, () => {
						controller.add(track)
						controller.play(index)
						quickPick.hide()
					}))
				), `${radio.name} by ${radio.dj.nickname}`)
				quickPick.activeItems = [quickPick.items[1]]
			}
			refresh()
		})
	},
	artist: {
		song: id => api.artist.song(id).then(data => {
			selector(data.hotSongs.map(song => utility.format.song(song, {type: 'artist', id, name: data.artist.name}))
			.map((song, index, track) => utility.lift.song(song, [index, track.length], {artist: false}, () => {
				controller.add(track)
				controller.play(index)
				quickPick.hide()
			})), `${data.artist.name} 热门单曲`)
		}),
		album: id => api.artist.album(id).then(data => {
			const refresh = () => {
				selector(Array.prototype.concat(
					[{
						label: utility.indicate.collect(data.artist.followed),
						description: `${utility.stringify.number(data.artist.fansNum)}人收藏`,
						action: () => utility.check.logged(api.artist.subscribe(id, !data.artist.followed).then(result => {
							if (result.code === 200) {
								data.artist.followed = !data.artist.followed
								data.artist.fansNum += (data.artist.followed ? 1 : -1)
							}
							refresh()
						}), refresh)
					}],
					[{
						label: '热门单曲',
						description: `TOP 50`,
						action: () => interaction.artist.song(id)
					}],
					data.hotAlbums.map(album => ({
						label: album.name,
						description: utility.stringify.date(album.publishTime),
						action: () => interaction.album(album.id)
					}))
				), data.artist.name)
				quickPick.activeItems = [quickPick.items[1]]
			}
			refresh()
		})
	},
	album: id => api.album.detail(id).then(data => {
		const refresh = () => {
			selector(Array.prototype.concat(
				[{
					label: utility.indicate.collect(data.album.info.isSub),
					description: `${utility.stringify.number(data.album.info.subCount)}人收藏`,
					action: () => utility.check.logged(api.album.subscribe(id, !data.album.info.isSub).then(result => {
						if (result.code === 200) {
							data.album.info.isSub = !data.album.info.isSub
							data.album.info.subCount += (data.album.info.isSub ? 1 : -1)
						}
						refresh()
					}), refresh)
				}],
				data.songs.map(song => utility.format.song(song, {type: 'album', id, name: data.album.name}))
				.map((song, index, track) => utility.lift.song(song, [index, track.length], {album: false}, () => {
					controller.add(track)
					controller.play(index)
					quickPick.hide()
				}))
			), data.album.name)
			quickPick.activeItems = [quickPick.items[1]]
		}
		refresh()
	}),
	toplist: () => api.toplist().then(data => {
		selector(data.list.map(playlist => ({
			label: playlist.name,
			description: `${utility.stringify.interval(playlist.updateTime)}前更新`,
			action: () => interaction.playlist.detail(playlist.id)
		})), '排行榜')
	}),
	playlist: {
		detail: id => api.playlist.detail(id).then(data => {
			let self = api.user.account(data.playlist.creator.userId)
			let name = api.user.favorite(id) ? '我喜欢的音乐' : data.playlist.name
			const refresh = () => {
				selector(Array.prototype.concat(
					!self ? [{
						label: utility.indicate.collect(data.playlist.subscribed),
						description: `${utility.stringify.number(data.playlist.subscribedCount)}人收藏`,
						action: () => utility.check.logged(api.playlist.subscribe(id, !data.playlist.subscribed).then(result => {
							if (result.code === 200) {
								data.playlist.subscribed = !data.playlist.subscribed
								data.playlist.subscribedCount += (data.playlist.subscribed ? 1 : -1)
							}
							refresh()
						}), refresh)
					}] : [],
					data.playlist.tracks.map(song => utility.format.song(song, {type: 'playlist', id, name}))
					.map((song, index, track) => utility.lift.song(song, [index, track.length], {}, () => {
						controller.add(track)
						controller.play(index)
						quickPick.hide()
					}))
				), `${name} by ${data.playlist.creator.nickname}`)
				quickPick.activeItems = [quickPick.items[self ? 0 : 1]]
			}
			refresh()
		}),
		hot: () => api.playlist.hot().then(data => {
			selector(data.playlists.map(playlist => ({
				label: playlist.name,
				description: `by ${playlist.creator.nickname}  ${utility.stringify.number(playlist.playCount)}次播放`,
				action: () => interaction.playlist.detail(playlist.id)
			})), '热门歌单')
		}),
		highquality: () => api.playlist.highquality().then(data => {
			selector(data.playlists.map(playlist => ({
				label: playlist.name,
				description: `by ${playlist.creator.nickname}  ${utility.stringify.number(playlist.playCount)}次播放`,
				action: () => interaction.playlist.detail(playlist.id)
			})), '精品歌单')
		})
	},
	recommend: {
		song: () => api.recommend.song().then(data => {
			selector(data.recommend.map(song => utility.format.song(song, {type: 'recommend'}))
			.map((song, index, track) => utility.lift.song(song, [index, track.length], {}, () => {
				controller.add(track)
				controller.play(index)
				quickPick.hide()
			})), '每日歌曲推荐')
		}),
		playlist: () => api.recommend.playlist().then(data => {
			selector(data.result.map(playlist => ({
				label: playlist.name,
				description: playlist.copywriter,
				action: () => interaction.playlist.detail(playlist.id)
			})), '推荐歌单')
		}),
		radio: () => api.recommend.radio().then(data => {
			controller.add(data.data.map(song => utility.format.song(song, {type: 'radio'})), true)
			controller.play(0)
		})
	},
	new: {
		song: () => api.new.song().then(data => {
			selector(data.data.map(song => utility.format.song(song, {type: 'new'}))
			.map(song => utility.lift.song(song, null, {}, () => {
				controller.add(song)
				controller.play()
				quickPick.hide()
			})), '新歌速递')
		}),
		album: () => api.new.album().then(data => {
			selector(data.albums.map(album => ({
				label: album.name,
				description: `${utility.stringify.artist(album)}  ${utility.stringify.date(album.publishTime)}`,
				action: () => interaction.album(album.id)
			})), '新碟上架')
		})
	},
	login: () => {
		vscode.window.showInputBox({
			placeHolder: '邮箱或手机号',
			prompt: '请输入网易云账号'
		})
		.then(account => {
			vscode.window.showInputBox({
				password: true,
				prompt: '请输入密码'
			})
			.then(password => {
				if (account && password) {
					api.login(account, password)
					.then(data => {vscode.window.showInformationMessage(`登录成功: ${data.profile.nickname}(${data.userPoint.userId})`)})
					.then(() => controller.refresh())
					.catch(e => {vscode.window.showErrorMessage(`登录失败: ${e.code == 502 ? '账号或密码错误' : '未知错误'}(${e.code})`)})
				}
			})
		})
	},
	clone: () => {
		vscode.window.showInputBox({
			placeHolder: '"MUSIC_U"的值',
			prompt: '从浏览器开发者工具复制Cookie'
		})
		.then(value => {
			if (value) {
				api.refresh(`MUSIC_U=${value.trim()}`)
				.then(data => {vscode.window.showInformationMessage(`登录成功: ${data.profile.nickname}(${data.userPoint.userId})`)})
				.then(() => controller.refresh())
				.catch(e => {vscode.window.showErrorMessage(`登录失败: Cookie 无效`)})
			}
		})
	},
	logout: () => api.logout(),
	sign: () => api.sign().then(data => {
		if ([-2, 200].includes(data.code)) {
			vscode.window.showInformationMessage('签到成功')
			runtime.stateManager.set('signed', true)
		}
	}),
	list: {
		show: () => {
			let track = controller.list()
			let play = track.findIndex(song => song.play)
			selector(track.map((song, index) => utility.lift.song(song, [index, track.length], {}, () => {
				song.play ? (controller.pause() || controller.resume()) : controller.play(index)
				quickPick.hide()
			})), `播放列表 (${track.length})`)
			quickPick.activeItems = [quickPick.items[play]]
		},
		edit: () => {
			let track = controller.list()
			let play = track.findIndex(song => song.play)
			selector(track.map((song, index) => utility.lift.song(song, [index, track.length], {}, () => {
				controller.remove(index)
				if (index == play) controller.play(undefined, runtime.stateManager.get('playing'))
				interaction.list.edit()
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
			let code = {song: 1, artist: 100, album: 10, playlist: 1000, djradio: 1009}[type]
			if (!code) api.search.suggest(text).then(data => display(text, data))
			else api.search.type(text, code).then(data => display(text, data, type))
		}

		const display = (text, data, type) => {
			let songs = (data.result.songs || []).map(song => utility.format.song(song, {type: 'search'}))
			.map(song => utility.lift.song(song, null, {}, () => {
				controller.add(song)
				controller.play()
				quickPick.hide()
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
				label: playlist.name,
				description: `${utility.stringify.number(playlist.playCount)}次播放  ${utility.stringify.number(playlist.bookCount)}次收藏`,
				action: () => interaction.playlist.detail(playlist.id)
			}))
			let djradios = (data.result.djRadios || []).map(djradio => ({
				label: djradio.name,
				description: `by ${djradio.dj.nickname}`,
				action: () => interaction.djradio.program(djradio.id)
			}))
			selector(Array.prototype.concat(
				[{
					label: `${utility.indicate.expand(songs.length)}单曲`,
					action: type != 'song' ? () => search(text, 'song') : null
				}],
				songs.map(utility.indent.expand),
				[{
					label: `${utility.indicate.expand(artists.length)}歌手`,
					action: type != 'artist' ? () => search(text, 'artist') : null
				}],
				artists.map(utility.indent.expand),
				[{
					label: `${utility.indicate.expand(albums.length)}专辑`,
					action: type != 'album' ? () => search(text, 'album') : null
				}],
				albums.map(utility.indent.expand),
				[{
					label: `${utility.indicate.expand(playlists.length)}歌单`,
					action: type != 'playlist' ? () => search(text, 'playlist') : null
				}],
				playlists.map(utility.indent.expand),
				[{
					label: `${utility.indicate.expand(djradios.length)}电台`,
					action: type != 'djradio' ? () => search(text, 'djradio') : null
				}],
				djradios.map(utility.indent.expand)
			), `“${text}”的${{song: '歌曲', artist: '歌手', album: '专辑', playlist: '歌单', djradio: '电台'}[type] || ''}搜索结果`)
			quickPick.activeItems = [quickPick.items[{song: 0, artist: 1, album: 2, playlist: 3, djradio: 4}[type] || 0]]
		}
		api.search.hot().then(data => {
			hot = data.result.hots.map(item => ({label: item.first})).map(operation)
			selector(hot, '搜索歌曲、歌手、专辑、歌单')
			autoComplete = quickPick.onDidChangeValue(() => {
				clearTimeout(timer)
				timer = setTimeout(suggest, 250)
			})
		})
	},
	more: () => {
		let song = controller.list().find(song => song.play)
		let program = song.source.type === 'djradio'
		selector([
			!program ? {
				label: `专辑: ${song.album.name}`,
				action: () => interaction.album(song.album.id)
			} : null,
			!program ? {
				label: `歌手: ${utility.stringify.artist(song)}`,
				action: () => song.artists.length > 1 ? selector(song.artists.map(artist => ({
					label: artist.name,
					action: () => interaction.artist.album(artist.id)
				})), '查看歌手') : interaction.artist.album(song.artists[0].id)
			} : null,
			song.source ? ({
				playlist: {
					label: `来源: 歌单「${song.source.name}」`,
					action: () => interaction.playlist.detail(song.source.id)
				},
				album: {
					label: `来源: 专辑「${song.source.name}」`,
					action: () => interaction.album(song.source.id)
				},
				artist: {
					label: `来源: ${song.source.name}的「热门单曲」`,
					action: () => interaction.artist.song(song.source.id)
				},
				recommend: {
					label: `来源: 每日推荐`,
					action: () => interaction.recommend.song()
				},
				new: {
					label: `来源: 新歌速递`,
					action: () => interaction.new.song()
				},
				record: {
					label: `来源: 听歌排行`,
					action: () => interaction.user.record(!song.source.week)
				},
				djradio: {
					label: `电台节目: ${song.source.name}`,
					action: () => interaction.djradio.program(song.source.id)
				},
				radio: {
					label: `来源: 私人 FM`
				},
				search: {
					label: `来源: 搜索`
				},
				program: {
					label: `来源: 节目包含歌曲`
				},
				intelligence: {
					label: `来源: 心动模式`
				}
			}[song.source.type]) : null,
			program ? {
				label: '节目包含歌曲',
				action: () => api.program.detail(song.id).then(data => {
					selector(data.program.songs.map(song => utility.format.song(song, {type: 'program'}))
					.map((song, index, track) => utility.lift.song(song, [index, track.length], {}, () => {
						controller.add(track)
						controller.play(index)
						quickPick.hide()
					})), `${song.name} 包含歌曲(${data.program.songs.length})`)
				})
			} : null,
			{
				label: `查看评论`,
				action: () => api[program ? 'program' : 'song'].comment(song.id).then(data => {
					let hot = (data.hotComments || []).length
					selector(Array.prototype.concat(
						hot ? [{
							label: '精彩评论',
						}] : null,
						hot ? (data.hotComments || []).map(comment => ({
							label: `${hot ? '\u2003' : ''}${utility.stringify.number(comment.likedCount)} $(heart)`,
							description: comment.content,
						})) : null,
						hot ? [{
							label: '最新评论',
						}] : null,
						(data.comments || []).map(comment => ({
							label: `${hot ? '\u2003' : ''}${utility.stringify.number(comment.likedCount)} $(heart)`,
							description: comment.content,
						}))
					), `${hot ? '' : '最新'}评论 (${data.total})`)
				})
			},
			!program && api.user.account() ? {
				label: '收藏到歌单',
				action: () => api.user.playlist().then(data => data.playlist).then(playlists => {
					selector(playlists.filter(playlist => playlist.creator.userId === playlists[0].creator.userId)
					.map(playlist => ({
						label: api.user.favorite(playlist.id) ? '我喜欢的音乐' : playlist.name,
						description: `${(playlist.trackCount || 0)}首`,
						action: () => api.song.collect(song.id, playlist.id).then(data => {
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
				action: () => vscode.env.openExternal(vscode.Uri.parse(`https://music.163.com/#/${program ? 'program' : 'song'}?id=${song.id}`)) && quickPick.hide()
			}
		], `正在播放: ${utility.stringify.song(song)}`)
	}
}

module.exports = interaction
const api = require('./request.js')
const runtime = require('./runtime.js')
const controller = require('./controller.js')