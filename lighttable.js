const axios = require('axios');
const { addRxPlugin, createRxDatabase } = require('rxdb');
import { replicateCouchDB, getFetchWithCouchDBAuthorization } from 'rxdb/plugins/replication-couchdb';

// Correction des imports natifs pour compatibilité universelle
let NetInfo = null;
let SQLiteAdapter = null;
let IndexedDBAdapter = null;
let AsyncStorage = null;

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

if (isReactNative) {
  try {
    NetInfo = require('@react-native-community/netinfo');
    SQLiteAdapter = require('pouchdb-adapter-react-native-sqlite');
    AsyncStorage = require('@react-native-async-storage/async-storage');
  } catch (e) {
    // Optionally log or throw if you want to force install
  }
} else if (typeof window !== 'undefined') {
  try {
    IndexedDBAdapter = require('pouchdb-adapter-idb');
  } catch (e) {}
}

const p2pSync = require('./p2p-sync');

class LightTable {
  constructor({ baseUrl, store, token = null, allowOffline = false, allowP2P = false }) {
    this.baseUrl = (baseUrl || 'https://mfumu.labelflow.co/sdk/v1/lighttable').replace(/\/$/, '');
    if (!store) throw new Error("`store` is required");

    this.store = store;
    this.allowOffline = allowOffline;
    this.allowP2P = allowP2P;
    this.mode = 'online';
    this.db = null;
    this.syncQueue = new Map();

    // RxDB config for offline
    if (this.allowOffline) {
      if (isReactNative) {
        if (SQLiteAdapter) addRxPlugin(SQLiteAdapter);
      } else if (IndexedDBAdapter) {
        addRxPlugin(IndexedDBAdapter);
      }
    }

    // Token storage
    if (!token && isReactNative && AsyncStorage) {
      token = AsyncStorage.getItem('lighttable_token');
    } else if (!token && typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('lighttable_token');
    }
    this.token = token;

    // Network and P2P
    this._initNetworkMonitoring();
    if (this.allowP2P) {
      this._initP2P();
    }
  }

  async _initP2P() {
    try {
      await p2pSync.startAdvertising();
      
      // Configuration du handler de réception de données P2P
      p2pSync.onDataReceived = async (data) => {
        if (data.type === 'sync' && data.collection && data.changes) {
          await this._handleP2PSync(data.collection, data.changes, data.token);
        }
      };
    } catch (error) {
      console.error('[LightTable] Erreur initialisation P2P:', error);
    }
  }

  async _handleP2PSync(collectionName, changes, token) {
    if (!this.db) return;
    // Vérification du token JWT
    if (!this._isValidToken(token)) {
      console.warn('[LightTable] Token JWT P2P invalide, données ignorées');
      return;
    }
    const collection = await this._getOfflineCollection(collectionName);
    if (!collection) return;
    try {
      for (const change of changes) {
        await collection.atomicUpsert({
          ...change,
          __lastModified: Date.now(),
          __syncStatus: 'synced',
          __syncSource: 'p2p'
        });
      }
    } catch (error) {
      console.error('[LightTable] Erreur sync P2P:', error);
    }
  }

