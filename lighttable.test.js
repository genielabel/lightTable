 const LightTable = require('./lighttable');




async function run() {
  const sdk = new LightTable({ store: '696xxxx' });

  const products = await sdk
    .products()
    .findOne({_id:"697xxx"})

 //.byStoreId("699f12f77a4bbc9075daa181")
    .thumbnailSize('200x200')
    .mainImageSize('500x500')
    .lean();

    console.log(JSON.stringify(products,null,2));

}

run();
