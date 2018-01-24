import * as bs58 from 'bs58'

/* Creates Identity id according to DID/DDO specifications
 * Source: https://w3c-ccg.github.io/did-spec/
 */
export default class Did{
  identifier: string
  constructor(publicKey: string) {
    const prefix = 'did:jolo:'
    const suffix = bs58.encode(publicKey.substr(0, 16))
    this.identifier = prefix + suffix
  }

  toJSON(): string {
    return this.identifier
  }

  static fromJson(id: string): Did {
    let did = Object.create(Did.prototype)
    return Object.assign(did, id, {
      identifier: id
    })
  }
}
