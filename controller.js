const vscode = require('vscode')
let runtime = {}
let list = []
let index = 0

const format = song => ({id: song.id, name: song.name, album: song.album, artist: song.artist})

const controller = {
    add: track => {
        if(Array.isArray(track)){
            list = track.map(format)
            index = 0
        }
        else{
            index = list.length
            list.splice(index, 0, format(track))
        }
        runtime.contextState.set('track', true)
    },
    remove: target => {
        list.splice(target, 1)
        index = index < list.length ? index : 0
        if(list.length == 0) runtime.contextState.set('track', false)
    },
    previous: () => {
        if (list.length == 0) return
        index = (index - 1 + list.length) % list.length
        controller.play()
    },
    next: () => {
        if (list.length == 0) return
        index = (index + 1 + list.length) % list.length
        controller.play()
    },
    resume: () => {
        if (list.length == 0) return
        let paused = !!runtime.contextState.get('paused')
        if (paused) runtime.postMessage({command: 'play'})
        return paused
    },
    pause: () => {
        if (list.length == 0) return
        let playing = !!runtime.contextState.get('playing')
        if (playing) runtime.postMessage({command: 'pause'})
        return playing
    },
    play: target => {
        if (list.length == 0) return
        index = typeof(target) != 'undefined' ? target % list.length : index
        let song = list[index]
        runtime.api.song.url(song.id).then(data => {
            let url = data.data[0].url
            if (!url) {
                vscode.window.showWarningMessage(`无法播放: ${song.artist} - ${song.name}`)
                controller.remove(index)
                controller.play()
            }
            else {
                url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
                song.url = url
                runtime.postMessage({command: 'load', data: song})
                runtime.contextState.set('paused', true)
                controller.resume()
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
}

module.exports = handler => {
    runtime = handler
    return controller
}