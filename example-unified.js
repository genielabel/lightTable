const LightTable = require('./lighttable');

// Initialisation avec support offline
const lightTable = new LightTable({
  store: '682cf043adafe2436fd5edcb',
  token: 'YOUR_JWT_TOKEN',
  baseUrl: 'https://mfumu.labelflow.co/sdk/v1/lighttable',
  allowOffline: true, // Active le support offline
  allowP2P: true // Active le P2P sur mobile (ignoré sur web)
});

// Utilisation normale - la gestion online/offline est automatique
(async () => {
  try {
    // Création d'un produit
    await lightTable
      .collection('products')
      .create({
        _id: 'product-' + Date.now(),
        name: 'Sneakers Nike Air Max',
        price: 149.99,
        __store: lightTable.store,
        __lightTable: true
      });

    // Recherche de produits - fonctionne en online et offline
    const products = await lightTable
      .collection('products')
      .find()
      .filter({ price: { $lt: 200 } })
      .sort({ name: 1 })
      .limit(10)
      .exec();

    console.log('Produits trouvés:', products);

    // Mise à jour - mise en file d'attente automatique si offline
    await lightTable
      .collection('products')
      .updateOne(
        { _id: products[0]._id },
        { $set: { price: 129.99 } }
      );

  } catch (error) {
    console.error('Erreur:', error);
  }
})();

// Nettoyage à la fermeture
process.on('SIGINT', async () => {
  await lightTable.cleanup();
  process.exit(0);
}); 