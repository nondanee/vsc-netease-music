const vscode = require('vscode')
let runtime = {}

const quickPick = vscode.window.createQuickPick()
let onPickItem = null
let onChangeValue = null
quickPick.canSelectMany = false
quickPick.matchOnDescription = true
quickPick.matchOnDetail = true
quickPick.onDidAccept(() => onPickItem(quickPick.selectedItems[0]))
quickPick.onDidChangeValue(value => onChangeValue(value))

const fillQuickPick = (items, title) => {
    quickPick.value = ''
    onPickItem = () => {}
    onChangeValue = () => {}
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
        playlist: id => runtime.api.user.playlist(id).then(data => {
            quickPick.busy = false
            fillQuickPick(data.playlist.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: `${(playlist.trackCount || 0)}首`,
            })), '我的歌单')
            onPickItem = item => {
                quickPick.busy = true
                interaction.playlist.detail(item.id)
            }
        }),
        artist: () => runtime.api.user.artist().then(data => {
            quickPick.busy = false
            fillQuickPick(data.data.map(artist => ({
                id: artist.id,
                label: artist.name,
                description: `${artist.albumSize || 0}张专辑`,
            })), '我的歌手')
            onPickItem = item => {
                quickPick.busy = true
                interaction.artist(item.id)
            }
        }),
        album: () => runtime.api.user.album().then(data => {
            quickPick.busy = false
            fillQuickPick(data.data.map(album => ({
                id: album.id,
                label: album.name,
                description: `${album.artists.map(artist => artist.name).join(' / ')}  ${album.size}首`,
            })), '我的专辑')
            onPickItem = item => {
                quickPick.busy = true
                interaction.album(item.id)
            }
        })
    },
    artist: id => runtime.api.artist.album(id).then(data => {
        quickPick.busy = false
        fillQuickPick(data.hotAlbums.map(album => ({
            id: album.id,
            label: album.name,
            description: dateFormat(album.publishTime),
        })), data.artist.name)
        onPickItem = item => {
            quickPick.busy = true
            interaction.album(item.id)
        }
    }),
    album: id => runtime.api.album(id).then(data => {
        quickPick.busy = false
        let track = data.songs.map(songFormat).map(songDisplay).map(addIndex)
        fillQuickPick(track, data.album.name)
        onPickItem = item => {
            quickPick.busy = true
            runtime.controller.add(track)
            runtime.controller.play(item.index)
            quickPick.hide()
        }
    }),
    toplist: () => runtime.api.toplist().then(data => {
        quickPick.busy = false
        fillQuickPick(data.list.map(playlist => ({
            id: playlist.id,
            label: playlist.name,
            description: `${dateFriendly(playlist.updateTime)}前更新`,
        })), '排行榜')
        onPickItem = item => {
            quickPick.busy = true
            interaction.playlist.detail(item.id)
        }
    }),
    playlist: {
        detail: id => runtime.api.playlist.detail(id).then(data => {
            quickPick.busy = false
            let track = data.playlist.tracks.map(songFormat).map(songDisplay).map(addIndex)
            fillQuickPick(track, `${data.playlist.name} by ${data.playlist.creator.nickname}`)
            onPickItem = item => {
                quickPick.busy = true
                runtime.controller.add(track)
                runtime.controller.play(item.index)
                quickPick.hide()
            }
        }),
        hot: () => runtime.api.playlist.hot().then(data => {
            quickPick.busy = false
            fillQuickPick(data.playlists.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: `by ${playlist.creator.nickname}  ${numberReadable(playlist.playCount)}次播放`
            })), '热门歌单')
            onPickItem = item => {
                quickPick.busy = true
                interaction.playlist.detail(item.id)
            }
        }),
        highquality: () => runtime.api.playlist.highquality().then(data => {
            quickPick.busy = false
            fillQuickPick(data.playlists.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: `by ${playlist.creator.nickname}  ${numberReadable(playlist.playCount)}次播放`
            })), '精品歌单')
            onPickItem = item => {
                quickPick.busy = true
                interaction.playlist.detail(item.id)
            }
        })
    },
    recommend: {
        song: () => runtime.api.recommend.song().then(data => {
            quickPick.busy = false
            let track = data.recommend.map(songFormat).map(songDisplay).map(addIndex)
            fillQuickPick(track, '每日歌曲推荐')
            onPickItem = item => {
                quickPick.busy = true
                runtime.controller.add(track)
                runtime.controller.play(item.index)
                quickPick.hide()
            }
        }),
        playlist: () => runtime.api.recommend.playlist().then(data => {
            quickPick.busy = false
            fillQuickPick(data.result.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: playlist.copywriter,
            })), '推荐歌单')
            onPickItem = item => {
                quickPick.busy = true
                interaction.playlist.detail(item.id)
            }
        })
    },
    new: {
        song: () => runtime.api.new.song().then(data => {
            let track = data.data.map(songFormat).map(songDisplay)
            fillQuickPick(track, '新歌速递')
            onPickItem = item => {
                quickPick.busy = true
                runtime.controller.add(item)
                runtime.controller.play()
                quickPick.hide()
            }
        }),
        album: () => runtime.api.new.album().then(data => {
            quickPick.busy = false
            fillQuickPick(data.albums.map(album => ({
                id: album.id,
                label: album.name,
                description: `${album.artists.map(artist => artist.name).join(' / ')}  ${dateFormat(album.publishTime)}`,
            })), '新碟上架')
            onPickItem = item => {
                quickPick.busy = true
                interaction.album(item.id)
            }
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
                    runtime.api.login(account, password)
                    .then(data => vscode.window.showInformationMessage(`登录成功: ${data.profile.nickname}(${data.account.id})`))
                    .then(() => runtime.controller.refresh())
                    .catch(e => vscode.window.showErrorMessage(`登录失败: ${e.code == 502 ? '账号或密码错误' : '未知错误'}(${e.code})`))
                }
            })
        })
    },
    logout: () => runtime.api.logout(),
    list: () => {
        quickPick.busy = false
        let track = runtime.controller.list().map(songDisplay).map(addIndex)
        let play = track.findIndex(song => song.play)
        fillQuickPick(track, `播放列表 (${track.length})`)
        quickPick.activeItems = [quickPick.items[play]]
        onPickItem = item => {
            quickPick.busy = true
            item.play ? (runtime.controller.pause() || runtime.controller.resume()) : runtime.controller.play(item.index)
            quickPick.hide()
        }
    },
    comment: () => {
        let song = runtime.controller.list().find(song => song.play)
        runtime.api.song.comment(song.id).then(data => {
            quickPick.busy = false
            fillQuickPick(data.hotComments.map(comment => ({
                id: comment.commentId,
                label: `${numberReadable(comment.likedCount)} $(heart)`,
                description: comment.content
            })), `热门评论 (${data.hotComments.length})`)
            onPickItem = item => {
                // quickPick.busy = true
                // interaction.reply(item.id)
            }
        })
    },
    search: () => {
        let hot = []
        let timer = 0
        const suggest = () => {
            const value = quickPick.value
            if (!value) quickPick.items = hot
            else runtime.api.search.keyword(value).then(data => {
                let items = (data.result && data.result.allMatch) ? data.result.allMatch.map(item => ({label: item.keyword, alwaysShow: true})) : []
                if (!items.length || items[0].label != value) items.unshift({label: value, alwaysShow: true})
                quickPick.items = items
            })
        }
        const search = (text, type) => {
            let code = {song: 1, artist: 100, album: 10, playlist: 1000}[type]
            if(!code) runtime.api.search.suggest(text).then(data => display(text, data))
            else runtime.api.search.type(text, code).then(data => display(text, data, type))
        }
        const display = (text, data, type) => {
            let songs = (data.result.songs || []).map(songFormat).map(songDisplay)
            let artists = (data.result.artists || []).map(artist => ({
                id: artist.id,
                label: artist.name
            }))
            let albums = (data.result.albums || []).map(album => ({
                id: album.id, 
                label: album.name, 
                description: `${album.artist.name} ${album.size}首`
            }))
            let playlists = (data.result.playlists || []).map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: `${numberReadable(playlist.playCount)}次播放 ${numberReadable(playlist.bookCount)}次收藏`
            }))
            songs.forEach(item => item.type = 'song')
            artists.forEach(item => item.type = 'artist')
            albums.forEach(item => item.type = 'album')
            playlists.forEach(item => item.type = 'playlist')
            let items = Array.from([]).concat(
                [{label: `${songs.length ? '▿' : '▹'}  单曲`, type: 'song'}],
                songs,
                [{label: `${artists.length ? '▿' : '▹'}  歌手`, type: 'artist'}],
                artists,
                [{label: `${albums.length ? '▿' : '▹'}  专辑`, type: 'album'}],
                albums,
                [{label: `${playlists.length ? '▿' : '▹'}  歌单`, type: 'playlist'}],
                playlists
            )
            items.filter(item => item.id).forEach(item => item.label = '     ' + item.label)
            fillQuickPick(items, `“${text}”的${{song: '歌曲', artist: '歌手', album: '专辑', playlist: '歌单'}[type] || ''}搜索结果`)
            quickPick.activeItems = [quickPick.items[{song: 0, artist: 1, album: 2, playlist: 3}[type] || 0]]
            onPickItem = item => {
                if(!item.id && item.type == type)
                    return
                else if(!item.id)
                    search(text, item.type) 
                else if(item.type == 'artist')
                    interaction.artist(item.id)
                else if(item.type == 'album')
                    interaction.album(item.id)
                else if(item.type == 'playlist')
                    interaction.playlist.detail(item.id)
                else if(item.type == 'song'){
                    runtime.controller.add(item)
                    runtime.controller.play()
                }
            }
        }
        runtime.api.search.hot().then(data => {
            hot = data.result.hots.map(item => ({label: item.first}))
            fillQuickPick(hot, `搜索歌曲、歌手、专辑、歌单`)
            onPickItem = item => {
                search(item.label)
            }
            onChangeValue = () => {
                clearTimeout(timer)
                timer = setTimeout(suggest, 250)
            }
        })
    }
}

module.exports = handle => {
    runtime = handle
    return interaction
}