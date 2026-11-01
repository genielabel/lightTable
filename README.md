# @lbflow/lighttable

Universal SDK to access the LightTable  (compatible with Node.js, React, Next.js, Vite).

## Installation

```bash
npm install @lbflow/lighttable
```

## Usage

### Node.js / Vite / Next.js / React

```js
import LightTable from '@lbflow/lighttable';
// or in CommonJS:
// const LightTable = require('@lbflow/lighttable');

// Node.js < 18 : fournissez un fetch polyfill
// import fetch from 'node-fetch';
// const lightTable = new LightTable({ ..., fetch });

const lightTable = new LightTable({
  baseUrl: 'https://lb01.genielabel.com/



sdk/v1/lighttable',
  store: 'YOUR_STORE_ID',
});

// Example of a chainable query
const data = await lightTable
  .collection('myCollection')
  .find()
  .filter({ status: 'active' })
  .sort({ createdAt: -1 })
  .limit(10)
  .skip(20)
  .select('name age')
  .lean()
  .exec();

console.log(data);





const products = await lightTable
  .products()
  .findOne({ slug: 't-shirt-nike17991579' })
  .limit(2)
  .thumbnailSize('200x200')
  .mainImageSize('500x500')
  .lean();   // chainables: sort, skip, filter, select, lean, etc.

/* returns
{
  "images": [
    {
      "thumbnail": "https://images.labelflow.cloud/c_thumb,w_400,h_400/ytaxnmhsbtolzrhhu3t1.jpg",
      "url": "https://images.labelflow.cloud/c_fill,w_1000,h_1000/ytaxnmhsbtolzrhhu3t1.jpg",
      "orginal": "https://images.labelflow.cloud/v1769473983/ytaxnmhsbtolzrhhu3t1.jpg"
    }
  ],
  "price": 34.99,
  "collections": [],
  "_id": "6978065d940c34525c2106e0",
  "name": "Shirt one",
  "description": "Montrer fièrement que tu y es passé avec cette t-shirt à l'effigie de la capitale Kinshasa. Design moderne et chic qui attire tout le monde.",
  "slug": "shortny",
  "weight": 0.5,
  "store": "6967a16aac0f7817f0870619",
  "deliverable": true,
  "taxable": true,
  "unity": "pièce",
  "weight_unit": "kg",
  "variants": [
    {
      "options": [
        "black"
      ],
      "images": [],
      "price": 34.99,
      "_id": "69c62580bbe292e4375bcfbc",
      "title": "black"
    },
    {
      "options": [
        "white"
      ],
      "images":[
        {
          "thumbnail": "https://images.labelflow.cloud/c_thumb,w_400,h_400/ytaxnmhsbtolzrhhu3t1.jpg",
          "url": "https://images.labelflow.cloud/c_fill,w_1000,h_1000/ytaxnmhsbtolzrhhu3t1.jpg",
          "orginal": "https://images.labelflow.cloud/v1769473983/ytaxnmhsbtolzrhhu3t1.jpg"
        }
      ],
      "price": 34.99,
      "_id": "69c62580bbe292e4375bcfc2",
      "title": "white"
    }
  ],
  "formaterPrice": "34,99 CDF"
}
*/
```




## Features
- Chainable API (like Mongo or Mongoose)
- Supports all Mongoose query options: `filter`, `sort`, `limit`, `skip`, `select`,   `lean`, etc.
- Works in Node.js, React, Next.js, Vite (SSR and browser)
- Token management (JWT)
- File upload and signed URL support
- Store-scoped Node.js function invocation through sandbox

### Node.js Functions

Call a function created with `lighttable-cli function create`. The function receives the JSON object in `env` and its returned value is returned by the SDK call.

```js
const result = await lightTable.function('calculate-total', {
  env: { items: [{ price: 12, quantity: 2 }] }
});
```

Function results can also be private file descriptors. The returned object has `type: 'lighttable-file'`, `name`, `mimeType`, `size`, `downloadUrl`, and `expiresAt`; the storage key is not exposed. Download URLs last 7 hours by default. Set `downloadUrlTtlSeconds` per call from 60 seconds through 7 days. Sandbox streams files up to 1 GB directly to private filesystem; the application server does not read or parse file bytes. Downloads are forced to `application/octet-stream` and `Content-Disposition: attachment`; `mimeType` is informational.

```js
const report = await lightTable.function('export-report', {
  env: { collection: 'orders' },
  downloadUrlTtlSeconds: 3600
});

if (report.type === 'lighttable-file') {
  const link = document.createElement('a');
  link.href = report.downloadUrl;
  link.download = report.name;
  link.click();
}
```

