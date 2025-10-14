# @lighttable/lighttable

Universal SDK to access the LightTable  (compatible with Node.js, React, Next.js, Vite).

## Installation

```bash
npm install @lighttable/lighttable
```

## Usage

### Node.js / Vite / Next.js / React

```js
import LightTable from '@lighttable/lighttable';
// or in CommonJS:
// const LightTable = require('@lighttable/lighttable');

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
*/
```




## Features
- Chainable API (like Mongo or Mongoose)
- Supports all Mongoose query options: `filter`, `sort`, `limit`, `skip`, `select`,   `lean`, etc.
- Works in Node.js, React, Next.js, Vite (SSR and browser)
- Token management (JWT)
- File upload and signed URL support




## Example: Checkout
```js
import LightTable from '@lighttable/lighttable';
// or in CommonJS:
// const LightTable = require('@lighttable/lighttable');

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
      quantity: 1
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

## Dependencies
- [axios](https://www.npmjs.com/package/axios)

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
