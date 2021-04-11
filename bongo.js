const bongodl = require(".")
const {join} = require("path")
const { writeFileSync } = require("fs")
bongodl.createManifest({
    downloads: [
        "https://lightcord.org/api/gh/releases/Lightcord/Lightcord/0.1.5/lightcord-win32-ia32.zip",
        "https://github.com/Lightcord/Lightcord/releases/download/0.1.5/lightcord-win32-ia32.zip"
    ],
    filepath: join(__dirname, "test/lightcord-win32-ia32.zip"),
    // 15Mb
    pieceSize: 8e6
}).then(manifest => {
    console.log("Sliced file to", manifest.pieces.length, "pieces")
    writeFileSync("./test/lightcord.manifest", bongodl.formatManifest(manifest, "buffer"))
})