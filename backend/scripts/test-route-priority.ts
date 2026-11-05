import assert from "node:assert/strict";
import { Hono } from "hono";
import { mountAllRoutes } from "../src/routes";

async function main() {
  const app = new Hono();
  await mountAllRoutes(app);
  for (const path of ["/api/notes/process", "/api/notes/query"]) {
    const literal = app.routes.findIndex(route => route.method === "POST" && route.path === path);
    const parameter = app.routes.findIndex(route => route.method === "POST" && route.path === "/api/notes/:id");
    assert.ok(literal >= 0 && parameter >= 0 && literal < parameter, `${path} must precede /api/notes/:id`);
    const literalHandler = app.routes[literal].handler;
    const parameterHandler = app.routes[parameter].handler;
    const match = app.router.match("POST", path)[0];
    assert.equal(match[0][0][0], literalHandler, `${path} should resolve to its own handler`);
    assert.notEqual(match[0][0][0], parameterHandler);
  }
  console.log("Note process and query resolve to their literal handlers.");
}

void main();