Function execution uses a unique store-scoped LightTable token that expires after 30 minutes. Functions are denied to SDK customers unless their `public` or `user` role is explicitly enabled. The `user` role does not include restricted `rules` admins; `public` allows every caller when deliberately configured. Function source and npm dependencies should be treated as trusted code.

Inside a function, the injected token can initialize this SDK to query the same store:

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

To return a file from a function, write it below `/workspace/output/` and return the `file()` helper supplied as the handler's second argument. Sandbox streams it directly to private filesystem; the application server handles metadata only. Files are limited to 1 GB and the signed URL lasts 7 hours by default.

```js
import { writeFile } from 'node:fs/promises';

export default async ({ env }, { file }) => {
  const outputPath = '/workspace/output/report.csv';
  await writeFile(outputPath, env.csv);
  return file({ path: outputPath, name: 'report.csv', mimeType: 'text/csv' });
};
```

Les écritures peuvent uploader directement les fichiers associés à un champ. Le fichier peut être un `File`, `Blob`, `Buffer`, `Uint8Array` ou `ArrayBuffer`.

```js
const products = lightTable.collection('products');
await products.create(
  { name: 'Produit avec image', image: file }
);
await products.updateOne(
  { _id: productId },
  { $set: { name: 'Produit modifié', image: file } }
);
await products.save({ ...document, image: file });
await products.saveMany([
  { ...document1, image: file1 },
  { ...document2, image: file2 }
]);
```




## Example: Checkout
```js
import LightTable from '@lbflow/lighttable';
// or in CommonJS:
// const LightTable = require('@lbflow/lighttable');

const lightTable = new LightTable({
  baseUrl: 'https://mfumu.labelflow.co/sdk/v1/lighttable',
  store: 'YOUR_STORE_ID',
});

// Example: Create a checkout link for a product or service
const checkoutResult = await lightTable.checkout({
  isInvoice: false,   // false: does not automatically create an invoice after payment
  no_auth: true,      // true: customer can pay without authentication
  items: [
    {
      product_reference: "_id:YOUR_PRODUCT_ID", // ID of the product or service
      quantity: 1,
      variant_id:"variant id "
    }
  ]
});

console.log(checkoutResult);

/* Example output:
{
  "checkout": {
    "taxable": 0,
    "close": false,
    "checkoutType": "order",
    "lineItemQuantity": 1,
    "subTotal": 3000,
    "taxPercentage": 0,

    "discountValue": null,
    "shippingPrice": 0,
    "tax": 0,
    "deliverable": false,
    "comments": [],
    "_id": "68ec95c225fcba531f7d0752",
    "reference": "5337390961",
    "currency": "CDF",
    "items": [
      {
        "modifiers": [],
        "choises": [],
        "_id": "68ec95c225fcba531f7d0753",
        "currency": "CDF",
        "name": "Consultancy 1",
        "price": 3000,
        "quantity": 1
      }
    ],
    "orderId": null,
    "checkoutId": "a37945c4-7094-46c5-9244-068f943fa7c3",
    "paid": false,
    "store": "67894cd67908d7b5057e75d4",
    "total": 3000,
    "created": "2025-10-13T06:01:38.226Z",
    "__v": 0
  },
  "link": "https://example.com/checkout/a37945c4-7094-46c5-9244-068f943fa7c3"
}
*/

console.log("Link for customer to proceed with payment:", checkoutResult.link);
// The `link` field contains the URL you can send to the customer to complete payment.

```




## Compatibility
- Node.js >= 14
- React >= 17
- Next.js >= 12
- Vite >= 2
- Fetch API requise (native en Node.js >= 18 / navigateurs modernes)

## Dependencies
- Aucune (utilise `fetch`)

## Usage en HTML pur
```html
<script src="lighttable.js"></script>
<script>
  const lightTable = new LightTable({
    baseUrl: 'https://lb01.genielabel.com/sdk/v1/lighttable',
    store: 'YOUR_STORE_ID',
  });

  lightTable.getMe().then(console.log);
</script>
```

## Example: Authentication with OTP
```js
await lightTable.authOtp({ type: 'email', email: 'user@email.com' });
// ...user receives OTP...
const result = await lightTable.verifyOtp({ code: '1234', email: 'user@email.com' });
console.log(result.token); // JWT token
```

## License
MIT

## Repository
[https://github.com/genielabel/lightTable](https://github.com/genielabel/lightTable)
