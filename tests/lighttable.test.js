const assert = require('node:assert/strict');
const LightTable = require('../lighttable');

function response(data) {
  return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => data, text: async () => JSON.stringify(data) };
}

async function run() {
  const requests = [];
  const sdk = new LightTable({
    baseUrl: 'https://example.test/sdk/v1/lighttable',
    store: 'store-id',
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/upload')) return response({ url: 'https://cdn.test/image.png' });
      return response({ data: { ok: true } });
    }
  });

  await sdk.collection('collection-id').create({
    title: 'hello',
    image: new Uint8Array([1, 2, 3])
  });
  await sdk.collection('collection-id').saveMany([{ title: 'one' }, { title: 'two' }]);
  await sdk.collection('collection-id').save({
    label: 'automatic form',
    document: new Uint8Array([8, 9])
  });
  await sdk.collection('collection-id').update({ _id: 'document-id' }, {
    $set: { title: 'updated', image: new Uint8Array([4, 5]) }
  });
  await sdk.collection('collection-id').save({ title: 'saved', image: new Uint8Array([6, 7]) });

  assert.equal(requests[0].url, 'https://example.test/sdk/v1/lighttable/upload');
  assert.match(requests[0].options.headers['Content-Type'], /^multipart\/form-data; boundary=/);
  assert.equal(requests[1].url, 'https://example.test/sdk/v1/lighttable');
  const createPayload = JSON.parse(requests[1].options.body);
  assert.equal(createPayload.operation, 'create');
  assert.equal(createPayload.args[0].image, 'https://cdn.test/image.png');
  assert.equal(JSON.parse(requests[2].options.body).operation, 'saveMany');
  assert.equal(JSON.parse(requests[4].options.body).operation, 'save');
  assert.equal(JSON.parse(requests[4].options.body).args[0].document, 'https://cdn.test/image.png');
  assert.equal(JSON.parse(requests[6].options.body).operation, 'updateOne');
  assert.equal(JSON.parse(requests[6].options.body).args[1].$set.image, 'https://cdn.test/image.png');
  assert.equal(JSON.parse(requests[8].options.body).operation, 'save');

  const functionRequests = [];
  const functionSdk = new LightTable({
    baseUrl: 'https://example.test/sdk/v1/lighttable',
    store: 'store-id',
    token: 'customer-token',
    fetch: async (url, options) => {
      functionRequests.push({ url, options });
      return response({ answer: 42 });
    }
  });
  assert.deepEqual(await functionSdk.function('calculate', { env: { price: 21, quantity: 2 } }), { answer: 42 });
  assert.equal(functionRequests[0].url, 'https://example.test/sdk/v1/lighttable/function');
  assert.deepEqual(JSON.parse(functionRequests[0].options.body), { name: 'calculate', env: { price: 21, quantity: 2 } });
  assert.equal(functionRequests[0].options.headers['x-store-id'], 'store-id');
  assert.equal(functionRequests[0].options.headers.Authorization, 'Bearer customer-token');
  const ttlRequests = [];
  const ttlSdk = new LightTable({
    baseUrl: 'https://example.test/sdk/v1/lighttable',
    store: 'store-id',
    fetch: async (url, options) => {
      ttlRequests.push({ url, options });
      return response({ type: 'lighttable-file' });
    }
  });
  assert.deepEqual(await ttlSdk.function('export', { env: {}, downloadUrlTtlSeconds: 3600 }), { type: 'lighttable-file' });
  assert.deepEqual(JSON.parse(ttlRequests[0].options.body), { name: 'export', env: {}, downloadUrlTtlSeconds: 3600 });
  await assert.rejects(() => ttlSdk.function('export', { downloadUrlTtlSeconds: 59 }), /downloadUrlTtlSeconds/);
  assert.deepEqual(await functionSdk.runFunction('calculate', { env: {} }), { answer: 42 });
  assert.equal(functionRequests.length, 2);
  const fileDescriptor = {
    type: 'lighttable-file',
    name: 'report.csv',
    mimeType: 'text/csv',
    size: 14,
    downloadUrl: 'https://storage.example.test/signed-file',
    expiresAt: '2030-01-01T00:15:00.000Z'
  };
  const fileSdk = new LightTable({
    baseUrl: 'https://example.test/sdk/v1/lighttable',
    store: 'store-id',
    fetch: async () => response(fileDescriptor)
  });
  assert.deepEqual(await fileSdk.function('export', { env: {} }), fileDescriptor);
  await assert.rejects(() => functionSdk.function('../other'), /nom de fonction valide/);
  await assert.rejects(() => functionSdk.function('calculate', { env: [] }), /objet JSON/);

  const systemRequests = [];
  const systemSdk = new LightTable({
    baseUrl: 'https://example.test/sdk/v1/lighttable',
    store: 'store-id',
    system: {
      get: async () => ({ data: {} }),
      post: async (url, payload, options) => {
        systemRequests.push({ url, payload, options });
        return { data: { from: 'system-client' } };
      }
    }
  });
  assert.deepEqual(await systemSdk.function('system-task', { env: { enabled: true } }), { from: 'system-client' });
  assert.equal(systemRequests[0].url, 'https://example.test/sdk/v1/lighttable/function');
  assert.deepEqual(systemRequests[0].payload, { name: 'system-task', env: { enabled: true } });
  assert.equal(systemRequests[0].options.headers['x-store-id'], 'store-id');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
