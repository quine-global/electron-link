const crypto = require('crypto')
const { ClassicLevel } = require('classic-level')

module.exports = class TransformCache {
  constructor (filePath, invalidationKey) {
    this.filePath = filePath
    this.invalidationKey = invalidationKey
    this.db = null
    this.usedKeys = new Set()
  }

  async loadOrCreate () {
    await this._initialize()
    const oldKey = await this._get('invalidation-key')
    const newKey = crypto.createHash('sha1').update(this.invalidationKey).digest('hex')
    if (oldKey !== newKey) {
      const keys = await this._allKeys()
      const deleteOperations = Array.from(keys).map((key) => { return {key, type: 'del'} })
      await this._batch(deleteOperations)
      await this._put('invalidation-key', newKey)
    }
  }

  async dispose () {
    await this.db.close()
  }

  async put ({filePath, original, transformed, requires}) {
    const key = crypto.createHash('sha1').update(original).digest('hex')
    await this._put(filePath + ':' + key + ':source', transformed)
    await this._put(filePath + ':' + key + ':requires', JSON.stringify(requires))
  }

  async get ({filePath, content}) {
    const key = crypto.createHash('sha1').update(content).digest('hex')
    const source = await this._get(filePath + ':' + key + ':source')
    const requires = await this._get(filePath + ':' + key + ':requires')
    if (source && requires) {
      return {source, requires: JSON.parse(requires)}
    } else {
      return null
    }
  }

  async deleteUnusedEntries () {
    const unusedKeys = await this._allKeys()
    for (const key of this.usedKeys) {
      unusedKeys.delete(key)
    }

    const deleteOperations = Array.from(unusedKeys).map((key) => { return {key, type: 'del'} })
    await this._batch(deleteOperations)
  }

  async _initialize () {
    this.db = new ClassicLevel(this.filePath, { keyEncoding: 'utf8', valueEncoding: 'utf8' })
    await this.db.open()
  }

  async _put (key, value) {
    await this.db.put(key, value)
    this.usedKeys.add(key)
  }

  async _get (key) {
    try {
      const value = await this.db.get(key)
      this.usedKeys.add(key)
      return value
    } catch (error) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null
      }
      throw error
    }
  }

  async _allKeys () {
    return new Set(await this.db.keys().all())
  }

  async _batch (operations) {
    if (operations.length > 0) {
      await this.db.batch(operations)
    }
  }
}
