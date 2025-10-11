const axios = require('axios');

class LightTable {
  constructor({ baseUrl, store, token = null }) {
    this.baseUrl = (baseUrl || 'https://lb01.genielabel.com/sdk/v1/lighttable').replace(/\/$/, '');
    if (!store) throw new Error("`store` est requis");

    this.store = store;

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

    const res = await axios.post(`${this.baseUrl}/signed-url`, { key}, {
      headers: this._headers()
    });

    return res.data.url;
  }


  async verifyOtp({ code, phone, email }) {
    if (!code || (!phone && !email)) {
      throw new Error("`code` et `phone` ou `email` sont requis");
    }

    const res = await axios.post(`${this.baseUrl}/auth-otp/verify`, { code, phone, email }, {

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
    const res = await axios.get(`${this.baseUrl}/me`, {
      headers: {
        ...this._headers(),
        'x-store-id': this.store
      }
    });
    return res.data;
  }

  async updateMe(payload) {
    const res = await axios.put(`${this.baseUrl}/me`, payload, {
      headers: {
        ...this._headers(),
        'x-store-id': this.store
      }
    });
    return res.data;
  }



  async runFuction(payload) {
    const res = await axios.post(`${this.baseUrl}/function`, payload, {
      headers: {
        ...this._headers(),
        'x-store-id': this.store
      }
    });
    return res.data;
  }


    async checkout(payload) {
      const res = await axios.post(`${this.baseUrl}/checkout`, payload, {
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
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }

        let query = filter;
        let options = { ...rest };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }
      const res = await axios.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
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

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }

        let query = filter;
        let options = { ...rest };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }
      const res = await axios.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
        products: true,

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

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }

        let query = filter;
        let options = { ...rest };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }
      const res = await axios.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
        services: true
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

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }

        let query = filter;
        let options = { ...rest };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }
      const res = await axios.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
        orders: true
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

      lean() { this.args[0].lean = true; return this; }
      async exec() { return await call(this.operation, this.args); }
      then(res, rej) { return this.exec().then(res, rej); }
      catch(rej) { return this.exec().catch(rej); }
    }

    const call = async (operation, args = []) => {
      let finalArgs = args;
      if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
        let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
        if (page !== undefined && limit !== undefined) {
          skip = (page - 1) * limit;
        }

        let query = filter;
        let options = { ...rest };
        if (limit !== undefined) options.limit = limit * 1;
        if (skip !== undefined) options.skip = skip;
        if (sort !== undefined) options.sort = sort;
        finalArgs = [query, options];
      }
      const res = await axios.post(`${this.baseUrl}`, {
        operation,
        args: finalArgs,
        invoices: true
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

        lean() { this.args[0].lean = true; return this; }
        async exec() { return await call(this.operation, this.args); }
        then(res, rej) { return this.exec().then(res, rej); }
        catch(rej) { return this.exec().catch(rej); }
      }

      const call = async (operation, args = []) => {
        let finalArgs = args;
        if (["find", "findOne" ].includes(operation) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
          let { filter = {}, limit, skip, page, sort, ...rest } = args[0];
          if (page !== undefined && limit !== undefined) {
            skip = (page - 1) * limit;
          }

          let query = filter;
          let options = { ...rest };
          if (limit !== undefined) options.limit = limit * 1;
          if (skip !== undefined) options.skip = skip;
          if (sort !== undefined) options.sort = sort;
          finalArgs = [query, options];
        }
        const res = await axios.post(`${this.baseUrl}`, {
          operation,
          args: finalArgs,
          categories: true,
         
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

module.exports = LightTable;
