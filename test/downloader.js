const { Downloader } = require("..")
const { join, dirname } = require("path")
const { rename, rmdir } = require("fs/promises")

describe("Downloader", () => {
    it("should download Lightcord from lightcord.org/github.com", () => {
        const start = Date.now()
        let manifest
        const downloader = new Downloader({
            manifest_path: join(__dirname, "lightcord.manifest")
        })
        downloader.on("manifest", m => (manifest = m))
        downloader.on("end", async (filepath) => {
            const end = Date.now()
            const time = end-start
            console.log(`\nLightcord downloaded. Transferred ${manifest.filesize} in ${time}ms (${manifest.filesize/(time/1000)} byte/s)`)
            
            await rename(filepath, "./lightcord-win32-ia32.zip")
            await rmdir(dirname(filepath), {recursive: true})
        })
        downloader.on("status", status => {
            const progress20 = Math.round(status.ratio*40)
            let progress = `\x1b[47m${" ".repeat(progress20)}\x1b[40m${" ".repeat(40-progress20)}`
            let percentage = String(status.percentage)
            const numberLength = percentage.split(".")[0].length
            if(numberLength < 2){
                percentage = "0"+percentage
            }
            const periodLength = percentage.split(".")[1]?.length
            if(!periodLength){
                percentage += ".00"
            }else if(periodLength < 2){
                percentage = percentage+"0"
            }
            process.stdout.write(`\x1b[2K\x1b[0G[${progress}] ${percentage}%`)
        })
    })
})