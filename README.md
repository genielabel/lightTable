# @lighttable/lighttable

Universal SDK to access the LightTable  (compatible with Node.js, React, Next.js, Vite).

## Installation

```bash
npm install @lighttable/lighttable axios
```

## Usage

### Node.js / Vite / Next.js / React

```js
import LightTable from '@lighttable/lighttable';
// or in CommonJS:
// const LightTable = require('@lighttable/lighttable');

const lightTable = new LightTable({
  baseUrl: 'https://mfumu.labelflow.co/sdk/v1/lighttable',
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
```

## Features
- Chainable API (like Mongo or Mongoose)
- Supports all Mongoose query options: `filter`, `sort`, `limit`, `skip`, `select`,   `lean`, etc.
- Works in Node.js, React, Next.js, Vite (SSR and browser)
- Token management (JWT)
- File upload and signed URL support

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
