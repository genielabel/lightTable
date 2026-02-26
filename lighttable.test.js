 const LightTable = require('./lighttable');




async function run() {
  const sdk = new LightTable({ store: '699d8a1b10eb2df1c4329224' });

  const products = await sdk
    .products()
    .find({})

    .thumbnailSize('200x200')
    .mainImageSize('500x500')
    .lean();

    console.log(products);
    console.log(products.length);
}

run();
