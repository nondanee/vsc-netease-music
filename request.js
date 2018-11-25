const http = require('http')
const https = require('https')
const crypto = require('crypto')
const parse = require('url').parse
const querystring = require('querystring')
let runtime = {}

const headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': 'https://music.163.com',
    'X-Real-IP': '118.88.88.88'
}

let user = {}

const encrypt = object => {
    const buffer = Buffer.from(JSON.stringify(object))
    const cipher = crypto.createCipheriv('aes-128-ecb', 'rFgB&h#%2?^eDg:Q', '')
    return {eparams: Buffer.concat([cipher.update(buffer), cipher.final()]).toString('hex').toUpperCase()}
}

const request = (method, url, body = null) => {
	url = parse(url)
	return new Promise((resolve, reject) => {
		(url.protocol == 'https:' ? https.request : http.request)({method: method, host: url.host, path: url.path, headers: headers})
		.on('response', response => resolve([201, 301, 302, 303, 307, 308].includes(response.statusCode) ? request(method, url.resolve(response.headers.location), body) : response))
		.on('error', error => reject(error)).end(body)
	})
}

const json = response => {
	return new Promise((resolve, reject) => {
		let chunks = []
		response
		.on('data', chunk => chunks.push(chunk))
		.on('end', () => resolve(JSON.parse(Buffer.concat(chunks))))
		.on('error', error => reject(error))
	})
}

const apiRequest = (path, data, load = true) => {
    let method = 'POST'
    url = parse('https://music.163.com').resolve(path.replace(/\w*api/, 'api'))
    data = querystring.stringify(encrypt({method: method, url: url, params: data}))
    url = 'https://music.163.com/api/linux/forward'
    return request(method, url, data).then(load ? json : response => response)
}

const api = {
    user: {
        detail: id => apiRequest(`/api/v1/user/detail/${id}`, {}),
        artist: () => apiRequest(`/api/artist/sublist`, {limit: 1000, offset: 0}),
        album: () => apiRequest(`/api/album/sublist`, {limit: 1000, offset: 0}),
        playlist: id => apiRequest('/api/user/playlist', {uid: id || user.id, limit: 100000})
    },
    artist: {
        song: id => apiRequest(`/api/v1/artist/${id}`, {}),
        album: id => apiRequest(`/api/artist/albums/${id}`, {limit: 1000, offset: 0}),
    },
    album: id => apiRequest(`/api/v1/album/${id}`, {}),
    playlist: {
        detail: id => apiRequest('/api/v3/playlist/detail', {id: id, n: 100000}),
        highquality: () => apiRequest('/api/playlist/highquality/list', {cat: '全部', limit: 50}),
        hot: () => apiRequest('/api/playlist/list', {cat: '全部', limit: 50, offset: 0, order: 'hot'})
    },
    toplist: () => apiRequest('/api/toplist', {}),
    song: {
        detail: id => apiRequest('/api/v3/song/detail', {c: `[{"id":'${id}'}]`, ids: `['${id}']`}),
        url: id => apiRequest('/api/song/enhance/player/url', {ids: `['${id}']`, br: 999000})
    },
    recommend: {
        song: () => apiRequest('/api/v1/discovery/recommend/songs', {limit: 30, offset: 0}),
        playlist: () => apiRequest('/api/personalized/playlist', {limit: 20, offset: 0, n: 1000})
    },
    new: {
        song: () => apiRequest('/api/v1/discovery/new/songs', {areaId: 0, limit: 50, offset: 0}),
        album: () => apiRequest('/api/album/new', {area: 'ALL', limit: 50, offset: 0})
    },
    login: (account, password) => {
        let path = '', data = {password: crypto.createHash('md5').update(password).digest('hex'), rememberLogin: 'true'}
        account.includes('@') ? (data.username = account, path = '/api/login') : (data.phone = account, path = '/api/login/cellphone')
        return apiRequest(path, data, false).then(response => {
            if (response.headers['set-cookie']) user.cookie = response.headers['set-cookie'].map(cookie => cookie.replace(/;.*/,'')).join('; ')
            return response
        })
        .then(json).then(data => {
            if (data.code == 200) {
                user.id = data.account.id
                user.name = data.profile.nickname
                sync()
                return Promise.resolve(data)
            }
            else{
                return Promise.reject(data)
            }
        })
    },
    logout: () => {
        user = {}
        sync()
    }
}

const sync = () => {
    headers['Cookie'] = ['os=linux', user.cookie].join('; ')
    runtime.globalStorage.set('user', JSON.stringify(user))
    runtime.contextState.set('logged', user.cookie ? true : false)
}

module.exports = handler => {
    runtime = handler
    user = JSON.parse(handler.globalStorage.get('user') || '{}')
    sync()
    return api
}