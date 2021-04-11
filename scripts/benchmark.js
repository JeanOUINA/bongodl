const os = require("os")
const byteSize = require("byte-size")
require("modernlog").patch()
const backticks = "```"
const osName = ({
    win32: "Windows",
    darwin: "Mac"
})[process.platform] || "Linux/Unknown"

const bongo = require("..")
const { readFileSync } = require("fs")
const { join, dirname } = require("path")
const manifest = bongo.parseManifest(readFileSync(join(__dirname, "lightcord.manifest")))

const benchmarkMD = (variables) => {
    const cpus = {}
    os.cpus().forEach(cpu => {
        cpus[cpu.model] = (cpus[cpu.model] || 0)+1
    })
    return `# Benchmarks
Please see the [Configuration](#Configuration) used for this Benchmark.
## Results
The benchmark took ${variables.time} seconds.<br>
| Method | File Size | Elapsed Time | Average Speed |
|-|-|-|-|
${variables.tests.sort((a, b) => a[1] - b[1]).map((test, i) => {
    let name =test[0]
    const filesize = byteSize(manifest.filesize, {units: "metric_octet"})
    let time = (test[1]/1000).toFixed(2)+"s"
    let speed = byteSize(manifest.filesize/(test[1]/1000), {units: "metric_octet"})+"/s"
    if(i === 0){
        name = `**${name}**`
        time = `**${time}**`
        speed = `**${speed}**`
    }
    return `|${name}|${filesize}|${time}|${speed}|`
}).join("\n")}

## Configuration
${backticks}
OS:             ${osName} ${os.release()}
Version:        ${os.version()}
Arch:           ${os.arch()}
CPUs:           ${Object.entries(cpus).map(([cpuName, times]) => `${times}x ${cpuName}`).join(", ")}
Memory:         ${byteSize(os.totalmem(), {units: "metric_octet"})}

File URL(s):    ${manifest.downloads.join(", ")}
File size:      ${byteSize(manifest.filesize, {units: "metric_octet", precision: 6})}
Integrity:      ${manifest.integrity}
Pieces:         ${manifest.pieces.length}

${manifest.pieces.map(e => `Range ${e.range.join("-")} (${byteSize(e.range[1]-e.range[0], {units: "metric_octet"})}), Integrity ${e.integrity}`).join("\n")}
${backticks}`
}

const fetch = require("node-fetch").default
const { rmdir, mkdir, rename, writeFile } = require("fs/promises")
const { createWriteStream } = require("fs")

;(async () => {
    console.log("Starting benchmark.")
    const startTime = Date.now()
    const tmp = join(__dirname, "benchmark_tmp")
    await rmdir(tmp, {recursive: true})
    await mkdir(tmp, {recursive: true})
    console.info(`#1 node-fetch (with status)`)
    const startOne = Date.now()
    await new Promise((resolve, reject) => {
        fetch(manifest.downloads[0])
        .then(res => {
            if(!res.ok)throw new Error("Server didn't return an ok status code.")
            let downloaded = 0
            const stream = createWriteStream(join(tmp, "lightcord-1.zip"))
            res.body.on("data", (chunk) => {
                downloaded += chunk.length
                stream.write(chunk)
                const progress20 = Math.round((downloaded/manifest.filesize)*40)
                let progress = `\x1b[47m${" ".repeat(progress20)}\x1b[40m${" ".repeat(40-progress20)}`
                let percentage = ((downloaded/manifest.filesize)*100).toFixed(2)
                const numberLength = percentage.split(".")[0].length
                if(numberLength < 2){
                    percentage = "0"+percentage
                }
                process.stdout.write(`\x1b[2K\x1b[0G[${progress}] ${percentage}%`)
            }).on("end", () => {
                // back at the start of the line.
                process.stdout.write("\x1b[2K\x1b[0G")
                stream.end()
                if(manifest.filesize !== downloaded){
                    // download failed
                    return reject(new Error("Download failed. Size doesn't match."))
                }
                resolve()
            })
        }, reject)
    })
    const timeOne = Date.now() - startOne
    console.log(`#1 node-fetch (with status) finished in ${(timeOne/1000).toFixed(2)} seconds.`)
    /*console.info(`#2 node-fetch`)
    console.warn(`This test will not output anything. Please don't exit.`)
    const startTwo = Date.now()
    await new Promise((resolve, reject) => {
        fetch(manifest.downloads[0])
        .then(res => {
            if(!res.ok)throw new Error("Server didn't return an ok status code.")
            let downloaded = 0
            const stream = createWriteStream(join(tmp, "lightcord-2.zip"))
            res.body.on("data", (chunk) => {
                downloaded += chunk.length
                stream.write(chunk)
            }).on("end", () => {
                stream.end()
                if(manifest.filesize !== downloaded){
                    // download failed
                    return reject(new Error("Download failed. Size doesn't match."))
                }
                resolve()
            })
        }, reject)
    })
    const timeTwo = Date.now() - startTwo
    console.log(`#2 node-fetch finished in ${(timeTwo/1000).toFixed(2)} seconds.`)
    console.info(`#3 Bongo`)
    console.warn(`This test will not output anything. Please don't exit.`)
    const startThree = Date.now()
    await new Promise(async (resolve, reject) => {
        const bongotmp = join(tmp, "bongo-1")
        await mkdir(bongotmp, {recursive: true})

        new bongo.Downloader({
            manifest: manifest,
            concurrent: 10,
            emitStatus: false,
            startAuto: true,
            stateDir: join(tmp, "bongo-1")
        }).on("end", async (filepath) => {
            await rename(filepath, join(tmp, "lightcord-3.zip"))
            await rmdir(dirname(filepath), {recursive: true})
            resolve()
        }).on("error", reject)
    })
    const timeThree = Date.now() - startThree
    console.log(`#3 Bongo finished in ${(timeThree/1000).toFixed(2)} seconds.`)*/
    console.info(`#4 Bongo (with status)`)
    const startFour = Date.now()
    await new Promise(async (resolve, reject) => {
        const bongotmp = join(tmp, "bongo-1")
        await mkdir(bongotmp, {recursive: true})

        new bongo.Downloader({
            manifest: manifest,
            concurrent: 10,
            emitStatus: true,
            startAuto: true,
            stateDir: join(tmp, "bongo-1")
        }).on("status", status => {
            const progress40 = Math.round(status.ratio*40)
            let progress = `\x1b[47m${" ".repeat(progress40)}\x1b[40m${" ".repeat(40-progress40)}`
            let percentage = status.percentage.toFixed(2)
            const numberLength = percentage.split(".")[0].length
            if(numberLength < 2){
                percentage = "0"+percentage
            }
            process.stdout.write(`\x1b[2K\x1b[0G[${progress}] ${percentage}%`)
        }).on("end", async (filepath) => {
            process.stdout.write("\x1b[2K\x1b[0G")

            await rename(filepath, join(tmp, "lightcord-4.zip"))
            await rmdir(dirname(filepath), {recursive: true})
            resolve()
        }).on("error", reject)
    })
    const timeFour = Date.now() - startFour
    console.log(`#4 Bongo (with status) finished in ${(timeFour/1000).toFixed(2)} seconds.`)
    console.info(`Generating benchmarks.md ...`)
    const data = benchmarkMD({
        tests: [
            //["node-fetch", timeTwo],
            ["node-fetch", timeOne],
            //["Bongo", timeThree],
            ["Bongo", timeFour]
        ],
        time: ((Date.now()-startTime)/1000).toFixed(2)
    })
    await writeFile(join(__dirname, "../benchmarks.md"), data)
})()