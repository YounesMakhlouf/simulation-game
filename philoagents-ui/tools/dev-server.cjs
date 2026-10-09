const express = require("express");
const path = require("node:path");
const webpack = require("webpack");
const middleware = require("webpack-dev-middleware");

const app = express();
const compiler = webpack(require("../webpack/config.js"));
const development = middleware(compiler);

app.use(development);
app.use(express.static(path.resolve(__dirname, "../public")));

const server = app.listen(8080, process.env.HOST || "127.0.0.1", () => {
    console.log("Game UI: http://localhost:8080");
});
server.on("error", (error) => {
    console.error(error);
    development.close(() => process.exit(1));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        server.close();
        development.close(() => process.exit(0));
    });
}
