import LightTableHybridSync from './LightTableHybridSync';

// Exemple d'utilisation
(async () => {
  // Initialisation
  const hybrid = new LightTableHybridSync({
    store: '682cf043adafe2436fd5edcb',
    token: 'YOUR_JWT_TOKEN',
    baseUrl: 'https://mfumu.labelflow.co/sdk/v1/lighttable'
  });

  // Définition du schéma de la collection
  const productSchema = {
    name: { type: 'string' },
    price: { type: 'number' },
    description: { type: 'string' },
    category: { type: 'string' },
    inStock: { type: 'boolean' }
  };

  // Création/accès à la collection
  const Product = await hybrid.collection('products', productSchema);

  // Insertion avec gestion offline
  try {
    await Product.insert({
      _id: 'product-' + Date.now(),
      name: 'Sneakers Nike Air Max',
      price: 149.99,
      description: 'Chaussures de sport confortables',
      category: 'Chaussures',
      inStock: true,
      __store: hybrid.store,
      __lightTable: true,
      __lastModified: Date.now(),
      __syncStatus: 'pending'
    });
    console.log('Produit ajouté avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'ajout du produit:', error);
  }

  // Observation des changements en temps réel
  const subscription = hybrid.observe('products', {
    selector: {
      category: 'Chaussures'
    }
  }).subscribe(products => {
    console.log('Mise à jour des produits:', products);
  });

  // Exemple de recherche
  const results = await Product.find({
    selector: {
      price: {
        $lt: 200
      },
      inStock: true
    }
  }).exec();
  console.log('Résultats de la recherche:', results);

  // Exemple de mise à jour
  try {
    await Product.findOne({
      selector: {
        name: 'Sneakers Nike Air Max'
      }
    }).update({
      $set: {
        price: 129.99,
        __lastModified: Date.now(),
        __syncStatus: 'pending'
      }
    });
    console.log('Prix mis à jour avec succès');
  } catch (error) {
    console.error('Erreur lors de la mise à jour du prix:', error);
  }

  // Nettoyage à la fermeture
  process.on('SIGINT', async () => {
    subscription.unsubscribe();
    await hybrid.cleanup();
    process.exit(0);
  });
})(); 