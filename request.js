const http = require('http')
const https = require('https')
const crypto = require('crypto')
const parse = require('url').parse
const querystring = require('querystring')

let user = {}

const encrypt = object => {
	const buffer = Buffer.from(JSON.stringify(object))
	const cipher = crypto.createCipheriv('aes-128-ecb', 'rFgB&h#%2?^eDg:Q', '')
	return {eparams: Buffer.concat([cipher.update(buffer), cipher.final()]).toString('hex').toUpperCase()}
}

const request = (method, url, headers, body = null) => {
	url = parse(url)
	return new Promise((resolve, reject) => {
		(url.protocol == 'https:' ? https.request : http.request)({method: method, host: url.host, path: url.path, headers: headers})
		.on('response', response => resolve([201, 301, 302, 303, 307, 308].includes(response.statusCode) ? request(method, url.resolve(response.headers.location), headers, body) : response))
		.on('error', error => reject(error)).end(body)
	})
}

const json = response => {
	return new Promise((resolve, reject) => {
		let chunks = []
		response
		.on('data', chunk => chunks.push(chunk))
		.on('end', () => {try{resolve(JSON.parse(Buffer.concat(chunks)))}catch(error){reject(error)}})
		.on('error', error => reject(error))
	})
}

const apiRequest = (path, data, load = true) => {
	const method = 'POST'
	const url = 'https://music.163.com/api/linux/forward'
	const headers = {
		'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
		'Content-Type': 'application/x-www-form-urlencoded',
		'Referer': 'https://music.163.com',
		'X-Real-IP': '118.88.88.88',
		'Cookie': ['os=linux', user.cookie].join('; ')
	}
	data = querystring.stringify(encrypt({method: method, url: parse('https://music.163.com').resolve(`/api/${path}`), params: data}))
	return request(method, url, headers, data).then(load ? json : response => response)
}

const api = {
	user: {
		detail: id => apiRequest(`v1/user/detail/${id}`, {}),
		artist: () => apiRequest(`artist/sublist`, {limit: 1000, offset: 0}),
		album: () => apiRequest(`album/sublist`, {limit: 1000, offset: 0}),
		playlist: id => apiRequest('user/playlist', {uid: id || user.id, limit: 100000}),
		likes: () => apiRequest('song/like/get', {})
	},
	artist: {
		song: id => apiRequest(`v1/artist/${id}`, {top: 50}),
		album: id => apiRequest(`artist/albums/${id}`, {limit: 1000, offset: 0}),
	},
	album: id => apiRequest(`v1/album/${id}`, {}),
	playlist: {
		detail: id => apiRequest('v3/playlist/detail', {id: id, n: 100000}),
		highquality: () => apiRequest('playlist/highquality/list', {cat: '全部', limit: 50}),
		hot: () => apiRequest('playlist/list', {cat: '全部', limit: 50, offset: 0, order: 'hot'})
	},
	toplist: () => apiRequest('toplist', {}),
	song: {
		detail: id => apiRequest('v3/song/detail', {c: `[{"id":'${id}'}]`, ids: `['${id}']`}),
		url: id => apiRequest('song/enhance/player/url', {ids: `['${id}']`, br: 999000}),
		lyric: id => apiRequest('song/lyric', {id: id, lv: -1, tv: -1, cp: false}),
		like: id => apiRequest('song/like', {trackId: id, like: true, time: 0, userid: 0}),
		dislike: id => apiRequest('song/like', {trackId: id, like: false, time: 0, userid: 0}),
		comment: id => apiRequest(`v1/resource/hotcomments/R_SO_4_${id}`, {rid: id, limit: 50, offset: 0})
	},
	recommend: {
		song: () => apiRequest('v1/discovery/recommend/songs', {limit: 30, offset: 0}),
		playlist: () => apiRequest('personalized/playlist', {limit: 20, offset: 0, n: 1000})
	},
	new: {
		song: () => apiRequest('v1/discovery/new/songs', {areaId: 0, limit: 50, offset: 0}),
		album: () => apiRequest('album/new', {area: 'ALL', limit: 50, offset: 0})
	},
	search: {
		keyword: text => apiRequest('search/suggest/keyword', {s: text}),
		suggest: text => apiRequest('search/suggest/web', {s: text}),
		type: (text, type) => apiRequest('search/get', {s: text, type: type, limit: 20, offset: 0}),
		hot: () => apiRequest('search/hot', {type: 1111})
	},
	login: (account, password) => {
		let path = '', data = {password: crypto.createHash('md5').update(password).digest('hex'), rememberLogin: 'true'}
		account.includes('@') ? (data.username = account, path = 'login') : (data.phone = account, path = 'login/cellphone')
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
	},
	refresh : () => {
		user = JSON.parse(runtime.globalStorage.get('user') || '{}')
		sync()
	}
}

const sync = () => {
	runtime.globalStorage.set('user', JSON.stringify(user))
	runtime.stateManager.set('logged', user.cookie ? true : false)
}

module.exports = api
const runtime = require('./runtime.js')