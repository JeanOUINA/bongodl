# Manifest
> You don't need to encode/decode the manifest yourself. Simply use our apis:<br>
> [`Bongo.createManifest`](#bongo.createmanifest)<br>
> [`Bongo.parseManifest`](#bongo.parsemanifest)<br>
> [`Bongo.formatmanifest`](#bongo.formatmanifest)
# Contents
- [Bongo.createManifest](#bongo.createmanifest)
- [Bongo.parseManifest](#bongo.parsemanifest)
- [Bongo.formatmanifest](#bongo.formatmanifest)
- [JSON Format](#json-format)
    - [filesize](#filesize)
    - [integrity](#integrity)
    - [downloads](#downloads)
    - [pieces](#pieces)
- [String Format](#string-format)
    - [String Header](#string-header)
    - [File size](#file-size)
    - [File Integrity](#file-integrity)
    - [Download links](#download-links)
    - [File pieces](#file-pieces)
    - [String Footer](#string-footer)
- [Binary format](#binary-format)
    - [Binary Header](#binary-header)
    - [Binary Footer](#binary-footer)
    - [Structure](#structure)
    - [File size](#binary-file-size)
    - [Integrity](#binary-integrity)
    - [Download links](#binary-download-links)
    - [File pieces](#binary-file-pieces)
# Bongo.createManifest
Create a manifest from a file.
```ts
function createManifest(options:{
    downloads: string[]|string,
    filepath: string,
    pieceSize?: number
}):Promise<Manifest>
```
| Property | Description | Default |
|-|-|-|
| downloads | The list of download links. If the first link is down, Bongo will use the second, and then the third. |
| filepath | A local path to your file. Bongo will read it to etablish integrity. |
| pieceSize? | The size of pieces for the file. It should be something like 10-100mb depending on the file size. | 25e6 (25mb)
> Returns Promise<[Manifest](#json-format)>
# Bongo.parseManifest
Parse a manifest.
```ts
function parseManifest(manifest_raw:string|Buffer|Manifest):Manifest
```
| Property | Description |
|-|-|
| manifest_raw | The manifest in a raw form. Please note that this function doesn't accept stringified json. |
> Returns [Manifest](#json-format)
# Bongo.formatManifest
Parse a manifest.
```ts
function formatManifest(manifest:Manifest, format:"string"):string
function formatManifest(manifest:Manifest, format:"buffer"):Buffer
function formatManifest(manifest:Manifest, format:"json"):string
function formatManifest(manifest:Manifest, format:"string"|"buffer"|"json"):string|Buffer
```
| Property | Description |
|-|-|
| manifest | The parsed manifest. |
| format | The format you want the manifest in. |


> Returns string|Buffer.
# JSON Format
The manifest is structured like this:
```ts
interface Manifest {
    filesize: number,
    integrity: string,
    downloads: string[],
    pieces: {
        range: [number, number],
        integrity: string
    }[]
}
```
Let's look at each property
## filesize
This is the size of the file, in bytes.

## integrity
This is the sha256 checksum of the file. Encoded as a hex string. See [crypto.createHash](https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm_options)

## downloads
A list of download links. They should deliver the same content. When the first server is down, the second in the array will replace him. etc until three failed request are made for the same piece.

## pieces
This is a list of pieces. The file is divided in multiple parts, and Bongo is fetching them concurrently, verifying them and assembling them into one single file. The range property is an array of two numbers. The first one is the start byte of the range. The second is the end of it. Integrity is a sha256 checksum of the range. Encoded as a hex string.

# String Format
In string format, the manifest is formatted like this:
```
#BONGODL-MANIFEST-START#

# if the line starts with #, it is interpreted as a comment.

1024
5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef
url:http://127.0.0.1/file.bin
0-256 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
256-512 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
512-768 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
768-1024 5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1

#BONGODL-MANIFEST-END#
```
Let's look at each line
## String Header
Every string manifest starts with `#BONGODL-MANIFEST-START#`. This tells Bongo that this is a string manifest, and that it must be parsed as such.
## File size
The first line that isn't a comment should be the filesize. You can't put something before. It must be a positive number.
## File integrity
This is the sha256 checksum of the file. Encoded as a hex string.
## Download links
You can specify as much download links as you want. (though only the first three will be used) Each line should start with `url:`.
## File pieces
the first part is the range, as described in the json format. The second is the piece integrity.
## String footer
Every string manifest ends with `#BONGODL-MANIFEST-END#`.

# Binary format
> This section is very technical. You may not need to read this at all. Bongo handles everything on the encoding/parsing side.

Here's an example of an encoded binary manifest, hex encoded for convenience.
```
13376942000300040021015f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef1a02687474703a2f2f3132372e302e302e312f66696c652e62696e260304010001005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af127030502010002005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af127030502020003005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af127030502030004005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1424f4e474f
```
Let's break this down
## Binary Header
Each binary manifest should start with
```js
0x13, 0x37, 0x69, 0x42, 0x00
```
This tells Bongo that this is a valid Binary manifest, and that it should be parsed as such.
## Binary Footer
Same as above, except it's 
```js
0x42, 0x4f, 0x4e, 0x47, 0x4f
```
"BONGO", but in hex.
## Structure
Stripping header and footer, we now have this:
```
0300040021015f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef1a02687474703a2f2f3132372e302e302e312f66696c652e62696e260304010001005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af127030502010002005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af127030502020003005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af127030502030004005341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1
```
Let's just look at the first byte.
```
0x03
```
0x03 means 3. This is the first byte, so it means the payload we're going to read is 3+1 bytes long. A payload is structured like this
|  | Payload length | Instruction ID | data |
|-|-|-|-|
|Example|0x03|0x00|0x04 0x00|
<br>

> A list of instructions id can be found in [constants.ts](../src/constants.ts)

And then, we just navigate through the payloads.
1. Check the length
2. Use the data
3. Go to the next payload.

## Binary File size
### Example payload
| Payload length | Instruction ID | size |
|-|-|-|
|0x03|0x00|0x0400|

data is the file size. For example, 0x0400 is 1024.<br>
You can convert numbers like this:
```js
// 1024
const size = parseInt("0400", 16)
```
```js
// 400
let hex = number.toString(16)
if(hex.length % 2 === 1){
    // 0400
    hex = "0"+hex
}
```
## Binary Integrity
This is where we really save space by using binary encoding instead of string/json
### Example payload
| Payload length | Instruction ID | integrity |
|-|-|-|
|0x21|0x01|5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef|
```js
const integrityBuffer = Buffer.from("5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef", "hex")
```
```js
const integrity = integrityBuffer.toString("hex")
```

Data is the decoded integrity. It now makes 32 bytes (decoded) instead of 64 (hex encoded).
## Binary Download links
### Example payload
| Payload length | Instruction ID | url |
|-|-|-|
|0x1a|0x02|http://127.0.0.1/file.bin|

Data is the utf8 encoded download link. Without the `url:` prefix.
## Binary File Pieces
### Example payload
| Payload length | Instruction ID | rangeBuffer length | startByteBuffer length | range start byte | range end byte | integrityBuffer
|-|-|-|-|-|-|-|
|0x26|0x03|0x04|0x01|0x00|0x0100|5341e6b2646979a70e57653007a1f310169421ec9bdd9f1a5648f75ade005af1

<br>
Go read the implementation, I don't know how to explain this further.