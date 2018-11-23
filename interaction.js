const vscode = require('vscode')
const cache = require('./api/storage.js')
const api = require('./api/request.js')
let runtime = {}

const quickPick = vscode.window.createQuickPick()
let onPickItem = item => {}
quickPick.canSelectMany = false
quickPick.matchOnDescription = true
quickPick.matchOnDetail = true
quickPick.onDidAccept(() => onPickItem(quickPick.selectedItems[0]))

const fillQuickPick = (items, title) => {
    quickPick.items = items
    quickPick.placeholder = title
    quickPick.show()
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
    if (number / 100000 > 0)
        return `${parseInt(number / 10000)}万`
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

const operation = {
    user: {
        playlist: id => cache.user(id, {playlist: true}).then(cache.view).then(data => {
            quickPick.busy = false
            fillQuickPick(data.playlist.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: `${(playlist.songs || 0)}首`,
            })), '我的歌单')
            onPickItem = item => {
                quickPick.busy = true
                operation.playlist.detail(item.id)
            }
        }),
        artist: () => api.user.artist().then(data => {
            quickPick.busy = false
            fillQuickPick(data.data.map(artist => ({
                id: artist.id,
                label: artist.name,
                description: `${artist.albumSize || 0}张专辑`,
            })), '我的歌手')
            onPickItem = item => {
                quickPick.busy = true
                operation.artist(item.id)
            }
        }),
        album: () => api.user.album().then(data => {
            quickPick.busy = false
            fillQuickPick(data.data.map(album => ({
                id: album.id,
                label: album.name,
                description: `${album.artists.map(artist => artist.name).join(' / ')}  ${album.size}首`,
            })), '我的专辑')
            onPickItem = item => {
                quickPick.busy = true
                operation.album(item.id)
            }
        })
    },
    artist: id => cache.artist(id, {album: true}).then(cache.view).then(data => {
        quickPick.busy = false
        fillQuickPick(data.album.map(album => ({
            id: album.id,
            label: album.name,
            description: dateFormat(album.publish),
        })), data.name)
        onPickItem = item => {
            quickPick.busy = true
            operation.album(item.id)
        }
    }),
    album: id => cache.album(id, {song: true}).then(cache.view).then(data => {
        quickPick.busy = false
        fillQuickPick(data.song.map(song => ({
            id: song.id,
            label: song.name,
            description: `${song.artist.map(artist => artist.name).join(' / ')} - ${song.album.name}`
        })), data.name)
        onPickItem = item => {
            quickPick.busy = true
            operation.song.play(item.id)
        }
    }),
    toplist: () => api.toplist().then(data => {
        quickPick.busy = false
        fillQuickPick(data.list.map(playlist => ({
            id: playlist.id,
            label: playlist.name,
            description: `${dateFriendly(playlist.updateTime)}前更新`,
        })), '排行榜')
        onPickItem = item => {
            quickPick.busy = true
            operation.playlist.detail(item.id)
        }
    }),
    playlist: {
        detail: id => cache.playlist(id, {song: true}).then(cache.view).then(data => {
            quickPick.busy = false
            fillQuickPick(data.song.map((song, index) => ({
                id: song.id,
                label: `${index + 1}. ${song.name}`,
                description: `${song.artist.map(artist => artist.name).join(' / ')} - ${song.album.name}`
            })), `${data.name} by ${data.creator.name}`)
            onPickItem = item => {
                quickPick.busy = true
                operation.song.play(item.id)
            }
        }),
        hot: () => api.playlist.hot().then(data => {
            quickPick.busy = false
            fillQuickPick(data.playlists.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: `by ${playlist.creator.nickname}  ${numberReadable(playlist.playCount)}次播放`
            })), '热门歌单')
            onPickItem = item => {
                quickPick.busy = true
                operation.playlist.detail(item.id)
            }
        }),
        highquality: () => api.playlist.highquality().then(data => {
            quickPick.busy = false
            fillQuickPick(data.playlists.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: `by ${playlist.creator.nickname}  ${numberReadable(playlist.playCount)}次播放`
            })), '精品歌单')
            onPickItem = item => {
                quickPick.busy = true
                operation.playlist.detail(item.id)
            }
        })
    },
    song: {
        play: id => cache.song(id, {url: true}).then(cache.view).then(song => {
            let url = song.url
            if (!url) {
                vscode.window.showWarningMessage('该资源暂无版权')
            }
            else {
                url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
                vscode.window.showInformationMessage('正在播放: ' + `${song.artist.map(artist => artist.name).join(' / ')} - ${song.name}`)
                runtime.setState('playing')
                runtime.postMessage({command: 'load', data: url})
            }
        })
    },
    recommend: {
        song: () => api.recommend.song().then(data => {
            quickPick.busy = false
            fillQuickPick(data.recommend.map(song => ({
                id: song.id,
                label: song.name,
                description: `${song.artists.map(artist => artist.name).join(' / ')} - ${song.album.name}`,
            })), '每日歌曲推荐')
            onPickItem = item => {
                quickPick.busy = true
                operation.song.play(item.id)
            }
        }),
        playlist: () => api.recommend.playlist().then(data => {
            quickPick.busy = false
            fillQuickPick(data.result.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: playlist.copywriter,
            })), '推荐歌单')
            onPickItem = item => {
                quickPick.busy = true
                operation.playlist.detail(item.id)
            }
        })
    },
    new: {
        song: () => api.new.song().then(data => {
            quickPick.busy = false
            fillQuickPick(data.data.map(song => ({
                id: song.id,
                label: song.name,
                description: `${song.artists.map(artist => artist.name).join(' / ')} - ${song.album.name}`
            })), '新歌速递')
            onPickItem = item => {
                quickPick.busy = true
                operation.song.play(item.id)
            }
        }),
        album: () => api.new.album().then(data => {
            quickPick.busy = false
            fillQuickPick(data.albums.map(album => ({
                id: album.id,
                label: album.name,
                description: `${album.artists.map(artist => artist.name).join(' / ')}  ${dateFormat(album.publishTime)}`,
            })), '新碟上架')
            onPickItem = item => {
                quickPick.busy = true
                operation.album(item.id)
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
                if(account && password){
                    console.log('got', account, password)
                }
            })
        })
    }
}

module.exports = (handler) => {
    runtime = handler
    return operation
}