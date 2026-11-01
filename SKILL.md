---
name: lighttable-sdk
description: "Build integrations, sites, and apps that use the LightTable SDK (lighttable.js) for ecommerce data and flows: auth OTP, collections/products/services/orders/invoices/categories/stores, checkout, and profile. Use for Node.js, React, Next.js, Vite, and HTML."
---

# LightTable SDK Skill

## Goal
Help an LLM use `lighttable.js` correctly across Node.js, React, Next.js, Vite, and HTML.

## Install / CDN
- npm: `npm install @lbflow/lighttable`
- HTML (CDN): `https://unpkg.com/@lbflow/lighttable@latest/lighttable.js`



## Authentication
- OTP flow:
  - `authOtp({ type: 'phone'|'email', phone?, email? })`
  - `verifyOtp({ code, phone?, email? })` stores token internally if returned.
- `setToken(token)` to set JWT manually.

## Core API (all methods)
- `setToken(token)`
- `authOtp({ type, phone, email })`
- `verifyOtp({ code, phone, email })`
- `getMe()`
- `updateMe(payload)`
- `getSignedUrl(key)`
- `runFuction(payload)` (note: name in SDK is `runFuction`, not `runFunction`)
- `function(name, { env })` (invoke a store-scoped Node.js function running )
- `runFunction(name, { env })` (alias for `function`)
- `checkout(payload)`
- `watch(collectionId, { token?, onEvent, onError?, onConnect? })` (real-time via WebSocket, requires `socket.io-client`)
- `subscribe(channel, { onMessage, onError?, onConnect? })` (broadcast pub/sub, no auth required)
- Query builders:
  - `collection(name)`
  - `products()`
  - `services()`
  - `orders()`
  - `invoices()`
  - `categories()`
- `stores()`

## Node.js Function Sandboxes

Invoke a function created with `lighttable-cli function create`:

```js
const result = await lightTable.function('find-product', {
  env: { collection: 'products', filter: { slug: 'sample' } }
});
```

`env` must be a JSON object. The value returned by the function handler is returned directly by `function()` and `runFunction()`.

If a function returns a file, the SDK returns a `lighttable-file` descriptor (`name`, `mimeType`, `size`, `downloadUrl`, `expiresAt`). The filesystem key is not exposed. The file remains private in filesystem; its signed URL lasts 7 hours by default and can be configured per call with `downloadUrlTtlSeconds` (60 seconds through 7 days). Files stream directly from filesystem, with a 1 GB maximum; the server does not read or parse their bytes. Downloads are forced to `application/octet-stream` and `Content-Disposition: attachment`; `mimeType` is informational.

```js
const file = await lightTable.function('export-report', {
  env: { collection: 'orders' },
  downloadUrlTtlSeconds: 3600
});

if (file.type === 'lighttable-file') {
  const link = document.createElement('a');
  link.href = file.downloadUrl;
  link.download = file.name;
  link.click();
}
```

Function modules run in a fresh Node.js 22 sandbox. Export a default async function or a named `handler`; initialize this SDK with the execution environment's store-scoped token to query LightTable:

```js
import LightTable from '@lbflow/lighttable';

export default async ({ env }) => {
  const lightTable = new LightTable({
    baseUrl: process.env.LIGHTTABLE_BASE_URL,
    store: process.env.LIGHTTABLE_STORE,
    token: process.env.LIGHTTABLE_TOKEN
  });

  return lightTable.collection(env.collection).findOne(env.filter).exec();
};
```

To return a file, write it under `/workspace/output/` and return `file({ path, name, mimeType })` from the handler's second argument.  streams it directly to private filesystem using a signed upload policy capped at 1 GB; the application server handles metadata only. The signed download URL defaults to 7 hours and is configurable per SDK invocation.

```js
import { writeFile } from 'node:fs/promises';

export default async ({ env }, { file }) => {
  const outputPath = '/workspace/output/report.csv';
  await writeFile(outputPath, env.csv);
  return file({ path: outputPath, name: 'report.csv', mimeType: 'text/csv' });
};
```

