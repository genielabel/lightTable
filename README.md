# LightTable Hybrid Sync

Une extension de LightTable qui ajoute la synchronisation hybride avec support offline, P2P et résolution de conflits.

## Installation rapide

```bash
npm install lighttable
```

> **Toutes les dépendances nécessaires (RxDB, PouchDB, WebRTC, BLE, etc.) sont installées automatiquement.**
> - Sur le web, seules les dépendances utiles sont chargées.
> - Sur React Native, les modules BLE/Wifi/NetInfo sont installés automatiquement.

## Compatibilité
- **Web** (React, Vite, Next.js, etc.)
- **Mobile** (React Native)
- Node.js >= 14

## Fonctionnalités

- ✅ Synchronisation automatique (Online ↔ Offline)
- ✅ Mode P2P (WebRTC sur web, BLE/Wifi sur mobile)
- ✅ Gestion des conflits
- ✅ File d'attente de synchronisation
- ✅ Compatible Web et React Native
- ✅ Support temps réel
- ✅ Nettoyage automatique des données

## Utilisation

```javascript
const LightTable = require('lighttable');

const lightTable = new LightTable({
  store: 'YOUR_STORE_ID',
  token: 'YOUR_JWT_TOKEN',
  allowOffline: true, // Active le support offline
  allowP2P: true      // Active le P2P (BLE sur mobile, WebRTC sur web)
});

// Utilisation normale - la gestion online/offline/P2P est automatique
(async () => {
  // Création d'un produit
  await lightTable
    .collection('products')
    .create({
      _id: 'product-1',
      name: 'Sneakers',
      price: 149.99,
      __store: lightTable.store,
      __lightTable: true
    });

  // Recherche de produits
  const products = await lightTable
    .collection('products')
    .find()
    .filter({ price: { $lt: 200 } })
    .exec();

  console.log('Produits trouvés:', products);
})();
```

## Modes de Synchronisation

### Online (Net)
- Synchronisation automatique avec le serveur
- Réplication bidirectionnelle en temps réel
- Gestion des conflits côté serveur

### Offline (Local)
- Stockage local des modifications
- File d'attente de synchronisation
- Reprise automatique lors de la reconnexion

### P2P (LAN/BLE/WebRTC)
- **Web** : Synchronisation directe entre navigateurs via WebRTC (LAN)
- **Mobile** : Synchronisation directe via Bluetooth Low Energy ou Wifi P2P
- Pas besoin de connexion Internet

## Gestion des Conflits

La résolution des conflits se fait selon la stratégie suivante :
1. Timestamp le plus récent gagne
2. Conservation des deux versions en cas de conflit non résolu
3. Possibilité de définir une stratégie personnalisée

## Sécurité

- Authentification via JWT
- Chiffrement des données en transit
- Validation des permissions côté serveur

## Nettoyage

Les données sont automatiquement nettoyées :
- Après 7 jours d'inactivité
- Lors de la déconnexion
- Sur demande via `lightTable.cleanup()`

## Limitations

- Taille maximale des documents : 16MB
- Nombre maximal de connexions BLE/WebRTC simultanées : selon le matériel
- Bande passante BLE/WebRTC limitée

## Required Permissions

### Android

- **Network access** (for NetInfo and P2P):
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  ```
- **Storage** (if using P2P or SQLite):
  ```xml
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
  ```
- **Bluetooth** (if using P2P via Bluetooth):
  ```xml
  <uses-permission android:name="android.permission.BLUETOOTH" />
  <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
  <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
  ```

### iOS

- **Network access**:
  ```xml
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
  ```
- **Bluetooth** (if using P2P):
  ```xml
  <key>NSBluetoothAlwaysUsageDescription</key>
  <string>Bluetooth usage for P2P sync</string>
  ```

### Expo

- Expo Managed does not natively support all features (SQLite, BLE, Wifi P2P). Use Expo Bare or EAS Build for full native support.

## Contribution

Les contributions sont les bienvenues ! Voir CONTRIBUTING.md pour plus de détails.

## Licence

MIT
