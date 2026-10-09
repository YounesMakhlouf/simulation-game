import { spawn } from "node:child_process";
import { once } from "node:events";
import { expect, test } from "vitest";

test("development server serves the game, compiled bundle, and public assets", async () => {
    const server = spawn(process.execPath, ["tools/dev-server.cjs"], {
        env: { ...process.env, HOST: "127.0.0.1" },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    server.stdout.on("data", (chunk) => { output += chunk; });
    server.stderr.on("data", (chunk) => { output += chunk; });
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(output)), 20000);
            server.once("error", (error) => { clearTimeout(timer); reject(error); });
            server.once("exit", () => { clearTimeout(timer); reject(new Error(output)); });
            server.stdout.on("data", () => {
                if (output.includes("Game UI:")) { clearTimeout(timer); resolve(); }
            });
        });
        const page = await fetch("http://127.0.0.1:8080");
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("bundle.min.js");
        const bundle = await fetch("http://127.0.0.1:8080/bundle.min.js");
        expect(bundle.status).toBe(200);
        expect(await bundle.text()).toContain("Phaser");
        expect((await fetch("http://127.0.0.1:8080/style.css")).status).toBe(200);
        expect((await fetch("http://127.0.0.1:8080/favicon.png")).status).toBe(200);
        expect((await fetch("http://127.0.0.1:8080/missing-file")).status).toBe(404);
    } finally {
        if (server.exitCode === null) {
            const stopped = once(server, "exit");
            server.kill("SIGTERM");
            await stopped;
        }
    }
}, 30000);
