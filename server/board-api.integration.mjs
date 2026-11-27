import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import mongoose from "mongoose";

const port = Number(process.env.BOARD_TEST_MONGO_PORT);
assert.ok(Number.isInteger(port) && port > 0 && port < 65536, "Set BOARD_TEST_MONGO_PORT to an isolated local mongod port");

test("board HTTP contract on isolated MongoDB", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-api-"));
  const originalDirectory = process.cwd();
  const owner = "board-owner@example.test";
  const editor = "board-editor@gmail.com";
  const viewer = "board-viewer@gmail.com";
  const outsider = "board-outsider@example.test";
  const pushes = [];
  let server;

  try {
    process.chdir(directory);
    for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "DISCORD_WEBHOOK_URL", "FULL_BOARD_ACCESS_ACCOUNTS", "PASSWORD_ACCOUNTS", "ALLOWED_EMAILS"]) {
      delete process.env[key];
    }
    const { default: boards } = await import("./boards.js");
    await mongoose.connect(`mongodb://127.0.0.1:${port}/board_api_test_${randomUUID().replaceAll("-", "")}`, { serverSelectionTimeoutMS: 5000 });

    const app = express();
    app.set("io", {
      in(room) {
        const emit = (excluded, event, payload) => pushes.push({ room, excluded, event, payload });
        return { emit: (...args) => emit(null, ...args), except: (id) => ({ emit: (...args) => emit(id, ...args) }) };
      }
    });
    app.use(express.json());
    app.use("/api/boards", (req, _res, next) => {
      req.user = { email: req.get("x-test-user") };
      next();
    }, boards);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = `http://127.0.0.1:${server.address().port}`;

    const request = (route, email, method = "GET", body) => {
      const headers = { "x-test-user": email };
      if (body === undefined || body instanceof FormData) return fetch(origin + route, { method, headers, body });
      return fetch(origin + route, { method, headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) });
    };
    async function json(status, ...args) {
      const response = await request(...args);
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      return body;
    }

    const root = "/api/boards";
    const created = await json(201, root, owner, "POST", { kind: "game-design", template: "combat", name: "Combat" });
    const route = `${root}/${created.id}`;
    const initial = await json(200, route, owner);
    assert.equal(initial.kind, "game-design");
    assert.equal(initial.nodes.length, 3);
    assert.ok(initial.nextStatusId > Math.max(...initial.statuses.map(({ id }) => id)));
    await json(404, route, outsider);
    await json(201, route + "/members", owner, "POST", { email: editor, role: "editor" });
    await json(201, route + "/members", owner, "POST", { email: viewer, role: "viewer" });
    assert.equal((await json(200, root, editor))[0].role, "editor");
    assert.equal((await json(200, route + "/members", owner)).length, 2);
    await json(404, route + "/members", editor);
    await json(403, route, viewer, "PUT", initial);
    assert.equal((await json(428, route, editor, "PUT", initial)).error, "board_version_required");
    const snapshot = (await json(201, route + "/snapshots", editor, "POST", { label: "Original" })).snapshot;
    assert.equal((await json(200, route + "/snapshots", viewer)).snapshots[0].id, snapshot.id);

    const edits = [
      { email: owner, clientId: "owner-socket", title: "Owner edit" },
      { email: editor, clientId: "editor-socket", title: "Editor edit" }
    ];
    const writes = await Promise.all(edits.map(async ({ email, clientId, title }) => {
      const nodes = initial.nodes.map((node, i) => i === 0 ? { ...node, title } : node);
      const response = await request(route, email, "PUT", { ...initial, nodes, clientId, baseUpdatedAt: initial.updatedAt });
      return { status: response.status, body: await response.json(), clientId, title };
    }));
    assert.deepEqual(writes.map((write) => write.status).sort(), [200, 409]);
    const accepted = writes.find((write) => write.status === 200);
    const rejected = writes.find((write) => write.status === 409);
    assert.ok(Date.parse(accepted.body.updatedAt) > Date.parse(initial.updatedAt));
    assert.equal(rejected.body.board.updatedAt, accepted.body.updatedAt);
    assert.equal(rejected.body.board.nodes[0].title, accepted.title);
    assert.equal((await json(200, route, viewer)).nodes[0].title, accepted.title);
    assert.equal(pushes.length, 1);
    assert.equal(pushes[0].event, "board:update");
    assert.equal(pushes[0].room, "board:" + created.id);
    assert.equal(pushes[0].excluded, accepted.clientId);
    assert.equal(pushes[0].payload.view, undefined);

    const restore = route + "/snapshots/" + snapshot.id + "/restore";
    await json(409, restore, editor, "POST", { baseUpdatedAt: initial.updatedAt });
    const restored = await json(200, restore, editor, "POST", { baseUpdatedAt: accepted.body.updatedAt });
    assert.equal(restored.board.nodes[0].title, initial.nodes[0].title);
    assert.equal(pushes.length, 2);
    assert.equal(pushes[1].excluded, null);
    assert.equal((await json(200, route, viewer)).updatedAt, restored.board.updatedAt);

    const pdf = new FormData();
    pdf.set("file", new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }), "contract.pdf");
    const uploaded = await json(201, route + "/files", editor, "POST", pdf);
    const file = await request(uploaded.url, viewer);
    assert.equal(file.status, 200);
    assert.equal(await file.text(), "%PDF-1.4\n%%EOF");
    await json(404, uploaded.url, outsider);
    await json(404, route + "/files/not-a-pdf", viewer);
    await json(200, route + "/members/" + encodeURIComponent(viewer), owner, "PATCH", { role: "editor" });
    assert.equal((await json(200, route, viewer)).role, "editor");
    await json(200, route + "/members/" + encodeURIComponent(viewer), owner, "DELETE");
    await json(404, route, viewer);
    await json(404, route, editor, "DELETE");
    await json(200, route, owner, "DELETE");
    await json(404, route, owner);
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    process.chdir(originalDirectory);
    await rm(directory, { recursive: true, force: true });
  }
});
