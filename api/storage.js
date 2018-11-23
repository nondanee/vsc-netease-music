const api = require('./request')

const cache = {
    album: {},
    playlist: {},
    artist: {},
    song: {},
    user: {}
}

const update = {
    album: data => {
        let id = data.id
        if(!(id in cache.album)) cache.album[id] = {}
        set(cache.album[id], 'name', data.name)
        set(cache.album[id], 'cover', data.picUrl)
        set(cache.album[id], 'publish', data.publishTime)
        if(data.artists)
            data.artists.forEach(artist => update.artist(artist))
        if(data.songs){
            set(cache.album[id], 'song', data.songs.map(song => song.id))
            data.songs.forEach(song => update.song(song))
        }
    },
    playlist: data => {
        let id = data.id
        if(!(id in cache.playlist)) cache.playlist[id] = {}
        set(cache.playlist[id], 'name', data.name)
        set(cache.playlist[id], 'description', data.description)
        set(cache.playlist[id], 'cover', data.coverImgUrl || data.picUrl)
        set(cache.playlist[id], 'plays', data.playCount)
        set(cache.playlist[id], 'songs', data.trackCount)
        if(data.trackIds && data.tracks){
            set(cache.playlist[id], 'song', data.trackIds.map(song => song.id))
            data.tracks.forEach(song => update.song(song))
        }
        set(cache.playlist[id], 'creator', data.creator.userId)
        update.user(data.creator)
    },
    artist: data => {
        let id = data.id
        if(!(id in cache.artist)) cache.artist[id] = {}
        set(cache.artist[id], 'name', data.name)
        set(cache.artist[id], 'portrait', data.img1v1Url)
        if(data.hotSongs){
            set(cache.artist[id], 'song', data.hotSongs.map(song => song.id))
            data.hotSongs.forEach(song => update.song(song))
        }
        if(data.hotAlbums){
            set(cache.artist[id], 'album', data.hotAlbums.map(album => album.id))
            data.hotAlbums.forEach(album => update.album(album))
        }
    },
    song: data => {
        let id = data.id
        if(!(id in cache.song)) cache.song[id] = {}
        set(cache.song[id], 'name', data.name)
        set(cache.song[id], 'artist', data.ar.map(artist => artist.id))
        set(cache.song[id], 'album', data.al.id)
        update.album(data.al)
        data.ar.forEach(artist => update.artist(artist))
    },
    url: data => {
        let id = data.id
        if(!(id in cache.song)) cache.song[id] = {}
        set(cache.song[id], 'life', Date.now() + data.expi * 1000)
        set(cache.song[id], 'url', (data.url || '').replace('http://', 'https://'))
    },
    user: data => {
        let id = data.userId
        if(!(id in cache.user)) cache.user[id] = {}
        set(cache.user[id], 'name', data.nickname)
        set(cache.user[id], 'avatar', data.avatarUrl)
        if(data.playlist){
            set(cache.user[id], 'playlist', data.playlist.map(playlist => playlist.id))
            data.playlist.forEach(playlist => update.playlist(playlist))
        }
    },
}

const set = (object, key, value) => {
    if(!value) return
    if(Array.isArray(value) && value.length === 0) return
    object[key] = value
}

const fetch = {
    album: id => api.album(id).then(data => {
        data.album.songs = data.songs
        update.album(data.album)
    }),
    playlist: id => api.playlist.detail(id).then(data => {
        update.playlist(data.playlist)
    }),
    artist: {
        song: id => api.artist.song(id).then(data => {
            data.artist.hotSongs = data.hotSongs
            update.artist(data.artist)
        }),
        album: id => api.artist.album(id).then(data => {
            data.artist.hotAlbums = data.hotAlbums
            update.artist(data.artist)
        }),
    },
    song: {
        detail: id => api.song.detail(id).then(data => {
            data.songs.forEach(song => update.song(song))
        }),
        url: id => api.song.url(id).then(data => {
            data.data.forEach(song => update.url(song))
        })
    },
    user: {
        detail: id => api.user.detail(id).then(data => {
            update.user(data.profile)
        }),
        playlist: id => api.user.playlist(id).then(data => {
            data.userId = id
            update.user(data)
        })
    }
}

