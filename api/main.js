const axios = require('axios')
const encrypt = require('./crypto')
const queryString = require('querystring')

const requests = axios.create({
    baseURL: 'https://music.163.com',
    timeout: 1000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com',
        'X-Real-IP': '118.88.88.88'
    }
})


const apiRequest = (url, data) =>{
    return requests.post(url, queryString.stringify(encrypt(data))).then(response => response.data).catch(e => {})
}

const getPlaylistfromUser = id => {
    return apiRequest('/weapi/user/playlist', {
        uid: id,
        limit: 1
    }).then(data => data.playlist)
}

const getSongfromPlaylist = id => {
    return apiRequest('/weapi/v3/playlist/detail', {
        id: id,
        n: 100000
    }).then(data => data.playlist.tracks)
}

const getResourcebyId = id => {
    return apiRequest('/weapi/song/enhance/player/url', {
        ids: '[' + id + ']',
        br: 999000
    }).then(data => data.data[0].url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net').replace('http://', 'https://'))
}

// uid = 38050391

module.exports = {
    getPlaylistfromUser,
    getSongfromPlaylist,
    getResourcebyId
}