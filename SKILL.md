---
name: LighTable Sdk
description: Build integrations, sites, and apps that use the LightTable SDK (lighttable.js) for ecommerce data and flows: auth OTP, collections/products/services/orders/invoices/categories/stores, checkout, and profile. Use for Node.js, React, Next.js, Vite, and HTML. Fetch-based SDK (no axios).
---

# LightTable SDK Skill

## Goal
Help an LLM use `lighttable.js` correctly across Node.js, React, Next.js, Vite, and HTML.

## Install / CDN
- npm: `npm install @labelflowai/lighttable`
- HTML (CDN): `https://unpkg.com/@labelflowai/lighttable@1.0.0-beta028/lighttable.js`



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
- `checkout(payload)`
- Query builders:
  - `collection(name)`
  - `products()`
  - `services()`
  - `orders()`
  - `invoices()`
  - `categories()`
  - `stores()`

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
- `save`, `insertMany`, `aggregate`, `distinct`, `create`

## Examples
Node/React/Vite/Next:
```js
import LightTable from '@labelflowai/lighttable';

const lightTable = new LightTable({
  baseUrl: 'https://lb01.genielabel.com/sdk/v1/lighttable',
  store: 'YOUR_STORE_ID',
  marketplaceKey: 'MARKETPLACE_KEY'
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
  .exec();

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
<script src="https://unpkg.com/@labelflowai/lighttable@1.0.0-beta028/lighttable.js"></script>
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

## Error Handling
- SDK throws `Error('HTTP <status>')` when response is not OK.
- Error object may contain `error.response.status` and `error.response.data`.



## When to Use This Skill
- When the user asks how to integrate LightTable in web apps (React/Vite/Next).
- When generating code samples for checkout, products, orders, invoices, or OTP.
- When debugging requests or auth issues in LightTable SDK.
