# Download
> See details on how to create a manifest [here](./manifest.md)

# Contents
- [Bongo.Downloader](#bongo.downloader)
    - [startFetching](#startFetching)
    - [on("manifest", ...)](#Event-manifest))
    - [on("status", ...)](#Event-status)
    - [on("end", ...)](#Event-end)
    - [on("error", ...)](#Event-error)

# Bongo Downloader
This the class that downloads your file.
```js
const downloader = new Bongo.Downloader(options)
```
where options is
| Property | Description | Default |
|-|-|-|
| manifest? | A [parsed manifest](manifest.md#json-format). |
| manifest_path? | A local path to your manifest file |
| manifest_url? | An url where Bongo should download the manifest |
| startAuto? | If Bongo should start downloading right away. | true |
| stateDir? | The temporary directory where Bongo will download pieces. | (temporary directory)/bongo-{random string} |
| concurrent? | The number of concurrent requests bongo can make. | 10 |
| emitStatus? | If Bongo should emit the "status" event. Please note that in some case, this can slow down the download a bit | false |

You must suply one of "manifest"|"manifest_url"|"manifest_path"

## startFetching
This function will be called when the manifest is resolved. 
Please note that if you disabled `startAuto` in the constructor options, you have the responsability to call this function yourself.
```ts
function startFetching(manifest:Manifest):void
```

## Event manifest
This event is emitted when the manifest is resolved.
```js
downloader.on("manifest", manifest => {
    // Do whatever you want with it.
})
```

## Event status
This event is emitted when Bongo fetchs new bytes. 
> This event is only emitted if you set `emitStatus` to `true` in the constructor options.
```ts
interface Status {
    total: number,
    downloaded: number,
    ratio: number,
    percentage: number,
    start: number,
    elapsed: number,
    average_speed: number
}
```
For exmaple, to put the progress in the console
```js
downloader.on("status", status => {
    // Do whatever you want with it.
    const progress40 = Math.round(status.ratio*40)
    let progress = `\x1b[47m${" ".repeat(progress40)}\x1b[40m${" ".repeat(40-progress40)}`
    let percentage = status.percentage.toFixed(2)
    const numberLength = percentage.split(".")[0].length
    if(numberLength < 2){
        percentage = "0"+percentage
    }
    process.stdout.write(`\x1b[2K\x1b[0G[${progress}] ${percentage}%`)
}).on("end", () => {
    // Clear the current console line.
    process.stdout.write("\x1b[2K\x1b[0G")
})
```

## Event end
This event is emitted when the download finished.
```js
const fs = require("fs")
downloader.on("end", filepath => {
    // Move the file from Bongo's temporary directory, to somewhere else.
    fs.renameSync(filepath, "./file.txt")
    console.log("Download finished.")
})
```

## Event error
This event is emitted when the download failed.
```js
downloader.on("error", err => {
    console.error("Download failed.")
    console.errror(err)
})
```