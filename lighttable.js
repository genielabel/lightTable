const _globalScope = typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof self !== 'undefined'
    ? self
    : (typeof window !== 'undefined'
      ? window
      : (typeof global !== 'undefined' ? global : {})));

const _resolveFetch = (fetchImpl) => {
  if (typeof fetchImpl === 'function') return fetchImpl;
  if (typeof _globalScope.fetch === 'function') return _globalScope.fetch.bind(_globalScope);
  return null;
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
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
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

    const operations = [
      'find', 'findOne', 'count', 'countDocuments',
      'findOneAndUpdate', 'findById', 'findByIdAndUpdate',
      'deleteOne', 'deleteMany', 'updateOne', 'updateMany',
      'save', 'insertMany', 'aggregate', 'distinct', 'create',

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
