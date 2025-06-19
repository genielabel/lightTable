# LightTable

LightTable is a modern data synchronization SDK with offline support, P2P, and conflict resolution for web and React Native.

## Quick Installation

```bash
npm install @lighttable/lighttable
```

> **All required dependencies (RxDB, PouchDB, WebRTC, BLE, etc.) are installed automatically.**
> - On web, only the necessary dependencies are loaded.
> - On React Native, BLE/Wifi/NetInfo modules are installed automatically.

## Compatibility
- **Web** (React, Vite, Next.js, etc.)
- **Mobile** (React Native)
- Node.js >= 14

## Features

- ✅ Automatic synchronization (Online ↔ Offline)
- ✅ P2P mode (WebRTC on web, BLE/Wifi on mobile)
- ✅ Conflict management
- ✅ Synchronization queue
- ✅ Compatible with Web and React Native
- ✅ Real-time support
- ✅ Automatic data cleanup

## Usage

```javascript
import LightTable from '@lighttable/lighttable';

const lightTable = new LightTable({
  store: 'YOUR_STORE_ID',
  token: 'YOUR_JWT_TOKEN',
  allowOffline: true, // Enable offline support
  allowP2P: true      // Enable P2P (BLE on mobile, WebRTC on web)
});

// Normal usage - online/offline/P2P management is automatic
(async () => {
  // Create a product
  await lightTable
    .collection('products')
    .create({
      _id: 'product-1',
      name: 'Sneakers',
      price: 149.99,
     
    });

  // Find products
  const products = await lightTable
    .collection('products')
    .find()
    .filter({ price: { $lt: 200 } })
    .exec();

  console.log('Found products:', products);
})();
```

## Synchronization Modes

### Online (Net)
- Automatic synchronization with the server
- Real-time bidirectional replication
- Server-side conflict management

### Offline (Local)
- Local storage of changes
- Synchronization queue
- Automatic resume on reconnection

### P2P (LAN/BLE/WebRTC)
- **Web**: Direct synchronization between browsers via WebRTC (LAN)
- **Mobile**: Direct synchronization via Bluetooth Low Energy or Wifi P2P
- No Internet connection required

## Conflict Management

Conflict resolution follows this strategy:
1. The most recent timestamp wins
2. Both versions are kept if the conflict cannot be resolved
3. You can define a custom strategy

## Security

- Authentication via JWT
- Data encryption in transit
- Permission validation on the server side

## Cleanup

Data is automatically cleaned up:
- After 7 days of inactivity
- On logout
- On demand via `lightTable.cleanup()`

## Limitations

- Maximum document size: 16MB
- Maximum number of simultaneous BLE/WebRTC connections: depends on hardware
- BLE/WebRTC bandwidth is limited

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

Contributions are welcome! See CONTRIBUTING.md for more details.

## License

MIT
