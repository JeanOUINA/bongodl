# Server
> Your server needs to accept the `Range` header.
Here are examples on how to integrate with your server
## Express
```js
const app = require("express")()
.get("/file.txt", (req, res) => {
    // Express supports the `Range` header automatically with sendFile.
    res.status(200).sendFile(__dirname+"/file.txt")
})

// You can also use express.static to static a whole directory.
app.use(express.static(__dirname+"/public"))

// Listen on port 80
app.listen(80)
```