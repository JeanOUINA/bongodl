import { createHash } from "crypto";
import EventEmitter from "events";
import { createReadStream, createWriteStream, mkdirSync, mkdtempSync, rmdirSync } from "fs";
import { readFile, stat } from "fs/promises";
import { MANIFEST_BUFFER_FOOTER, MANIFEST_BUFFER_HEADER, MANIFEST_STRING_FOOTER, MANIFEST_STRING_HEADER, VALUE_TYPE } from "./constants";
import fetch from "node-fetch"
import PromisePool from "es6-promise-pool";
import { PassThrough } from "stream";
import { join } from "path";
import os from "os"

function numberToBuffer(number:number):Buffer{
    let hex = number.toString(16)
    if(hex.length % 2 === 1){
        hex = "0"+hex
    }
    return Buffer.from(hex, "hex")
}
function bufferToNumber(buffer:Buffer):number{
    const hex = buffer.toString("hex")
    return parseInt(hex, 16)
}

export class ParseError extends Error {
    name = "ParseError"
    constructor(message:string){
        super("Couldn't parse manifest: " + message)
    }
}
export interface Manifest {
    filesize: number,
    integrity: string,
    downloads: string[],
    pieces: {
        range: [number, number],
        integrity: string
    }[]
}

/**
 * String manifest definition
 * #BONGODL-MANIFEST-START#
 * # This is a required header. It should be
 * # the first line in the manifest.
 * 
 * # Filesize, in bytes.
 * 1024
 * # Integrity of whole download. sha-256
 * 5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef
 * # How to format download paths.
 * # You can also add fallbacks.
 * 
 * # No range. It will be specified in the `Range` header.
 * url:http://127.0.0.1/file.bin
 * # In case you need to pass the integrity. 
 * url:http://127.0.0.1/file.bin/{{integrity}}
 * # Range is encoded in the query
 * url:http://127.0.0.1/file.bin?range={{range}}
 * 
 * # This file is split between 4 parts.
 * 0-256 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
 * 256-512 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
 * 512-768 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
 * 768-1024 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
 * 
 * # Required footer
 * #BONGODL-MANIFEST-END#
 */
/**
 * Buffer manifest definition
 * 5 byte - header (0x13, 0x37, 0x69, 0x42, 0x00)
 * ... read the code i am lazy
 * 6 byte - footer (BONGO but in utf8)
 */
/**
 * Parse a manifest.
 * @param manifest_raw The manifest to be parsed. Can be a string (not json), a Buffer (should be encoded with this lib) or a manifest object.
 * @returns 
 */
