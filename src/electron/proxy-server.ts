import { randomBytes } from "crypto";
import type { AddressInfo } from "net";
import type { Server } from "http";
import express from "express";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";

/**
 * Local HTTP proxy that a spawned letta-code subprocess talks to as if it
 * were Letta Cloud. Requests under /v1/* are forwarded to the configured
 * upstream Letta server with the real Authorization header attached.
 *
 * The spawned CLI authenticates to this proxy with a per-session token; the
 * proxy strips it and re-signs the request for the upstream.
 */

export interface ProxyHandle {
  server: Server;
  port: number;
  sessionToken: string;
  setUpstream: (baseUrl: string, apiKey: string) => void;
  stop: () => Promise<void>;
}

export async function startProxyServer(
  initialUpstream: string,
  initialApiKey: string,
): Promise<ProxyHandle> {
  let upstream = normalizeUpstream(initialUpstream);
  let apiKey = initialApiKey;
  const sessionToken = randomBytes(32).toString("hex");

  const app = express();

  // Logging middleware to debug CLI requests
  app.use((req, res, next) => {
    console.log(`[proxy] ${req.method} ${req.url} - auth: ${req.headers.authorization ? "present" : "missing"}`);
    next();
  });

  app.use((req, res, next) => {
    const auth = req.headers.authorization ?? "";
    const expected = `Bearer ${sessionToken}`;
    if (auth === expected || auth === `Basic ${Buffer.from(`letta:${sessionToken}`).toString("base64")}`) {
      next();
      return;
    }
    console.log(`[proxy] Auth failed. Got: "${auth.substring(0, 20)}...", expected: "${expected.substring(0, 20)}..."`);
    res.status(401).json({ error: "invalid session token" });
  });

  // Stubs so the CLI's cloud-only probes don't 404 against a self-hosted server.
  app.get(["/v1/metadata/user", "/v1/metadata/user/"], (_req, res) => {
    res.json({ id: "local-user", email: "local@localhost", name: "Local User" });
  });
  app.get(["/v1/metadata/balance", "/v1/metadata/balance/"], (_req, res) => {
    res.json({ credits: 999999, used: 0 });
  });
  app.get(["/v1/metadata/status", "/v1/metadata/status/"], (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get(["/v1/organizations", "/v1/organizations/"], (_req, res) => {
    res.json([{ id: "local-org", name: "Local Organization" }]);
  });
  app.get(["/v1/projects", "/v1/projects/"], (_req, res) => {
    res.json([]);
  });

  const proxyOptions: Options = {
    target: upstream,
    changeOrigin: true,
    router: () => upstream,
    on: {
      proxyReq: (proxyReq) => {
        if (apiKey) {
          proxyReq.setHeader("Authorization", `Bearer ${apiKey}`);
        } else {
          proxyReq.removeHeader("Authorization");
        }
      },
    },
  };

  app.use("/v1", createProxyMiddleware(proxyOptions));
  app.use("/api", createProxyMiddleware(proxyOptions));

  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  });

  const addr = server.address() as AddressInfo | null;
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("proxy-server: failed to acquire port");
  }

  return {
    server,
    port: addr.port,
    sessionToken,
    setUpstream: (baseUrl, newApiKey) => {
      upstream = normalizeUpstream(baseUrl);
      apiKey = newApiKey;
    },
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function normalizeUpstream(url: string): string {
  return url.replace(/\/+$/, "");
}
