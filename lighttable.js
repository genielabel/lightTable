const _globalScope = typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof self !== 'undefined'
    ? self
    : (typeof window !== 'undefined'
      ? window
      : (typeof global !== 'undefined' ? global : {})));

let _io;
try {
  _io = require('socket.io-client');
} catch {
  _io = typeof _globalScope.io !== 'undefined' ? _globalScope.io : null;
}

const _resolveFetch = (fetchImpl) => {
  if (typeof fetchImpl === 'function') return fetchImpl;
  if (typeof _globalScope.fetch === 'function') return _globalScope.fetch.bind(_globalScope);
  return null;
};

const _isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const _isFileValue = (value) => {
  if (value === null || value === undefined) return false;
  if (value.file !== undefined) return _isFileValue(value.file);
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return true;
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return true;
  return typeof value.arrayBuffer === 'function';
};

const _toUint8Array = async (file) => {
  if (file && file.file !== undefined) return _toUint8Array(file.file);
  if (file instanceof Uint8Array) return file;
  if (file instanceof ArrayBuffer) return new Uint8Array(file);
  if (file && typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file)) return new Uint8Array(file);
  throw new TypeError('Le fichier doit etre un File, Blob, Buffer, Uint8Array ou ArrayBuffer.');
};

const _fileMetadata = (file, descriptor = {}) => ({
  name: descriptor.filename || file?.name || 'file',
  type: descriptor.mimetype || file?.type || 'application/octet-stream'
});

const _encodeText = (value) => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value);
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value));
  throw new Error('TextEncoder est requis pour les uploads dans cet environnement.');
};

const _multipart = async (fields, fileField, file, descriptor = {}) => {
  const boundary = `----LightTable${Math.random().toString(16).slice(2)}`;
  const chunks = [];
  const append = (value) => chunks.push(_encodeText(value));
  for (const [key, value] of Object.entries(fields)) {
    append(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
  }
  const metadata = _fileMetadata(file, descriptor);
  append(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${metadata.name}"\r\nContent-Type: ${metadata.type}\r\n\r\n`);
  chunks.push(await _toUint8Array(file));
  append(`\r\n--${boundary}--\r\n`);
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
};

const _buildUrl = (url, params) => {
  if (!params || Object.keys(params).length === 0) return url;
  const u = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) u.searchParams.append(key, String(v));
    } else {
      u.searchParams.set(key, String(value));
    }
  }
  return u.toString();
};

const createHttpClient = (fetchImpl) => {
  const fetchFn = _resolveFetch(fetchImpl);
  if (!fetchFn) {
    throw new Error('Fetch API non disponible. Utilisez Node.js >= 18 ou fournissez `fetch` dans le constructeur.');
  }

  const request = async (method, url, data, config = {}) => {
    const finalUrl = _buildUrl(url, config.params);
    const headers = { ...(config.headers || {}) };
    const options = { method, headers };

    if (data !== undefined) {
      const contentType = headers['Content-Type'] || headers['content-type'];
      if (!contentType) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(data);
      } else {
        options.body = typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data);
      }
    }

    const res = await fetchFn(finalUrl, options);
    const contentType = res.headers && res.headers.get ? res.headers.get('content-type') : '';
    let responseData;
    if (contentType && contentType.includes('application/json')) {
      responseData = await res.json();
    } else {
      const text = await res.text();
      try {
        responseData = text ? JSON.parse(text) : null;
      } catch (err) {
        responseData = text;
      }
    }

    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.response = { status: res.status, data: responseData, headers: res.headers };
      throw error;
    }

    return { data: responseData, status: res.status, headers: res.headers };
  };

  return {
    request,
    get: (url, config) => request('GET', url, undefined, config),
    post: (url, data, config) => request('POST', url, data, config),
    put: (url, data, config) => request('PUT', url, data, config),
  };
};