export function parseManifest(manifest_raw:string|Buffer|Manifest):Manifest{
    if(typeof manifest_raw === "string"){
        // read lines and remove empty lines.
        let lines = manifest_raw.split(/[\n\r]+/g).map(e => e.trim()).filter(e=>!!e)
        // verify header and footer
        if(lines.shift() !== MANIFEST_STRING_HEADER)throw new ParseError("INVALID HEADER")
        if(lines.pop() !== MANIFEST_STRING_FOOTER)throw new ParseError("INVALID FOOTER")
        // Remove comments
        lines = lines.filter(e => !e.startsWith("#"))

        const parseNextNumber = (name:string) => {
            const valueSTR = lines.shift()
            if(!valueSTR)throw new ParseError("Ran out of lines")
            if(!/^\d+$/.test(valueSTR))throw new ParseError(name.toLowerCase()+" IS NOT A NUMBER")
            return parseInt(valueSTR)
        }
        const fileSize = parseNextNumber("filesize")
        if(fileSize === 0)throw new ParseError("File size is 0.")
        const integrity = lines.shift()?.toLowerCase()
        if(!integrity)throw new ParseError("Ran out of lines")
        if(!/^[\da-f]{64}$/.test(integrity))throw new ParseError("Invalid download integrity.")
        const downloads = []
        let nextLine:string = lines.shift()
        if(!nextLine)throw new ParseError("Ran out of lines")
        while(nextLine.startsWith("url:")){
            const url = nextLine.slice("url:".length)
            // just test it's a real url
            new URL(url)
            downloads.push(url)
            nextLine = lines.shift()
            if(!nextLine)throw new ParseError("Ran out of lines")
        }
        if(downloads.length === 0)throw new ParseError("No downloads links were specified")
        const pieces:Manifest["pieces"] = []
        let lastByte = 0
        while(nextLine && /^\d+-\d+ [\da-f]{64}$/.test(nextLine)){
            const {
                start,
                end,
                integrity
            } = nextLine.match(/^(?<start>\d+)-(?<end>\d+) (?<integrity>[\da-f]{64})$/).groups
            const startByte = parseInt(start)
            if(startByte !== lastByte)throw new ParseError("New byte isn't the next one")
            const endByte = parseInt(end)
            if(endByte <= startByte)throw new ParseError("piece size isn't positive and something else than 0.")
            lastByte = endByte
            pieces.push({
                range: [startByte, endByte],
                integrity
            })

            nextLine = lines.shift()
        }
        if(lastByte !== fileSize)throw new ParseError("total bytes and file size doesn't match.")
        const manifest:Manifest = {
            downloads,
            filesize: fileSize,
            integrity,
            pieces
        }
        return manifest
    }else if(Buffer.isBuffer(manifest_raw)){
        if(!MANIFEST_BUFFER_HEADER.equals(manifest_raw.slice(0, 5)))throw new ParseError("INVALID HEADER")
        if(!MANIFEST_BUFFER_FOOTER.equals(manifest_raw.slice(manifest_raw.length-MANIFEST_BUFFER_FOOTER.length)))throw new ParseError("INVALID FOOTER")
        manifest_raw = manifest_raw.slice(5, manifest_raw.length-MANIFEST_BUFFER_FOOTER.length)
        let offset = 0
        const lines:Buffer[] = []
        let manifestBuff = manifest_raw.slice(offset)
        while(manifestBuff[0]){
            offset += manifestBuff[0]+1
            lines.push(manifestBuff.slice(0, manifestBuff[0]+1))
            manifestBuff = manifest_raw.slice(offset)
        }
        const manifest:Manifest = {
            filesize: 0,
            downloads: [],
            integrity: null,
            pieces: []
        }
        let lastByte = 0
        for(let line of lines){
            switch(line[1]){
                case VALUE_TYPE.FILESIZE: {
                    if(manifest.filesize !== 0)throw new ParseError("DOUBLE FILESIZE PAYLOAD")
                    manifest.filesize = bufferToNumber(line.slice(2))
                    if(manifest.filesize === 0)throw new ParseError("File size is 0.")
                    break
                }
                case VALUE_TYPE.INTEGRITY: {
                    if(manifest.integrity !== null)throw new ParseError("DOUBLE INTEGRITY PAYLOAD")
                    const integrity = line.slice(2).toString("hex")
                    if(integrity.length !== 64)throw new ParseError("Invalid download integrity.")
                    manifest.integrity = integrity
                    break
                }
                case VALUE_TYPE.DOWNLOAD: {
                    const url = line.slice(2).toString("utf8")
                    // just test it's a real url
                    new URL(url)
                    manifest.downloads.push(url)
                    break
                }
                case VALUE_TYPE.PIECE: {
                    const piece:Manifest["pieces"][0] = {
                        range: [0, 0],
                        integrity: null
                    }
                    const pieceBuffer = line.slice(2)
                    const rangeBuffer = pieceBuffer.slice(1, pieceBuffer[0]+1)
                    const integrityBuffer = pieceBuffer.slice(pieceBuffer[0]+1)

                    const startRangeBuffer = rangeBuffer.slice(1, rangeBuffer[0]+1)
                    const startByte = bufferToNumber(startRangeBuffer)
                    if(startByte !== lastByte)throw new ParseError("New byte isn't the next one")
                    const endRangeBuffer = rangeBuffer.slice(rangeBuffer[0]+1)
                    const endByte = bufferToNumber(endRangeBuffer)
                    if(endByte <= startByte)throw new ParseError("piece size isn't positive and something else than 0.")
                    piece.range = [startByte, endByte]
                    piece.integrity = integrityBuffer.toString("hex")
                    if(piece.integrity.length !== 64)throw new ParseError("Invalid piece integrity.")
                    manifest.pieces.push(piece)
                    lastByte = endByte
                    break
                }
                default: {
                    throw new ParseError(`Invalid value type ${line[1]}`)
                }
            }
        }
        if(manifest.filesize === 0)throw new ParseError("File size not specified.")
        if(manifest.downloads.length === 0)throw new ParseError("Download link(s) not specified.")
        if(!manifest.integrity)throw new ParseError("Integrity not specified.")
        if(lastByte !== manifest.filesize)throw new ParseError("total bytes and file size doesn't match.")
        return manifest
    }else{
        if(!manifest_raw.integrity)throw new ParseError("Integrity not specified.")
        if(manifest_raw.filesize === 0)throw new ParseError("File size not specified.")
        if(manifest_raw.downloads.length === 0)throw new ParseError("Download link(s) not specified.")
        for(let piece of manifest_raw.pieces){
            if(!piece.integrity)throw new ParseError("piece integrity not specified.")
        }
        return manifest_raw
    }
}
export function formatManifest(manifest:Manifest, format:"string"):string
export function formatManifest(manifest:Manifest, format:"buffer"):Buffer
export function formatManifest(manifest:Manifest, format:"json"):string
export function formatManifest(manifest:Manifest, format:"string"|"buffer"|"json"):string|Buffer{
    switch(format){
        case "string": {
            return [
                MANIFEST_STRING_HEADER,
                "",
                "# Filesize",
                String(manifest.filesize),
                "# Integrity",
                manifest.integrity,
                "# Downloads",
                ...manifest.downloads.map(e => `url:${e}`),
                "# Pieces",
                ...manifest.pieces.map(e => `${e.range.join("-")} ${e.integrity}`),
                "",
                MANIFEST_STRING_FOOTER
            ].join("\n")
        }
        case "buffer": {
            const buffers = [
                MANIFEST_BUFFER_HEADER
            ]
            const filesizeBuffer = numberToBuffer(manifest.filesize)
            buffers.push(
                numberToBuffer(filesizeBuffer.length+1), 
                numberToBuffer(VALUE_TYPE.FILESIZE), 
                filesizeBuffer
            )

            const integrityBuffer = Buffer.from(manifest.integrity, "hex")
            buffers.push(
                numberToBuffer(integrityBuffer.length+1), 
                numberToBuffer(VALUE_TYPE.INTEGRITY), 
                integrityBuffer
            )

            for(let url of manifest.downloads){
                const downloadBuffer = Buffer.from(url, "utf8")
                if(downloadBuffer.length > 254)throw new Error("The download url is too big. It shouldn't go above 254 chars.")
                buffers.push(
                    numberToBuffer(downloadBuffer.length+1),
                    numberToBuffer(VALUE_TYPE.DOWNLOAD),
                    downloadBuffer
                )
            }
            for(let piece of manifest.pieces){
                const startRangeBuffer = numberToBuffer(piece.range[0])
                const endRangeBuffer = numberToBuffer(piece.range[1])
                const rangeBuffer = Buffer.concat([
                    numberToBuffer(startRangeBuffer.length),
                    startRangeBuffer,
                    endRangeBuffer
                ])
                const integrityBuffer = Buffer.from(piece.integrity, "hex")
                const pieceBuffer = Buffer.concat([
                    numberToBuffer(rangeBuffer.length),
                    rangeBuffer,
                    integrityBuffer
                ])
                buffers.push(
                    numberToBuffer(pieceBuffer.length+1),
                    numberToBuffer(VALUE_TYPE.PIECE),
                    pieceBuffer
                )
            }
            buffers.push(MANIFEST_BUFFER_FOOTER)

            return Buffer.concat(buffers)
        }
        case "json": {
            return JSON.stringify(manifest, null, "    ")
        }
        default:
            throw new Error(`format ${format} is not valid.`)
    }
}

