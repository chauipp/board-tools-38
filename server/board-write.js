export async function writeBoardAtVersion(model, id, version, fields) {
  const updatedAt = new Date(Math.max(Date.now(), version.getTime() + 1));
  const result = await model.findOneAndUpdate(
    { _id: id, updatedAt: version },
    { $set: { ...fields, updatedAt } },
    { projection: { _id: 1 } }
  );
  return result ? updatedAt : null;
}