class LightTable {
  constructor({ baseUrl, marketplaceKey, store, token = null, system = null, fetch: fetchImpl } = {}) {
    this.baseUrl = (baseUrl || 'https://lb01.genielabel.com/sdk/v1/lighttable').replace(/\/$/, '');
    if (!store) throw new Error("`store` est requis");

    this.store = store;
    this.marketplace = marketplaceKey;
    if (system) {
      if (typeof system.post === 'function' && typeof system.get === 'function') {
        this.system = system;
      } else if (system && typeof system.fetch === 'function' && (!system.post || !system.get)) {
        this.system = createHttpClient(system.fetch.bind(system));
      } else if (typeof system === 'function') {
        this.system = createHttpClient(system);
      } else {
        throw new Error("`system` doit etre une fonction fetch ou un client avec get/post/put");
      }
    } else {
      this.system = null;
    }

    this._http = this.system ? null : createHttpClient(fetchImpl);

    // Vérifie si un token existe déjà dans localStorage
    if (!token && typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('lighttable_token_' + store);
    }

    this.token = token;
  }


  setToken(token) {
  this.token = token;
}


  _headers() {
    return {
      'Content-Type': 'application/json',
          'x-store-id': this.store,
            'x-marketplace-key': this.marketplace,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
    };
  }

  async authOtp({ type, phone, email }) {
    if (!type || (type === 'phone' && !phone) || (type === 'email' && !email)) {
      throw new Error("`type` et `phone` ou `email` sont requis");
    }


    if (this.system) {

      const res = await this.system.post(`${this.baseUrl}/auth-otp`, { type, phone, email }, {
        headers: this._headers()
      });

          return res.data;

    }

    const res = await this._http.post(`${this.baseUrl}/auth-otp`, { type, phone, email }, {
      headers: this._headers()
    });

    return res.data;
  }



  async getSignedUrl(key) {



    if (this.system) {

      const res = await this.system.post(`${this.baseUrl}/signed-url`, { key}, {
        headers: this._headers()
      });
          return res.data;

    }

    const res = await this._http.post(`${this.baseUrl}/signed-url`, { key}, {
      headers: this._headers()
    });

    return res.data.url;
  }

  async upload(file, { collection, fieldName, filename, mimetype, uploadUrl } = {}) {
    if (!collection || !fieldName) throw new Error('`collection` et `fieldName` sont requis pour un upload');
    const form = await _multipart({ collection, fieldName }, 'files', file, { filename, mimetype });
    const url = uploadUrl || this.baseUrl.replace(/(\/sdk(?:\/v1)?\/lighttable)\/?$/, '$1/upload');
    const headers = { ...this._headers(), 'Content-Type': form.contentType };
    const res = this.system
      ? await this.system.post(url, form.body, { headers })
      : await this._http.post(url, form.body, { headers });
    return res.data;
  }


  async verifyOtp({ code, phone, email }) {
    if (!code || (!phone && !email)) {
      throw new Error("`code` et `phone` ou `email` sont requis");
    }



    if (this.system) {
      const res = await this.system.post(`${this.baseUrl}/auth-otp/verify`, { code, phone, email }, {

        // le store est requis ici aussi
        params: {},
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });

      if (res.data?.token) {
        this.token = res.data.token;

        // Environnement navigateur : stocker dans localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('lighttable_token', this.token);
        }
      }

      return res.data;

    }



    const res = await this._http.post(`${this.baseUrl}/auth-otp/verify`, { code, phone, email }, {

      // le store est requis ici aussi
      params: {},
      headers: {
        ...this._headers(),
        'x-store-id': this.store
      }
    });