export async function createManifest(options:{
    downloads: string[]|string,
    filepath: string,
    pieceSize?: number
}):Promise<Manifest>{
    // 25 MB
    const pieceSize = options.pieceSize || 25e6
    const stats = await stat(options.filepath)
    if(stats.size === 0)throw new Error("Filesize is 0")
    const lastPieceSize = stats.size % pieceSize
    const pieces:Manifest["pieces"] = []
    const piecesFullCount = (stats.size - lastPieceSize)/pieceSize
    let offset = 0
    for(let i = 0; i < piecesFullCount; i++){
        pieces.push({
            range: [offset, pieceSize+offset],
            integrity: null
        })
        offset = pieceSize+offset
    }
    if(lastPieceSize !== 0){
        pieces.push({
            range: [offset, lastPieceSize+offset],
            integrity: null
        })
    }
    let integrity = createHash("sha256")
    for(let piece of pieces){
        const stream = createReadStream(options.filepath, {
            start: piece.range[0],
            end: piece.range[1]
        })
        const hash = createHash("sha256")
        await new Promise<void>((resolve, reject) => {
            stream.on("data", chunk => {
                hash.update(chunk)
                integrity.update(chunk)
            }).on("end", resolve)
            .on("error", reject)
        })
        piece.integrity = hash.digest("hex")
    }
    return parseManifest({
        downloads: Array.isArray(options.downloads)?options.downloads:[options.downloads],
        filesize: stats.size,
        integrity: integrity.digest("hex"),
        pieces: pieces
    })
}