  _isValidToken(token) {
    // Vérification basique du JWT (décodage + store)
    if (!token || typeof token !== 'string') return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload && payload.store === this.store;
    } catch (e) {
      return false;
    }
  }

  async _initNetworkMonitoring() {
    if (NetInfo) {
      NetInfo.addEventListener(state => {
        if (state.isConnected) {
          this._switchMode('online');
        } else if (this.allowOffline) {
          this._switchMode('offline');
        }
      });
    }
  }

  async _initOfflineDB() {
    if (!this.db && this.allowOffline) {
      this.db = await createRxDatabase({
        name: 'lighttable_' + this.store,
        adapter: isReactNative ? 'react-native-sqlite' : 'idb',
        multiInstance: false,
        eventReduce: true
      });
    }
  }

  async _switchMode(newMode) {
    if (this.mode === newMode) return;
    console.log(`[LightTable] Mode: ${this.mode} -> ${newMode}`);
    this.mode = newMode;

    if (newMode === 'online' && this.syncQueue.size > 0) {
      await this._processSyncQueue();
    }
  }

  setToken(token) {
    this.token = token;
    if (isReactNative && AsyncStorage) {
      AsyncStorage.setItem('lighttable_token', token);
    } else if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('lighttable_token', token);
    }
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'x-store-id': this.store,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
    };
  }

  async authOtp({ type, phone, email }) {
    if (!type || (type === 'phone' && !phone) || (type === 'email' && !email)) {
      throw new Error("`type` et `phone` ou `email` sont requis");
    }

    const res = await axios.post(`${this.baseUrl}/auth-otp`, { type, phone, email }, {
      headers: this._headers()
    });

    return res.data;
  }

  async getSignedUrl(key) {
    const res = await axios.post(`${this.baseUrl}/signed-url`, { key }, {
      headers: this._headers()
    });

    return res.data.url;
  }

  async verifyOtp({ code, phone, email }) {
    if (!code || (!phone && !email)) {
      throw new Error("`code` et `phone` ou `email` sont requis");
    }

    const res = await axios.post(`${this.baseUrl}/auth-otp/verify`, { code, phone, email }, {
      headers: this._headers()
    });

    if (res.data?.token) {
      this.setToken(res.data.token);
    }

    return res.data;
  }

  async getMe() {
    const res = await axios.get(`${this.baseUrl}/me`, {
      headers: this._headers()
    });
    return res.data;
  }

  async updateMe(payload) {
    const res = await axios.put(`${this.baseUrl}/me`, payload, {
      headers: this._headers()
    });
    return res.data;
  }

  collection(name) {
    if (!name) throw new Error("Nom de collection requis");

    class QueryBuilder {
      constructor(parent, operation, initialArgs = []) {
        this.parent = parent;
        this.operation = operation;
        this.args = initialArgs.length ? initialArgs : [{}];
        this.isOffline = parent.mode !== 'online';
      }

      sort(sortObj) { this.args[0].sort = sortObj; return this; }
      limit(limitVal) { this.args[0].limit = limitVal; return this; }
      skip(skipVal) { this.args[0].skip = skipVal; return this; }
      filter(filterObj) { this.args[0].filter = filterObj; return this; }
      select(selectVal) { this.args[0].select = selectVal; return this; }
      populate(populateVal) { this.args[0].populate = populateVal; return this; }
      lean() { this.args[0].lean = true; return this; }

      async exec() {
        if (this.isOffline && this.parent.allowOffline) {
          return await this._execOffline();
        }
        return await this._execOnline();
      }

      async _execOffline() {
        await this.parent._initOfflineDB();
        const collection = await this.parent._getOfflineCollection(name);
        const query = collection.find(this.args[0].filter || {});

        if (this.args[0].sort) query.sort(this.args[0].sort);
        if (this.args[0].limit) query.limit(this.args[0].limit);
        if (this.args[0].skip) query.skip(this.args[0].skip);

        const results = await query.exec();
        return results.map(doc => doc.toJSON());
      }

      async _execOnline() {
        let finalArgs = this.args;
        if (["find", "findOne"].includes(this.operation) && this.args.length === 1) {
          let { filter = {}, limit, skip, page, sort, ...rest } = this.args[0];
          if (page !== undefined && limit !== undefined) {
            skip = (page - 1) * limit;
          }
          let query = filter;
          let options = { ...rest };
          if (limit !== undefined) options.limit = limit;
          if (skip !== undefined) options.skip = skip;
          if (sort !== undefined) options.sort = sort;
          finalArgs = [query, options];
        }

        const res = await axios.post(`${this.parent.baseUrl}`, {
          operation: this.operation,
          args: finalArgs,
          collection: name
        }, {
          headers: this.parent._headers()
        });

        return res.data.data;
      }

      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const operations = [
      'find', 'findOne', 'count', 'countDocuments',
      'findOneAndUpdate', 'findById', 'findByIdAndUpdate',
      'deleteOne', 'deleteMany', 'updateOne', 'updateMany',
      'save', 'insertMany', 'aggregate', 'distinct', 'create'
    ];

    const model = {};
    for (const op of operations) {
      if (["find", "findOne"].includes(op)) {
        model[op] = (args = {}) => new QueryBuilder(this, op, [args]);
      } else {
        model[op] = async (...args) => {
          if (this.mode !== 'online' && this.allowOffline) {
            // Stockage offline et mise en file d'attente
            await this._addToSyncQueue(name, op, args);
            return this._execOfflineOperation(name, op, args);
          }
          return this._execOnlineOperation(name, op, args);
        };
      }
    }

    return model;
  }

  async _getOfflineCollection(name) {
    if (!this.db) await this._initOfflineDB();
    
    if (!this.db[name]) {
      await this.db.addCollections({
        [name]: {
          schema: {
            version: 0,
            type: 'object',
            properties: {
              _id: { type: 'string', primary: true },
              _rev: { type: 'string' },
              __store: { type: 'string' },
              __lightTable: { type: 'boolean' },
              __lastModified: { type: 'number' },
              __syncStatus: { type: 'string' }
            },
            required: ['_id']
          }
        }
      });
    }

    return this.db[name];
  }

  async _addToSyncQueue(collection, operation, args) {
    if (!this.syncQueue.has(collection)) {
      this.syncQueue.set(collection, []);
    }
    this.syncQueue.get(collection).push({
      operation,
      args,
      timestamp: Date.now()
    });
  }

  async _processSyncQueue() {
    for (const [collection, operations] of this.syncQueue.entries()) {
      while (operations.length > 0) {
        const op = operations.shift();
        try {
          await this._execOnlineOperation(collection, op.operation, op.args);
        } catch (error) {
          console.error(`[LightTable] Erreur de synchronisation:`, error);
          operations.unshift(op); // Remise en file d'attente
          break;
        }
      }
    }
  }

  async _execOfflineOperation(collection, operation, args) {
    const offlineCollection = await this._getOfflineCollection(collection);
    const [doc] = args;
    const now = Date.now();

    const result = await (() => {
      switch (operation) {
        case 'create':
        case 'save':
          return offlineCollection.insert({
            ...doc,
            __lastModified: now,
            __syncStatus: 'pending'
          });
        case 'updateOne':
        case 'findOneAndUpdate':
          return offlineCollection.atomicUpdate(args[0]._id, oldDoc => ({
            ...oldDoc,
            ...args[1].$set,
            __lastModified: now,
            __syncStatus: 'pending'
          }));
        case 'deleteOne':
          return offlineCollection.remove(args[0]);
        default:
          throw new Error(`Opération ${operation} non supportée en mode offline`);
      }
    })();

    // Si P2P activé, propager les changements
    if (this.allowP2P && result) {
      await p2pSync.sendData({
        type: 'sync',
        collection,
        changes: [result],
        token: this.token
      });
    }

    return result;
  }

  async _execOnlineOperation(collection, operation, args) {
    // Ajout automatique de __lastModified pour les opérations d'écriture
    const now = Date.now();
    if (["create", "save"].includes(operation) && args[0] && typeof args[0] === 'object') {
      args[0].__lastModified = now;
    }
    if (["updateOne", "findOneAndUpdate"].includes(operation) && args[1] && args[1].$set) {
      args[1].$set.__lastModified = now;
    }
    const res = await axios.post(`${this.baseUrl}`, {
      operation,
      args,
      collection
    }, {
      headers: this._headers()
    });
    return res.data.data;
  }

  async cleanup() {
    if (this.db) {
      await this.db.cleanup();
      await this.db.remove();
    }
    if (this.allowP2P) {
      await p2pSync.cleanup();
    }
  }
}

export default LightTable;
// Pour compatibilité CommonJS
module.exports = LightTable;