    if (res.data?.token) {
      this.token = res.data.token;

      // Environnement navigateur : stocker dans localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('lighttable_token', this.token);
      }
    }

    return res.data;
  }

  async getMe() {


        if (this.system) {
          const res = await this.system.get(`${this.baseUrl}/me`, {
            headers: {
              ...this._headers(),
              'x-store-id': this.store
            }
          });
          return res.data;

        }
    const res = await this._http.get(`${this.baseUrl}/me`, {
      headers: {
        ...this._headers(),
        'x-store-id': this.store
      }
    });
    return res.data;
  }

  async updateMe(payload) {



    if (this.system) {


      const res = await this.system.put(`${this.baseUrl}/me`, payload, {
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });
      return res.data;

    }

    const res = await this._http.put(`${this.baseUrl}/me`, payload, {
      headers: {
        ...this._headers(),
        'x-store-id': this.store
      }
    });
    return res.data;
  }



  async runFuction(payload) {



        if (this.system) {

          const res = await this.system.post(`${this.baseUrl}/function`, payload, {
            headers: {
              ...this._headers(),
              'x-store-id': this.store
            }
          });
          return res.data;

        }


    const res = await this._http.post(`${this.baseUrl}/function`, payload, {
      headers: {
        ...this._headers(),
        'x-store-id': this.store
      }
    });
    return res.data;
  }

  async function(name, { env = {}, downloadUrlTtlSeconds } = {}) {
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) {
      throw new TypeError('`name` doit etre un nom de fonction valide');
    }
    if (env === null || typeof env !== 'object' || Array.isArray(env)) {
      throw new TypeError('`env` doit etre un objet JSON');
    }
    if (downloadUrlTtlSeconds !== undefined && (!Number.isSafeInteger(downloadUrlTtlSeconds) || downloadUrlTtlSeconds < 60 || downloadUrlTtlSeconds > 604800)) {
      throw new TypeError('`downloadUrlTtlSeconds` doit etre compris entre 60 et 604800 secondes');
    }

    const client = this.system || this._http;
    const payload = { name, env };
    if (downloadUrlTtlSeconds !== undefined) payload.downloadUrlTtlSeconds = downloadUrlTtlSeconds;
    const response = await client.post(`${this.baseUrl}/function`, payload, {
      headers: { ...this._headers(), 'x-store-id': this.store }
    });
    return response.data;
  }

  async runFunction(name, options = {}) {
    return this.function(name, options);
  }


    async checkout(payload) {


      if (this.system) {




        const res = await this.system.post(`${this.baseUrl}/checkout`, payload, {
          headers: {
            ...this._headers(),
            'x-store-id': this.store
          }
        });
        return res.data;

      }


      const res = await this._http.post(`${this.baseUrl}/checkout`, payload, {
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });
      return res.data;
    }



  collection(name) {
    if (!name) throw new Error("Nom de collection ID  requis");

    /**
     * QueryBuilder chaînable pour toutes les options Mongoose :
     * .filter(obj)      // filtre (query)
     * .sort(obj)        // tri
     * .limit(n)         // limite
     * .skip(n)          // décalage
     * .select(str|obj)  // projection
     * .populate(str|obj)// jointure
     * .lean()           // lean
     * .exec()           // exécute la requête
     *
     * Exemple :
     * collection('maCollection')
     *   .find()
     *   .filter({ statut: 'actif' })
     *   .sort({ createdAt: -1 })
     *   .limit(10)
     *   .skip(20)
     *   .select('nom age')
     *   .populate('profile')
     *   .lean()
     *   .exec()
     */
    class QueryBuilder {
      constructor(operation, initialArgs = []) {
        this.operation = operation;
        this.args = initialArgs.length ? initialArgs : [{}];
      }
      sort(sortObj) { this.args[0].sort = sortObj; return this; }
      limit(limitVal) { this.args[0].limit = limitVal; return this; }
      skip(skipVal) { this.args[0].skip = skipVal; return this; }
      filter(filterObj) { this.args[0].filter = filterObj; return this; }
      select(selectVal) { this.args[0].select = selectVal; return this; }
      populate(populateVal) { this.args[0].populate = populateVal; return this; }
      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
      let params;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }



        params = rest;

        let query = filter;
        let options = {};
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }




      if (this.system) {






        const res = await this.system.post(`${this.baseUrl}`, {
          operation,
          args: finalArgs,
          params,
          collection: name
        }, {
          headers: {
            ...this._headers(),
            'x-store-id': this.store
          }
        });
        return res.data.data;

      }

      const res = await this._http.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
        params,
        collection: name
      }, {
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });
      return res.data.data;
    };

    const callWithUploads = async (operation, args, uploadOptions) => {
      const preparedArgs = args.map(arg => Array.isArray(arg) ? [...arg] : (_isPlainObject(arg) ? { ...arg } : arg));
      const explicitFiles = uploadOptions?.files || {};
      const automaticTargets = [];
      if (operation === 'saveMany' && Array.isArray(preparedArgs[0])) {
        automaticTargets.push(...preparedArgs[0]);
      } else if (operation === 'create' || operation === 'save') {
        automaticTargets.push(...(Array.isArray(preparedArgs[0]) ? preparedArgs[0] : [preparedArgs[0]]));
      } else if (preparedArgs[1] && _isPlainObject(preparedArgs[1])) {
        const updateTarget = _isPlainObject(preparedArgs[1].$set) ? preparedArgs[1].$set : preparedArgs[1];
        automaticTargets.push(updateTarget);
      }

      const automaticFiles = {};
      const automaticArrayFields = new Set();
      for (const target of automaticTargets) {
        if (!_isPlainObject(target)) continue;
        for (const [fieldName, value] of Object.entries(target)) {
          if (_isFileValue(value)) {
            if (!automaticFiles[fieldName]) automaticFiles[fieldName] = [];
            automaticFiles[fieldName].push(value);
          } else if (Array.isArray(value) && value.length && value.every(_isFileValue)) {
            automaticArrayFields.add(fieldName);
            if (!automaticFiles[fieldName]) automaticFiles[fieldName] = [];
            automaticFiles[fieldName].push(...value);
          }
        }
      }

      const files = { ...automaticFiles, ...explicitFiles };
      if (Object.keys(files).length === 0) return call(operation, args);

      for (const [fieldName, value] of Object.entries(files)) {
        const fileList = Array.isArray(value) ? value : [value];
        const urls = [];
        for (const descriptor of fileList) {
          const file = descriptor?.file !== undefined ? descriptor.file : descriptor;
          const result = await this.upload(file, {
            collection: name,
            fieldName,
            filename: descriptor?.filename,
            mimetype: descriptor?.mimetype,
            uploadUrl: uploadOptions?.uploadUrl
          });
          urls.push(result?.url || result);
        }
        const targetIndex = operation === 'create' || operation === 'save' || operation === 'saveMany' ? 0 : 1;
        if (operation === 'saveMany' && Array.isArray(preparedArgs[0])) {
          preparedArgs[0].forEach((document, index) => {
            if (_isPlainObject(document)) document[fieldName] = urls[index] || urls[0];
          });
        } else if (operation === 'create' && Array.isArray(preparedArgs[0])) {
          preparedArgs[0].forEach((document, index) => {
            if (_isPlainObject(document)) document[fieldName] = urls[index] || urls[0];
          });
        } else {
          if (!_isPlainObject(preparedArgs[targetIndex])) preparedArgs[targetIndex] = {};
          const target = _isPlainObject(preparedArgs[targetIndex].$set)
            ? preparedArgs[targetIndex].$set
            : preparedArgs[targetIndex];
          const keepArray = Array.isArray(explicitFiles[fieldName]) || automaticArrayFields.has(fieldName);
          target[fieldName] = keepArray ? urls : urls[0];
        }
      }
      return call(operation, preparedArgs);
    };

    const operations = [
      'find', 'findOne', 'count', 'countDocuments',
      'findOneAndUpdate', 'findById', 'findByIdAndUpdate',
      'deleteOne', 'deleteMany', 'updateOne', 'updateMany',
      'save', 'saveMany', 'insertMany', 'aggregate', 'distinct', 'create',

    ];

    const model = {};
    for (const op of operations) {
      if (["find", "findOne"].includes(op)) {
        model[op] = (args = {}) => new QueryBuilder(op, [args]);
      } else {
        model[op] = (...args) => {
          const uploadOptions = args[args.length - 1]?.files ? args.pop() : null;
          return callWithUploads(op, args, uploadOptions);
        };
      }
    }

    model.update = (...args) => model.updateOne(...args);

    return model;
  }






  products(name) {


    class QueryBuilder {
      constructor(operation, initialArgs = []) {
        this.operation = operation;
        this.args = initialArgs.length ? initialArgs : [{}];

      }
      sort(sortObj) { this.args[0].sort = sortObj; return this; }
      limit(limitVal) { this.args[0].limit = limitVal; return this; }
      skip(skipVal) { this.args[0].skip = skipVal; return this; }
      filter(filterObj) { this.args[0].filter = filterObj; return this; }
      select(selectVal) { this.args[0].select = selectVal; return this; }
      mainImageSize(val) {  this.args[0].mainImageSize = val; return this; }
      thumbnailSize(val) {  this.args[0].thumbnailSize = val; return this; }
      byStoreId(val) {  this.args[0].byStoreId = val; return this; }

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;


          let params;

      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort,byStoreId, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }

         params = rest;

        let query = filter;
        let options = {   };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;

        finalArgs = [query, options];
      }

      delete params.thumbnailSize
      delete params.mainImageSize




      if (this.system) {





        const res = await this.system.post(`${this.baseUrl}`, {
          operation,
          args: finalArgs,
            params,
          products: true,
            byStoreId:args[0].byStoreId,

        }, {
          headers: {
            ...this._headers(),
            'x-store-id': this.store
          }
        });
        return res.data.data;

      }


      const res = await this._http.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
          params,
        products: true,
          byStoreId: args[0].byStoreId,

      }, {
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });
      return res.data.data;
    };

    const operations = [
      'find', 'findOne', 'count', 'countDocuments',


    ];

    const model = {};
    for (const op of operations) {
      if (["find", "findOne" ].includes(op)) {
        model[op] = (args = {}) => new QueryBuilder(op, [args]);
      } else {
        model[op] = (...args) => call(op, args);
      }
    }

    return model;
  }


  services(name) {


    /**
     * QueryBuilder chaînable pour toutes les options Mongoose :
     * .filter(obj)      // filtre (query)
     * .sort(obj)        // tri
     * .limit(n)         // limite
     * .skip(n)          // décalage
     * .select(str|obj)  // projection
     * .populate(str|obj)// jointure
     * .lean()           // lean
     * .exec()           // exécute la requête
     *
     * Exemple :
     * collection('maCollection')
     *   .find()
     *   .filter({ statut: 'actif' })
     *   .sort({ createdAt: -1 })
     *   .limit(10)
     *   .skip(20)
     *   .select('nom age')
     *   .populate('profile')
     *   .lean()
     *   .exec()
     */
    class QueryBuilder {
      constructor(operation, initialArgs = []) {
        this.operation = operation;
        this.args = initialArgs.length ? initialArgs : [{}];
      }
      sort(sortObj) { this.args[0].sort = sortObj; return this; }
      limit(limitVal) { this.args[0].limit = limitVal; return this; }
      skip(skipVal) { this.args[0].skip = skipVal; return this; }
      filter(filterObj) { this.args[0].filter = filterObj; return this; }
      select(selectVal) { this.args[0].select = selectVal; return this; }
      byStoreId(val) {  this.args[0].byStoreId = val; return this; }

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
            let params;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }


         params = rest;

        let query = filter;
        let options = {  };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }






      if (this.system) {





        const res = await this.system.post(`${this.baseUrl}`, {
          operation,
          args: finalArgs,
            params,
          services: true,
          byStoreId: args[0].byStoreId,
        }, {
          headers: {
            ...this._headers(),
            'x-store-id': this.store
          }
        });
        return res.data.data;

      }

      const res = await this._http.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
          params,
        services: true,
        byStoreId: args[0].byStoreId,
      }, {
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });
      return res.data.data;
    };

    const operations = [
      'find', 'findOne', 'count',
    ];

    const model = {};
    for (const op of operations) {
      if (["find", "findOne" ].includes(op)) {
        model[op] = (args = {}) => new QueryBuilder(op, [args]);
      } else {
        model[op] = (...args) => call(op, args);
      }
    }

    return model;
  }







  orders(name) {


    /**
     * QueryBuilder chaînable pour toutes les options Mongoose :
     * .filter(obj)      // filtre (query)
     * .sort(obj)        // tri
     * .limit(n)         // limite
     * .skip(n)          // décalage
     * .select(str|obj)  // projection
     * .populate(str|obj)// jointure
     * .lean()           // lean
     * .exec()           // exécute la requête
     *
     * Exemple :
     * collection('maCollection')
     *   .find()
     *   .filter({ statut: 'actif' })
     *   .sort({ createdAt: -1 })
     *   .limit(10)
     *   .skip(20)
     *   .select('nom age')
     *   .populate('profile')
     *   .lean()
     *   .exec()
     */
    class QueryBuilder {
      constructor(operation, initialArgs = []) {
        this.operation = operation;
        this.args = initialArgs.length ? initialArgs : [{}];
      }
      sort(sortObj) { this.args[0].sort = sortObj; return this; }
      limit(limitVal) { this.args[0].limit = limitVal; return this; }
      skip(skipVal) { this.args[0].skip = skipVal; return this; }
      filter(filterObj) { this.args[0].filter = filterObj; return this; }
      select(selectVal) { this.args[0].select = selectVal; return this; }
          byStoreId(val) {  this.args[0].byStoreId = val; return this; }

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
            let params;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }
               params = rest;

        let query = filter;
        let options = {   };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }




      if (this.system) {





        const res = await this.system.post(`${this.baseUrl}`, {
          operation,
          args: finalArgs,
            params,
          orders: true,
          byStoreId: args[0].byStoreId,
        }, {
          headers: {
            ...this._headers(),
            'x-store-id': this.store
          }
        });
        return res.data.data;

      }
      const res = await this._http.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
          params,
        orders: true,
        byStoreId: args[0].byStoreId,
      }, {
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });
      return res.data.data;
    };

    const operations = [
      'find', 'findOne', 'count', 'countDocuments'
    ];

    const model = {};
    for (const op of operations) {
      if (["find", "findOne"].includes(op)) {
        model[op] = (args = {}) => new QueryBuilder(op, [args]);
      } else {
        model[op] = (...args) => call(op, args);
      }
    }

    return model;
  }




