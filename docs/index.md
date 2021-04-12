# Contents
- [Installation](#installation)
- [Usage](#installation)
    - [Create a manifest from a file](#create-a-manifest-from-a-file)
    - [Download a file from a manifest](#download-a-file-from-a-manifest)
    - [Create a manifest from a file](#installation)
- [Manifest](manifest.md)
# Installation
Bongodl is available in the npm registry. Install using npm
```sh
npm install bongodl
```
or yarn
```sh
yarn add bongodl
```
# Usage
## Create a manifest from a file
See [api](./manifest.md#bongocreatemanifest)
```js
const Bongo = require("bongodl")
const { join } = require("path")
const fs = require("fs/promises")

// Let's suppose you have a `file.txt` in the same folder as your .js
const filepath = join(__dirname, "file.txt")
console.log(`Creating manifest for file.txt !`)
Bongo.createManifest({
    // Download url(s). Will be used as a fallback 
    // in case the first server is down
    downloads: ["https://example.com/file.txt", "https://example2.com/file.txt"],
    // The local path to your file
    filepath: filepath,
    // Optionnal parameter. The default is 25 MB
    pieceSize: 25e6
}).then(manifest => {
    // The manifest has been created. Save it somewhere
    return fs.writeFile(
        join(__dirname, "file.txt.manifest"),
        // Format the manifest as string. Possible values are:
        // string: Display the manifest in a nice, humanly readable way.
        // buffer: The most compact way. It will not be human-readable.
        // json: Render the manifest in "Javascript Object Notation" way. 
        //     This is the least compact.
        Bongo.formatManifest(manifest, "string")
    )
}).then(() => console.log("file.txt manifest saved !"))
```
You can now share this manifest, and people can download the file from the server(s) you specified.
## Download a file from a manifest
See [api](./download.md)
```js
const Bongo = require("bongodl")
const { join, dirname } = require("path")
const fs = require("fs/promises")

// Create an instance of Downloader
new Bongo.Downloader({
    // The path to your manifest file.
    manifest_path: join(__dirname, "file.txt.manifest"),
    // You can also supply the manifest directly
    // manifest: manifest,
    // or you can give an url where the manifest is located.
    // manifest_url: "https://example.com/file.txt.manifest",
    // the number of concurrent requests Bongo can make.
    // It's up to you to determine how far you can go.
    concurrent: 4,
    // Enable if you listen to the status event.
    emitStatus: false
}).on("end", async filepath => {
    // The download finished, yay

    // Move the file ouf of the temporary directory where Bongo downloaded it.
    await fs.rename(filepath, join(__dirname, "file.txt"))
    // Delete the temporary directory.
    await fs.rmdir(dirname(filepath), {recursive: true})
}).on("error", err => {
    // Eventually, if the download failed, you'll get the error here.
    console.error(err)
    process.exit(1)
})
```
Bongo has already done everything. Downloaded each pieces, verified them, assembled and verified the file before giving it to you.
# Manifest
See [Manifest.md](manifest.md)