export class Downloader extends EventEmitter {
    /**
     * Create a downloader instance. You have the responsability to provide a valid manifest.
     * @param options 
     */
    constructor(options:({
        /** Provide manifest as a parsed json object/string/buffer */
        manifest: Manifest|string|Buffer
    }|{
        /** Provide manifest as an url. It will be fetched with node-fetch. */
        manifest_url: string
    }|{
        /** Provide manifest as a path. */
        manifest_path: string
    })&{
        startAuto?: boolean,
        stateDir?: string,
        concurrent?: number,
        emitStatus?: boolean
    }){
        super()
        this.concurrent = options.concurrent || 10
        if(!("startAuto" in options) || options.startAuto){
            this.on("manifest", this.startFetching)
        }
        if(options.stateDir){
            this.stateDir = options.stateDir
        }else{
            this.stateDir = mkdtempSync(join(os.tmpdir(), "bongo-"))
        }
        mkdirSync(this.stateDir, {recursive: true})
        this.emitStatus = !!options.emitStatus
        if("manifest" in options){
            try{
                const manifest = parseManifest(options.manifest)
                process.nextTick(() => this.emit("manifest", manifest))
            }catch(err){
                process.nextTick(() => this.emit("error", err))
            }
        }else if("manifest_url" in options){
            fetch(options.manifest_url)
            .then(async res => {
                if(!res.ok)throw new Error("Couldn't fetch script.")
                const body = await res.buffer()
                
                let manifest:Manifest
                if(body.slice(0, MANIFEST_BUFFER_HEADER.length).equals(MANIFEST_BUFFER_HEADER)){
                    // buffer type
                    manifest = parseManifest(body)
                }else{
                    try{
                        // try to load json directly
                        manifest = parseManifest(JSON.parse(body.toString("utf8")))
                    }catch(err){
                        // fail. Load string, or die.
                        manifest = parseManifest(body.toString("utf8"))
                    }
                }
                this.emit("manifest", manifest)
            })
            .catch(err => this.emit("error", err))
        }else if("manifest_path" in options){
            readFile(options.manifest_path)
            .then(body => {
                let manifest:Manifest
                if(body.slice(0, MANIFEST_BUFFER_HEADER.length).equals(MANIFEST_BUFFER_HEADER)){
                    // buffer type
                    manifest = parseManifest(body)
                }else{
                    try{
                        // try to load json directly
                        manifest = parseManifest(JSON.parse(body.toString("utf8")))
                    }catch(err){
                        // fail. Load string, or die.
                        manifest = parseManifest(body.toString("utf8"))
                    }
                }
                this.emit("manifest", manifest)
            })
            .catch(err => this.emit("error", err))
        }
    }
    stateDir:string
    concurrent:number
    emitStatus:boolean
    startFetching(manifest:Manifest){
        let needByte = 0
        let downloaded = 0
        const startDate = Date.now()
        const emitProgress = () => {
            if(!this.emitStatus)return
            const elapsed = Date.now()-startDate
            this.emit("status", {
                total: manifest.filesize,
                downloaded: downloaded,
                ratio: downloaded/manifest.filesize,
                percentage: Math.round(downloaded/manifest.filesize*10000)/100,
                start: startDate,
                elapsed: Date.now()-startDate,
                average_speed: downloaded/(elapsed/1000)
            })
        }
        emitProgress()
        const stream = new PassThrough()
        const hash = createHash("sha256")
        const path = join(this.stateDir, `file`)
        stream.pipe(createWriteStream(path))
        stream.pipe(hash)
        stream.on("end", () => {
            const integrity = hash.digest("hex")
            
            if(integrity !== manifest.integrity){
                // seriously
                this.abort(new Error("Integrity doesn't match."))
                return
            }
            this.emit("end", path)
        })
        const processQueue = () => {
            while(true){
                const needPieceIndex = pieces.findIndex(e => e.byte === needByte)
                if(needPieceIndex === -1)return
                const needPiece = pieces[needPieceIndex]
                stream.write(needPiece.data)
                needByte = needPiece.byteEnd
                pieces.splice(needPieceIndex, 1)
            }
        }
        const pieces = []
        const promisesLeft = manifest.pieces.map(piece => {
            const process = async (time:number = 0) => {
                if(time > 3)throw new Error(`Couldn't download file: Download of range ${piece.range[0]}-${piece.range[1]} failed 3 times`)
                const url = manifest.downloads[time%manifest.downloads.length]
                let downloadedPiece = 0
                try{
                    const res = await fetch(url, {
                        headers: {
                            Range: `bytes=${piece.range[0]}-${piece.range[1]}`
                        }
                    })
                    if(!res.ok)throw new Error(`${res.status} ${res.statusText}`)
                    const hash = createHash("sha256")
                    const stream = new PassThrough()
                    stream.pipe(hash)
                    const buffers = []
                    stream.on("data", data => {
                        buffers.push(data)
                        downloadedPiece += data.length
                        downloaded += data.length
                        emitProgress()
                    })
                    res.body.pipe(stream)
                    await new Promise<void>((resolve, reject) => {
                        stream.on("end", resolve)
                        .on("error", reject)
                    })
                    const integrity = hash.digest("hex")
                    if(integrity !== piece.integrity){
                        throw new Error(`Integrity didn't match.`)
                    }
                    const buffer = Buffer.concat(buffers)
                    pieces.push({
                        byte: piece.range[0],
                        byteEnd: piece.range[1],
                        data: buffer
                    })
                    processQueue()
                }catch(err){
                    downloaded = downloaded - downloadedPiece
                    emitProgress()
                    console.error(err)
                    return process(time+1)
                }
            }
            return process
        })
        const pool = new PromisePool(() => {
            const create = promisesLeft.shift()
            return create && create() || null
        }, this.concurrent)
        pool.start()
        .then(async () => {
            // time check whole integrity
            stream.end()
        }, err => this.abort(err))
    }
    private abort(error:Error){
        rmdirSync(this.stateDir, {recursive: true})
        this.emit("error", error)
    }
}