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
        runtime.setContext('track', true)
    },
    remove: target => {
        list.splice(target, 1)
        index = index < list.length ? index : 0
        if(list.length == 0) runtime.setContext('track', false)
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
        runtime.postMessage({command: 'play'})
        runtime.setState('playing')
    },
    pause: () => {
        runtime.postMessage({command: 'pause'})
        runtime.setState('paused')
    },
    play: target => {
        if (list.length == 0) return
        index = typeof(target) != 'undefined' ? target % list.length : index
        let song = list[index]
        runtime.api.song.url(song.id).then(data => {
            let url = data.data[0].url
            if (!url) {
                vscode.window.showWarningMessage(`该资源暂无版权  ${song.artist} - ${song.name}`)
                controller.remove(index)
                controller.play()
            }
            else {
                url = url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net')
                vscode.window.showInformationMessage(`正在播放  ${song.artist} - ${song.name}`)
                runtime.setState('playing')
                runtime.postMessage({command: 'load', data: url})
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