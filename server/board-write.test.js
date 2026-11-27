import test from "node:test";
import assert from "node:assert/strict";
import { writeBoardAtVersion } from "./board-write.js";

test("only one write can consume a board version, even within one millisecond", async () => {
  const version = new Date();
  let stored = { _id: "board", updatedAt: version };
  const model = {
    async findOneAndUpdate(filter, update) {
      assert.equal(filter._id, stored._id);
      if (+filter.updatedAt !== +stored.updatedAt) return null;
      stored = { ...stored, ...update.$set };
      return stored;
    }
  };
  const [first, second] = await Promise.all([
    writeBoardAtVersion(model, "board", version, { nodes: [1] }),
    writeBoardAtVersion(model, "board", version, { nodes: [2] })
  ]);
  assert.ok(first > version);
  assert.equal(second, null);
  assert.deepEqual(stored.nodes, [1]);
});
