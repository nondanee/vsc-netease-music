let runtime
let timeoutHandler

const SpeedUp = () => {
    let lastTrigger = Date.now()
    let delta = 999999
    let counter = 0
    return function(){
            let now = Date.now()
            delta = now - lastTrigger
            lastTrigger = now
            console.log(`counter: ${counter}\ndelta: ${delta}\nlastTrigger: ${lastTrigger}`)
            if(delta < 500){
                counter++
            }else{
                counter = 0
            }
            if(counter>3){
                counter = 0
                return true
            }
            return false
    }
}

const speedUp = SpeedUp()


const coding = {
    on: () => {
        runtime.contextState.set("type",true)
        runtime.postMessage({ command: 'typeOn' })
    },
    off: () => {
        runtime.contextState.set("type",false)
        runtime.postMessage({ command: 'typeOff' })
    },
    onType: (event) => {
        const key = event.contentChanges[0].text
        if (!key) return
        if (!runtime.contextState.get("type")) return
        if(speedUp()){
            runtime.postMessage({ command: 'speedup' })
        }
        clearTimeout(timeoutHandler)
        timeoutHandler = setTimeout(() => {
            runtime.postMessage({ command: 'pause' })
        }, 5000)
    },
    debugOn: () => {
        runtime.controller.next()
    },
    debugOff: () => {
        runtime.controller.previous()
    }
}

module.exports = handler => {
    runtime = handler
    return coding
}