Each execution receives a unique full-access token scoped to one store; it expires after 30 minutes. The sandbox is terminated after execution. Function source and npm dependencies are trusted code and must be reviewed before exposing the function to other callers.

### Function roles

There are **two configurable roles**:

| Role | Access |
|------|--------|
| `public` | Any caller, including callers without a customer login. |
| `user` | Authenticated customers, except customers with the restricted `rules` admin role. |

With no roles configured (`roles: []`, the default), only `superadmin` customers can invoke the function. `superadmin` customers can always invoke it regardless of the configured roles. `rules` admins do not inherit `user` access because that would bypass their table-specific permissions. Enabling `public` explicitly allows any caller to run the function with its store-scoped access.

Create and test the function from the CLI:

```bash
lighttable-cli function create find-product \
  --file ./functions/find-product.mjs \
  --dependencies '["date-fns"]' \
  --roles '["user"]'

lighttable-cli function test find-product \
  --env '{"collection":"products","filter":{"slug":"sample"}}'
```

## Query Builder Pattern
Supported chain methods:
- `find()`, `findOne()` return a chainable builder
- `filter(obj)`, `sort(obj)`, `limit(n)`, `skip(n)`, `select(str|obj)`, `lean()`
- Extra for products/categories/stores:
  - `thumbnailSize('200x200')`, `mainImageSize('500x500')`
- Extra for products/services/orders/invoices/categories/stores:
  - `byStoreId(storeId)`

Supported operations (collection):
- `find`, `findOne`, `count`, `countDocuments`
- `findOneAndUpdate`, `findById`, `findByIdAndUpdate`
- `deleteOne`, `deleteMany`, `updateOne`, `updateMany`
- `save`, `saveMany`, `insertMany`, `aggregate`, `distinct`, `create`

Files are automatically detected in documents before the operation:
```js
const records = lightTable.collection('collection-id');

await records.create({ title: 'Photo', image: imageFile });

await records.update(
  { _id: recordId },
  { $set: { title: 'Updated photo', image: imageFile } }
);

await records.save({ title: 'Saved photo', image: imageFile });

await lightTable.collection('collection-id').saveMany([
  { title: 'Photo 1', image: imageFile1 },
  { title: 'Photo 2', image: imageFile2 }
]);
```

File fields are detected automatically. The recommended format is `{ field: value, fileField: file }`, without a `files` wrapper. Files can be `File`, `Blob`, `Buffer`, `Uint8Array`, or `ArrayBuffer` values.

### File Visibility

- Fields of type `image` or `media` are automatically uploaded to public url. The returned URL can be displayed directly.
- To keep an image private, store it in a `document` field (or another field that is not `image`/`media`). access must use a signed URL.

```js
// Image field: public URL, suitable for display
const product = await records.create({
  title: 'Public image',
  image: imageFile
});
console.log(product.image);

// Document field: private file
const uploaded = await lightTable.upload(documentFile, {
  collection: 'collection-id',
  fieldName: 'document',
  filename: 'contrat.pdf',
  mimetype: 'application/pdf'
});

await records.create({
  title: 'Private document',
  document: uploaded.url
});

// Do not expose the storage key to unauthorized clients.
const privateUrl = await lightTable.getSignedUrl(uploaded.key);
console.log(privateUrl);
```

## Examples
Node/React/Vite/Next:
```js
import LightTable from '@lbflow/lighttable';

const lightTable = new LightTable({
  baseUrl: 'https://lb01.genielabel.com/sdk/v1/lighttable',
  store: 'YOUR_STORE_ID',

  token:"USER TOKEN"
});

// Example of a chainable query
const data = await lightTable
  .collection('myCollectionID')
  .find()
  .filter({ status: 'active' })
  .sort({ createdAt: -1 })
  .limit(10)
  .skip(20)
  .select('name age')
  .lean()


console.log(data);

const products = await lightTable
  .products()
  .findOne({ slug: 't-shirt-nike17991579' })
  .limit(2)
  .thumbnailSize('200x200')
  .mainImageSize('500x500')
  .lean(); // chainables: sort, skip, filter, select, lean, etc.
```

