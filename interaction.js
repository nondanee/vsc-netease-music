const vscode = require('vscode')
const api = require('./api/storage.js')
let runtime = {}

const quickPick = array => vscode.window.showQuickPick(array, {
    // ignoreFocusOut:true,
    matchOnDescription: true,
    matchOnDetail: true
})

const operation = {
    user: {
        playlist: id => api.user(id, {playlist: true}).then(api.view).then(data => {
            quickPick(data.playlist.map(playlist => ({
                id: playlist.id,
                label: playlist.name,
                description: '@' + playlist.creator.name, 
                detail: playlist.description
            })))
            .then(choice => {
                if(choice) operation.playlist.detail(choice.id)
            })
        })
    },
    playlist: {
        detail: id => api.playlist(id, {song: true}).then(api.view).then(data => {
            quickPick(data.song.map(song => ({
                id: song.id,
                label: song.name,
                detail: song.artist.map(artist => artist.name).join('/') + ' ∙ ' + song.album.name
            })))
            .then(choice => {
                if(choice) operation.song.play(choice.id)
            })
        })
    },
    song: {
        play: id => api.song(id, {url: true}).then(api.view).then(song => {
            let url = song.url
            if (!url) {
                vscode.window.showWarningMessage('该资源暂无版权')
            }
            else {
                url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
                vscode.window.showInformationMessage('正在播放: ' + song.artist.map(artist => artist.name).join('/') + ' - ' + song.album.name)
                runtime.postMessage({command: 'load', data: url})
            }
        })
    } 
}

module.exports = (handler) => {
    runtime = handler
    return operation
}
