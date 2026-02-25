import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

function createVerboseLogWriterPlugin() {
  let logStream = null;
  let logFileName = "";

  const writeLine = (entry) => {
    if (!logStream) {
      return;
    }
    const line = typeof entry === "string" ? entry : JSON.stringify(entry);
    logStream.write(`${line}\n`);
  };

  return {
    name: "finger-whack-verbose-log-writer",
    apply: "serve",
    configureServer(server) {
      const logsDir = path.join(server.config.root, "logs");
      fs.mkdirSync(logsDir, { recursive: true });

      logFileName = `${formatLogFileName(new Date())}.log`;
      const logPath = path.join(logsDir, logFileName);
      logStream = fs.createWriteStream(logPath, { flags: "a" });

      writeLine({
        ts: new Date().toISOString(),
        level: "INFO",
        scope: "server",
        message: "Verbose file logger started",
        data: { file: `logs/${logFileName}` },
      });

      console.log(`[finger-whack] verbose logs: logs/${logFileName}`);

      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || !req.url?.startsWith("/__debug-log")) {
          next();
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString("utf8");
        });

        req.on("end", () => {
          const baseContext = {
            ts: new Date().toISOString(),
            level: "INFO",
            scope: "server",
            message: "Received browser log payload",
            data: { bytes: body.length },
          };

          if (!body) {
            writeLine({
              ...baseContext,
              level: "WARN",
              message: "Received empty browser log payload",
            });
            res.statusCode = 204;
            res.end();
            return;
          }

          try {
            const payload = JSON.parse(body);
            const entries = Array.isArray(payload?.entries)
              ? payload.entries
              : [payload];

            for (const entry of entries) {
              writeLine(entry);
            }

            writeLine({
              ...baseContext,
              message: "Wrote browser log entries",
              data: {
                bytes: body.length,
                entries: entries.length,
              },
            });

            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, file: logFileName }));
          } catch (error) {
            writeLine({
              ...baseContext,
              level: "ERROR",
              message: "Failed to parse browser log payload",
              data: {
                error: error instanceof Error ? error.message : String(error),
                payloadPreview: body.slice(0, 800),
              },
            });
            res.statusCode = 400;
            res.end("invalid json");
          }
        });

        req.on("error", (error) => {
          writeLine({
            ts: new Date().toISOString(),
            level: "ERROR",
            scope: "server",
            message: "Error while receiving browser log payload",
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
          res.statusCode = 500;
          res.end("logging error");
        });
      });

      server.httpServer?.once("close", () => {
        writeLine({
          ts: new Date().toISOString(),
          level: "INFO",
          scope: "server",
          message: "Verbose file logger stopped",
          data: { file: `logs/${logFileName}` },
        });
        logStream?.end();
        logStream = null;
      });
    },
  };
}

function formatLogFileName(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}-${minute}-${second}`;
}

export default defineConfig(({ command }) => ({
  plugins:
    command === "serve"
      ? [react(), createVerboseLogWriterPlugin()]
      : [react()],
}));
