const { writeFileSync } = require("fs")
const { join } = require("path")
const bongodl = require("..")

const fileSize = 1024
const integrity = "5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef"
const downloadLink = "http://127.0.0.1/file.bin"
const pieces = [
    {
        range: [0, 256],
        integrity: "5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1"
    },
    {
        range: [256, 512],
        integrity: "5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1"
    },
    {
        range: [512, 768],
        integrity: "5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1"
    },
    {
        range: [768, 1024],
        integrity: "5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1"
    },
]

// (just get it as a manifest instance.)
const manifest = bongodl.parseManifest({
    filesize: fileSize,
    downloads: [downloadLink],
    integrity: integrity,
    pieces: pieces
})
describe("Manifest", () => {
    describe("parseManifest/formatManifest/createManifest", () => {
        it("should format a manifest (as a string) and parse it (as a string)", () => {
            const formatted = bongodl.formatManifest(manifest, "string")
            const parsed = bongodl.parseManifest(formatted)
            if(parsed.downloads.length !== 1 || parsed.downloads[0] !== downloadLink)throw new bongodl.ParseError(`Couldn't parse downloads`)
            if(parsed.filesize !== fileSize)throw new bongodl.ParseError(`Couldn't parse file size`)
            if(parsed.integrity !== integrity)throw new bongodl.ParseError(`Couldn't parse integrity`)
            if(parsed.pieces.length !== pieces.length)throw new bongodl.ParseError(`Couldn't parse pieces`)
            for(let i = 0; i < pieces.length; i++){
                const piece = pieces[i];
                const parsedPiece = parsed.pieces[i]
                if(parsedPiece.integrity !== piece.integrity || piece.range[0] !== parsedPiece.range[0] || piece.range[1] !== parsedPiece.range[1])throw new bongodl.ParseError(`Couldn't parse pieces`)
            }
        })
        
        it("should format a manifest (as a buffer) and parse it (as a buffer)", () => {
            const formatted = bongodl.formatManifest(manifest, "buffer")
            const parsed = bongodl.parseManifest(formatted)
            if(parsed.downloads.length !== 1 || parsed.downloads[0] !== downloadLink)throw new bongodl.ParseError(`Couldn't parse downloads`)
            if(parsed.filesize !== fileSize)throw new bongodl.ParseError(`Couldn't parse file size`)
            if(parsed.integrity !== integrity)throw new bongodl.ParseError(`Couldn't parse integrity`)
            if(parsed.pieces.length !== pieces.length)throw new bongodl.ParseError(`Couldn't parse pieces`)
            for(let i = 0; i < pieces.length; i++){
                const piece = pieces[i];
                const parsedPiece = parsed.pieces[i]
                if(parsedPiece.integrity !== piece.integrity || piece.range[0] !== parsedPiece.range[0] || piece.range[1] !== parsedPiece.range[1])throw new bongodl.ParseError(`Couldn't parse pieces`)
            }
        })
    })
})