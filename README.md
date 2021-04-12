# Description
This module basically downloads files "faster" (see [benchmarks](benchmarks.md)), verify them (sha256 integrity) and automatically retries downloading parts that failed with multiple download urls support.
# Advantages
- [Fast as fuck](benchmarks.md#results)
- Easy to use
- Reliable
- Automatically checks integrity
- Avoids this kind of thing<br> ![thing](https://cdn.discordapp.com/attachments/760911028980023318/831105758707974164/0tqAiCNcJqcpmm6HSEAyriHPf.png)<br>![second thing](https://cdn.discordapp.com/attachments/760911028980023318/831107372012929044/unknown.png)
# Disadvantages
- You need a [manifest](docs/manifest.md) first.
- [The server must support the `Range` header.](docs/server.md)
# Installation
```sh
# Install using npm
npm install bongodl
# Install using yarn
yarn add bongodl
```
# Usage
See [Documentation](docs/index.md).
# Support
    [x] Concurrent pieces download
    [x] Slicing API
    [x] Up to 3 fallback urls
    [x] Manifests
        [x] JSON
        [x] TXT
        [x] Binary
    [x] Download status
    [x] Saving to file system
    [ ] Promise API
    [ ] Streaming API
    [ ] Play/Pause/Cancel API
    [ ] Proxy Support
    [ ] Calculating current download speed
    [ ] Resume Download (after restart of program)
    
## Why "Bongodl"
I just bought a monkey plush, and Phorcys named it Bongo. I also wanted to make this library. So here it is, Bongodl<br><br>
![Bongo is taking over everything](https://cdn.discordapp.com/attachments/829306086800228363/830405155153379358/bongo.gif)