const clone = object => JSON.parse(JSON.stringify(object))

const obtain = {
    album: (id, flag = {}) => {
        let hit = cache.album[id] || ''
        if((!hit) || (flag.song && !hit.song))
            return fetch.album(id).then(() => clone(cache.album[id]))
        else
            return Promise.resolve(clone(cache.album[id]))
    },
    song: (id, flag = {}) => {
        let hit = cache.song[id] || ''
        if(!hit && !flag.url)
            return fetch.song.detail(id).then(() => clone(cache.song[id]))
        else if(!hit && flag.url)
            return Promise.all([fetch.song.detail(id), fetch.song.url(id)]).then(() => clone(cache.song[id]))
        else if((!hit.url || hit.life < Date.now()) && flag.url)
            return fetch.song.url(id).then(() => clone(cache.song[id]))
        else
            return Promise.resolve(clone(cache.song[id]))
    },
    playlist: (id, flag = {}) => {
        let hit = cache.playlist[id] || ''
        if((!hit) || (flag.song && !hit.song))
            return fetch.playlist(id).then(() => clone(cache.playlist[id]))
        else
            return Promise.resolve(clone(cache.playlist[id]))
    },
    user: (id, flag = {}) => {
        let hit = cache.user[id] || ''
        if(flag.playlist && !hit.playlist)
            return fetch.user.playlist(id).then(() => clone(cache.user[id]))
        else if(!hit)
            return fetch.user.detail(id).then(() => clone(cache.user[id]))
        else
            return Promise.resolve(clone(cache.user[id]))
    },
    artist: (id, flag = {}) => {
        let hit = cache.artist[id] || ''
        if(flag.album && !hit.album)
            return fetch.artist.album(id).then(() => clone(cache.artist[id]))
        else if(!hit)
            return fetch.artist.song(id).then(() => clone(cache.artist[id]))
        else
            return Promise.resolve(clone(cache.artist[id]))
    },
    data: cache,
    view: data => new Promise((resolve, reject) => {
        let task = []
        if(data.life) delete data.life
        if(data.artist){
            data.artist.forEach((id, index) => {
                task.push(obtain.artist(id).then(artist => {
                    artist.id = id
                    if(artist.song) delete artist.song
                    if(artist.album) delete artist.album
                    data.artist[index] = artist
                }))
            })
        }
        if(data.song){
            data.song.forEach((id, index) => {
                task.push(obtain.song(id).then(song => {
                    song.id = id
                    if(song.life) delete song.life
                    data.song[index] = song
                    task.push(obtain.view(song).then(() => {}))
                }))
            })
        }
        if(data.creator){
            task.push(obtain.user(data.creator).then(user => {
                user.id = data.creator
                if(user.playlist) delete user.playlist
                data.creator = user
            }))
        }
        if(data.playlist){
            data.playlist.forEach((id, index) => {
                task.push(obtain.playlist(id).then(playlist => {
                    playlist.id = id
                    if(playlist.song) delete playlist.song
                    data.playlist[index] = playlist
                    task.push(obtain.view(playlist).then(() => {}))
                }))
            })
        }
        if(data.album && !Array.isArray(data.album)){
            task.push(obtain.album(data.album).then(album => {
                if(album.song) delete album.song
                album.id = data.album
                data.album = album
            }))
        }
        if(data.album && Array.isArray(data.album)){
            data.album.forEach((id, index) => {
                task.push(obtain.album(id).then(album => {
                    album.id = id
                    if(album.song) delete album.song
                    data.album[index] = album
                }))
            })
        }
        return Promise.all(task).then(() => resolve(data))
    })
}

module.exports = obtain