invoices(name) {
    //if (!name) throw new Error("Nom de collection requis");

    /**
     * QueryBuilder chaînable pour toutes les options Mongoose :
     * .filter(obj)      // filtre (query)
     * .sort(obj)        // tri
     * .limit(n)         // limite
     * .skip(n)          // décalage
     * .select(str|obj)  // projection
     * .populate(str|obj)// jointure
     * .lean()           // lean
     * .exec()           // exécute la requête
     *
     * Exemple :
     * collection('maCollection')
     *   .find()
     *   .filter({ statut: 'actif' })
     *   .sort({ createdAt: -1 })
     *   .limit(10)
     *   .skip(20)
     *   .select('nom age')
     *   .populate('profile')
     *   .lean()
     *   .exec()
     */
    class QueryBuilder {
      constructor(operation, initialArgs = []) {
        this.operation = operation;
        this.args = initialArgs.length ? initialArgs : [{}];
      }
      sort(sortObj) { this.args[0].sort = sortObj; return this; }
      limit(limitVal) { this.args[0].limit = limitVal; return this; }
      skip(skipVal) { this.args[0].skip = skipVal; return this; }
      filter(filterObj) { this.args[0].filter = filterObj; return this; }
      select(selectVal) { this.args[0].select = selectVal; return this; }
      byStoreId(val) {  this.args[0].byStoreId = val; return this; }

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
            let params;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }

         params = rest;

        let query = filter;
        let options = {   };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }



      if (this.system) {





        const res = await this.system.post(`${this.baseUrl}`, {
          operation,
          args: finalArgs,
            params,

          invoices: true,
          byStoreId: args[0].byStoreId,
        }, {
          headers: {
            ...this._headers(),
            'x-store-id': this.store
          }
        });
        return res.data.data;

      }


      const res = await this._http.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
          params,
        invoices: true,
        byStoreId: args[0].byStoreId,
      }, {
        headers: {
          ...this._headers(),
          'x-store-id': this.store
        }
      });
      return res.data.data;
    };

    const operations = [
      'find', 'findOne', 'count', 'countDocuments'
    ];

    const model = {};
    for (const op of operations) {
      if (["find", "findOne" ].includes(op)) {
        model[op] = (args = {}) => new QueryBuilder(op, [args]);
      } else {
        model[op] = (...args) => call(op, args);
      }
    }

    return model;
  }







  categories(name) {
      //if (!name) throw new Error("Nom de collection requis");

      /**
       * QueryBuilder chaînable pour toutes les options Mongoose :
       * .filter(obj)      // filtre (query)
       * .sort(obj)        // tri
       * .limit(n)         // limite
       * .skip(n)          // décalage
       * .select(str|obj)  // projection
       * .populate(str|obj)// jointure
       * .lean()           // lean
       * .exec()           // exécute la requête
       *
       * Exemple :
       * collection('maCollection')
       *   .find()
       *   .filter({ statut: 'actif' })
       *   .sort({ createdAt: -1 })
       *   .limit(10)
       *   .skip(20)
       *   .select('nom age')
       *   .populate('profile')
       *   .lean()
       *   .exec()
       */
      class QueryBuilder {
        constructor(operation, initialArgs = []) {
          this.operation = operation;
          this.args = initialArgs.length ? initialArgs : [{}];

        }
        sort(sortObj) { this.args[0].sort = sortObj; return this; }
        limit(limitVal) { this.args[0].limit = limitVal; return this; }
        skip(skipVal) { this.args[0].skip = skipVal; return this; }
        filter(filterObj) { this.args[0].filter = filterObj; return this; }
        select(selectVal) { this.args[0].select = selectVal; return this; }
        mainImageSize(val) {  this.args[0].mainImageSize = val; return this; }
        thumbnailSize(val) {  this.args[0].thumbnailSize = val; return this; }
        byStoreId(val) {  this.args[0].byStoreId = val; return this; }

        lean() { this.args[0].lean = true; return this; }
        async exec() { return await call(this.operation, this.args); }
        then(res, rej) { return this.exec().then(res, rej); }
        catch(rej) { return this.exec().catch(rej); }
      }

      const call = async (operation, args = []) => {
        let finalArgs = args;
          let params;
        if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
          let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
          if (page !== undefined && limit !== undefined) {
            skip = (page - 1) * limit;
          }

           params = rest;
          let query = filter;
          let options = {   };
          if (limit !== undefined) options.limit = limit * 1;
          if (skip !== undefined) options.skip = skip;
          if (sort !== undefined) options.sort = sort;
          finalArgs = [query, options];
        }

        delete params.thumbnailSize
        delete params.mainImageSize




        if (this.system) {





          const res = await this.system.post(`${this.baseUrl}`, {
            operation,
            args: finalArgs,
              params,
            categories: true,
            byStoreId: args[0].byStoreId,

          }, {
            headers: {
              ...this._headers(),
              'x-store-id': this.store
            }
          });
          return res.data.data;

        }

        const res = await this._http.post(`${this.baseUrl}`, {
          operation,
          args: finalArgs,
            params,
          categories: true,
          byStoreId: args[0].byStoreId,

        }, {
          headers: {
            ...this._headers(),
            'x-store-id': this.store
          }
        });
        return res.data.data;
      };

      const operations = [
        'find', 'findOne', 'count', 'countDocuments'
      ];

      const model = {};
      for (const op of operations) {
        if (["find", "findOne"  ].includes(op)) {
          model[op] = (args = {}) => new QueryBuilder(op, [args]);
        } else {
          model[op] = (...args) => call(op, args);
        }
      }

    return model;
  }


  watch(collectionId, { token, onEvent, onError, onConnect } = {}) {
    if (!collectionId) throw new Error("collectionId est requis");
    if (typeof onEvent !== 'function') throw new Error("`onEvent` callback est requis");

    const authToken = token || this.token;
    if (!authToken) throw new Error("Token requis pour le watch. Appelez `setToken()` ou passez `token`.");

    const baseUrl = this.baseUrl
      .replace(/\/sdk\/v1\/lighttable\/?$/, '')
      .replace(/^http/, 'ws');

    if (!_io) {
      throw new Error('socket.io-client est requis. Installez-le avec: npm install socket.io-client');
    }

    const socket = _io(`${baseUrl}/lighttable-watch`, {
      auth: { token: authToken },
      transports: ['websocket', 'polling']
    });

    let connected = false;
    const changeEvent = `change:${collectionId}`;

    socket.on('connect', () => {
      connected = true;
      socket.emit('watch', collectionId, (res) => {
        if (res && res.error) {
          if (typeof onError === 'function') onError(new Error(res.error));
          socket.disconnect();
          return;
        }
        if (typeof onConnect === 'function') onConnect(res);
      });
    });

    socket.on(changeEvent, (change) => {
      if (typeof onEvent === 'function') onEvent(change);
    });

    socket.on('connect_error', (err) => {
      if (typeof onError === 'function') onError(err);
    });

    socket.on('disconnect', () => {
      connected = false;
    });

    return {
      isConnected: () => connected,
      socket,
      unsubscribe() {
        if (socket.connected) {
          socket.emit('unwatch');
          socket.disconnect();
        }
      }
    };
  }


  subscribe(channel, { onMessage, onError, onConnect } = {}) {
    if (!channel) throw new Error("channel est requis");

    const baseUrl = this.baseUrl
      .replace(/\/sdk\/v1\/lighttable\/?$/, '')
      .replace(/^http/, 'ws');

    if (!_io) {
      throw new Error('socket.io-client est requis. Installez-le avec: npm install socket.io-client');
    }

    const socket = _io(`${baseUrl}/broadcast`, {
      transports: ['websocket', 'polling']
    });

    let connected = false;

    socket.on('connect', () => {
      connected = true;
      socket.emit('listen', channel);
      if (typeof onConnect === 'function') onConnect({ channel });
    });

    socket.on('listening', (res) => {
      if (typeof onConnect === 'function') onConnect(res);
    });

    socket.on('message', (msg) => {
      if (typeof onMessage === 'function') onMessage(msg);
    });

    socket.on('connect_error', (err) => {
      if (typeof onError === 'function') onError(err);
    });

    socket.on('disconnect', () => {
      connected = false;
    });

    return {
      isConnected: () => connected,
      socket,
      emit(channel, data) {
        if (socket.connected) {
          socket.emit('emit', channel, data);
        }
      },
      unsubscribe() {
        if (socket.connected) {
          socket.emit('unlisten', channel);
          socket.disconnect();
        }
      }
    };
  }











    stores(name) {
        //if (!name) throw new Error("Nom de collection requis");

        /**
         * QueryBuilder chaînable pour toutes les options Mongoose :
         * .filter(obj)      // filtre (query)
         * .sort(obj)        // tri
         * .limit(n)         // limite
         * .skip(n)          // décalage
         * .select(str|obj)  // projection
         * .populate(str|obj)// jointure
         * .lean()           // lean
         * .exec()           // exécute la requête
         *
         * Exemple :
         * collection('maCollection')
         *   .find()
         *   .filter({ statut: 'actif' })
         *   .sort({ createdAt: -1 })
         *   .limit(10)
         *   .skip(20)
         *   .select('nom age')
         *   .populate('profile')
         *   .lean()
         *   .exec()
         */
        class QueryBuilder {
          constructor(operation, initialArgs = []) {
            this.operation = operation;
            this.args = initialArgs.length ? initialArgs : [{}];

          }
          sort(sortObj) { this.args[0].sort = sortObj; return this; }
          limit(limitVal) { this.args[0].limit = limitVal; return this; }
          skip(skipVal) { this.args[0].skip = skipVal; return this; }
          filter(filterObj) { this.args[0].filter = filterObj; return this; }
          select(selectVal) { this.args[0].select = selectVal; return this; }
          mainImageSize(val) {  this.args[0].mainImageSize = val; return this; }
          thumbnailSize(val) {  this.args[0].thumbnailSize = val; return this; }
                byStoreId(val) {  this.args[0].byStoreId = val; return this; }

          lean() { this.args[0].lean = true; return this; }
          async exec() { return await call(this.operation, this.args); }
          then(res, rej) { return this.exec().then(res, rej); }
          catch(rej) { return this.exec().catch(rej); }
        }

        const call = async (operation, args = []) => {
          let finalArgs = args;
            let params;
          if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
            let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
            if (page !== undefined && limit !== undefined) {
              skip = (page - 1) * limit;
            }

             params = rest;
            let query = filter;
            let options = {   };
            if (limit !== undefined) options.limit = limit * 1;
            if (skip !== undefined) options.skip = skip;
            if (sort !== undefined) options.sort = sort;
            finalArgs = [query, options];
          }

          delete params.thumbnailSize
          delete params.mainImageSize




          if (this.system) {





            const res = await this.system.post(`${this.baseUrl}`, {
              operation,
              args: finalArgs,
                params,
              stores: true,
                byStoreId: args[0].byStoreId,

            }, {
              headers: {
                ...this._headers(),
                'x-store-id': this.store
              }
            });
            return res.data.data;

          }

          const res = await this._http.post(`${this.baseUrl}`, {
            operation,
            args: finalArgs,
              params,
            stores: true,
              byStoreId: args[0].byStoreId,

          }, {
            headers: {
              ...this._headers(),
              'x-store-id': this.store
            }
          });
          return res.data.data;
        };

        const operations = [
          'find', 'findOne', 'count', 'countDocuments'
        ];

        const model = {};
        for (const op of operations) {
          if (["find", "findOne"  ].includes(op)) {
            model[op] = (args = {}) => new QueryBuilder(op, [args]);
          } else {
            model[op] = (...args) => call(op, args);
          }
        }

        return model;
      }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LightTable;
  module.exports.default = LightTable;
} else if (typeof define === 'function' && define.amd) {
  define(() => LightTable);
} else {
  _globalScope.LightTable = LightTable;
}
