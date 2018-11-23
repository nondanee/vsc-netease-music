const storage = require('./storage')

// storage.user(38050391).then((data) => {
//     storage.view(data).then((data2) => {
//         console.log(JSON.stringify(data2, null, 4))
//     })
// })

// .then(data => data.data[0].url.replace(/(m\d+?)(?!c)\.music\.126\.net/, '$1c.music.126.net').replace('http://', 'https://'))


// storage.playlist(31725162, {song: true}).then(data => {
//     // console.log(data)
//     console.log(storage.data)
// })

storage.artist(12009134, {album: true}).then(storage.view).then(data => {
    console.log(data)
})