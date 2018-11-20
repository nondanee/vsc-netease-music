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
        'X-Real-IP': '118.88.88.88',
        'Cookie': 'os=pc'
    }
})

const weapiRequest = (url, data) => requests.post(url, queryString.stringify(encrypt(data))).then(response => response.data)

module.exports = {
    user: {
        detail: id => weapiRequest(`/weapi/v1/user/detail/${id}`, {}),
        playlist: id => weapiRequest('/weapi/user/playlist', {uid: id, limit: 100000})
    },
    artist: {
        song: id => weapiRequest(`/weapi/v1/artist/${id}`, {}),
        album: id => weapiRequest(`/weapi/artist/albums/${id}`, {}),
    },
    album: id => weapiRequest(`/weapi/v1/album/${id}`, {}),
    playlist: {
        detail: id => weapiRequest('/weapi/v3/playlist/detail', {id: id, n: 100000})
    },
    song: {
        detail: id => weapiRequest('/weapi/v3/song/detail', {c: `[{"id":'${id}'}]`, ids: `['${id}']`}),
        url: id => weapiRequest('/weapi/song/enhance/player/url', {ids: `['${id}']`, br: 999000})
    }
}