Example result (products):
```json
{
  "images": [
    {
      "thumbnail": "https://example.com/jpg",
      "url": "https://example.com/jpg",
      "original": "https://example.com/jpg"
    }
  ],
  "price": 10000,
  "collections": [
    {
      "_id": "6827857adae4fab1d79f3c51",
      "title": "Fashion"
    }
  ],
  "_id": "6827853bdae4fab1d79f3c26",
  "name": "T-shirt nike",
  "slug": "t-shirt-nike57814059",
  "taxable": true,
  "formaterPrice": "10.000,00 CDF"
}
```

OTP (authOtp/verifyOtp):
```js
await lightTable.authOtp({ type: 'email', email: 'user@email.com' });
// l'utilisateur recoit un code OTP
const result = await lightTable.verifyOtp({ code: '1234', email: 'user@email.com' });
console.log(result.token);
```

Me (profile):
```js
const me = await lightTable.getMe();
const updated = await lightTable.updateMe({
  firstName: 'Jean',
  lastName: 'Dupont'
});
```

Categories:
```js
const categories = await lightTable
  .categories()
  .find({})
  .byStoreId('STORE_ID')
  .thumbnailSize('200x200')
  .mainImageSize('500x500')
  .lean();
```

HTML:
```html
<script src="https://unpkg.com/@lbflow/lighttable@latest/lighttable.js"></script>
<script>
  const lightTable = new LightTable({
baseUrl: 'https://lb01.genielabel.com/sdk/v1/lighttable',
    store: 'YOUR_STORE_ID'
  });
  lightTable.getMe().then(console.log);
</script>
```

Checkout:
```js
const checkout = await lightTable.checkout({
  isInvoice: false,
  no_auth: true,
  items: [{ id: '_id:PRODUCT_ID', quantity: 1 }]
});
```

## Real-time Watch

`watch(collectionId, { token?, onEvent, onError?, onConnect? })` — écoute les changements en temps réel via WebSocket.

### Example

```js
const sub = lt.watch('6a75c3b7f01df8ed39cc58cb', {
  onEvent: (change) => {
    console.log(change.type); // "insert" | "update" | "delete"
    console.log(change.data); // document ou description
  },
  onError: (err) => console.error(err.message),
  onConnect: (res) => {
    console.log('Collection:', res.collection.name);
    console.log('Champs:', res.collection.fields);
  }
});

// Arrêter plus tard
sub.unsubscribe();
```

### Format des événements reçus

```json
// Insert
{
  "type": "insert",
  "data": {
    "_id": "6a75c3d3f01df8ed39cc58d4",
    "title": "Nouvel article",
    "price": 29.99,
    "__created": "2026-08-07T11:38:59.679Z"
  }
}

// Update
{
  "type": "update",
  "data": {
    "_id": "6a75c3d3f01df8ed39cc58d4",
    "updatedFields": { "title": "Modifié", "price": 34.99 },
    "removedFields": []
  }
}

// Delete
{
  "type": "delete",
  "data": { "_id": "6a75c3d3f01df8ed39cc58d4" }
}
```

## Broadcast Pub/Sub

`subscribe(channel, { onMessage, onError?, onConnect? })` — no auth required, no collection dependency.

```js
const sub = lt.subscribe('game/42', {
  onMessage: (msg) => {
    console.log(msg.channel, msg.data);
  },
  onConnect: (res) => console.log('Listening on', res.channel),
});

// Emit to the same channel
sub.emit('game/42', { player: 'Alice', score: 100 });

// Stop listening
sub.unsubscribe();
```

### Events format

```json
{"channel":"game/42","data":{"player":"Alice","score":100}}
```

- SDK throws `Error('HTTP <status>')` when response is not OK.
- Error object may contain `error.response.status` and `error.response.data`.
- To manage collections and roles, I use lighttable-cli.



## When to Use This Skill
- When the user asks how to integrate LightTable in web apps (React/Vite/Next).
- When generating code samples for checkout, products, orders, invoices, or OTP.
- When debugging requests or auth issues in LightTable SDK.
