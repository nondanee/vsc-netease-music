const spawn = require('child_process').spawn
const platform = require('os').platform()

const player = {
    process: null,
    paused: false,
    load: function(uri){
        this.clean()
        this.process = spawn('mpg123', [uri])
        this.process.on('exit', (code, sig) => {
            if (code !== null && sig === null) {
                this.process = null
            }
        })
    },
    pause: function(){
        if(!this.process || this.paused) return
        if(platform === 'win32')
            spawn('pssuspend', [this.process.pid])
        else
            this.process.kill('SIGSTOP')
        this.paused = true
    },
    resume: function(){
        if(!this.process || !this.paused) return
        if(platform === 'win32')
            spawn('pssuspend', ['-r', this.process.pid])
        else
            this.process.kill('SIGCONT')
        this.paused = false
    },
    clean: function(){
        if(!this.process) return
        this.process.kill('SIGTERM')
        this.process = null
    }
}

module.exports = player


// player.load('C:\\Users\\Nzix\\Desktop\\a.mp3')
// client.end('L C:\\Users\\Nzix\\Desktop\\a.mp3')
// client = net.connect('\\\\.\\pipe\\mpg123')