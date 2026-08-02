/**
 * Resource factory.
 *
 * Most admin sections are the same shape: list rows, create one, update one,
 * delete one. Rather than writing that fetch/unwrap/error dance sixty times,
 * a section declares which endpoints it uses and gets a typed-ish resource
 * object back.
 *
 * Anything genuinely bespoke (bulk imports, AI calls, uploads) stays a plain
 * function in the section module — this factory covers the repetitive 80%.
 */

import { api, unwrapList, unwrapItem } from './client.js';

/**
 * @param {object} spec
 * @param {string} spec.name              Human label, used in error messages.
 * @param {function} [spec.listPath]      (params) => path
 * @param {function} [spec.createPath]    (params) => path
 * @param {function} [spec.itemPath]      (id, params) => path
 * @param {string[]} [spec.listKeys]      Response keys that hold the array.
 * @param {string[]} [spec.itemKeys]      Response keys that hold the object.
 * @param {string} [spec.idField='id']    Primary key on each row.
 * @param {'PUT'|'PATCH'} [spec.updateMethod='PUT']
 * @param {function} [spec.normalize]     (row) => row, applied to every row read.
 * @param {function} [spec.serialize]     (values) => body, applied before write.
 */
export function createResource(spec) {
  const {
    name,
    listPath,
    createPath,
    itemPath,
    listKeys = [],
    itemKeys = [],
    idField = 'id',
    updateMethod = 'PUT',
    normalize,
    serialize,
  } = spec;

  const applyNormalize = (rows) => (normalize ? rows.map(normalize) : rows);
  const applySerialize = (values) => (serialize ? serialize(values) : values);

  function requirePath(fn, operation) {
    if (typeof fn !== 'function') {
      throw new Error(`${name}: ${operation} is not supported by this resource`);
    }
    return fn;
  }

  return {
    name,
    idField,
    spec,

    /** Read the collection. `params` is forwarded to the path builder. */
    async list({ params, query, signal } = {}) {
      const path = requirePath(listPath, 'list')(params);
      const payload = await api.get(path, { query, signal });
      return applyNormalize(unwrapList(payload, listKeys));
    },

    /** Read one row. Falls back to filtering the list when there is no item GET. */
    async get(id, { params, query, signal } = {}) {
      const path = requirePath(itemPath, 'get')(id, params);
      const payload = await api.get(path, { query, signal });
      const item = unwrapItem(payload, itemKeys);
      return normalize && item ? normalize(item) : item;
    },

    async create(values, { params, signal } = {}) {
      const path = requirePath(createPath || listPath, 'create')(params);
      const payload = await api.post(path, applySerialize(values), { signal });
      const item = unwrapItem(payload, itemKeys);
      return normalize && item && typeof item === 'object' ? normalize(item) : item;
    },

    async update(id, values, { params, signal } = {}) {
      const path = requirePath(itemPath, 'update')(id, params);
      const method = updateMethod === 'PATCH' ? api.patch : api.put;
      const payload = await method(path, applySerialize(values), { signal });
      const item = unwrapItem(payload, itemKeys);
      return normalize && item && typeof item === 'object' ? normalize(item) : item;
    },

    /** Create when the row has no id yet, update when it does. */
    async save(values, { params, signal } = {}) {
      const id = values?.[idField];
      if (id === undefined || id === null || id === '') {
        return this.create(values, { params, signal });
      }
      const { [idField]: _omit, ...rest } = values;
      return this.update(id, rest, { params, signal });
    },

    async remove(id, { params, signal } = {}) {
      const path = requirePath(itemPath, 'remove')(id, params);
      return api.del(path, { signal });
    },
  };
}

export default createResource;
