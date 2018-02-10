import * as superagent from 'superagent-es6-promise'
import TokenPayload from './tokenPayload'
import testAuth from '../../tests/data/authentication'
import * as QRCode from 'qrcode'
import { TokenSigner, TokenVerifier, decodeToken } from 'jsontokens'
import {
  initiateSecretExchange,
  respondSecretExchange,
  getEncryptionSecret,
  encrypt,
  decrypt
} from '../security/encryption'
import { getSigningKeysFromWIF } from '../utils/keysEncoding'

export default class Authentication {
  async initiateRequest({did, claims, IPFSroom, WIF, encrypt} :
    {did : string, claims : Array<string>, IPFSroom : string, WIF : string, encrypt: boolean}) : Promise<any> {

    let response = {}
    let encryptOptions

    if(encrypt) {
      encryptOptions = initiateSecretExchange()
      response['initiator'] = encryptOptions.initiator
    }
    const keys = getSigningKeysFromWIF({WIF: WIF})
    const tokenPayload = new TokenPayload({
      iss: did,
      pubKeyIss: keys.pubKey,
      encryptPrime: encrypt ? encryptOptions.prime : '',
      encryptPubKeyIss: encrypt ? encryptOptions.initiatorKey : '',
      reqClaims: claims,
      IPFSroom: IPFSroom
    })
    const token = new TokenSigner('ES256k', keys.privKey).sign(tokenPayload)
    response['qrCode'] = await this.createQRCode({token: token})
    response['token'] = token
    return response
  }

  authenticateRequest({token} : {token : string}) {
    const tokenData = decodeToken(token)
    const isTokenVerified = new TokenVerifier('ES256k', tokenData.payload.pubKeyIss).verify(token)
    if(isTokenVerified) {
      return tokenData
    } else {
      return new Error('Web Token Not Valid')
    }
  }

  async initiateResponse({tokenData, WIF, did, claims} :
    {tokenData: any, WIF: string, did: string, claims: Array<any>}) : Promise<any> {
      const isDataEncrypted = tokenData.payload.encryptPrime && tokenData.payload.encryptPubKeyIss
      let claimsEncrypted
      let encryptPubKeySub

      if(isDataEncrypted !== 'undefined' && isDataEncrypted.length > 1) {
        const enc = this.handleEncryption({tokenData: tokenData, claims: claims})
        claimsEncrypted = enc.cipherText
        encryptPubKeySub = enc.encryptPubKeySub
      }

      const keys = getSigningKeysFromWIF({WIF: WIF})
      const tokenPayload = TokenPayload.generateResponse({
        tokenData: tokenData,
        sub: did,
        pubKeySub: keys.pubKey,
        encryptPubKeySub: encryptPubKeySub ? encryptPubKeySub : '',
        claims: claimsEncrypted ? claimsEncrypted : claims
      })

      const token = new TokenSigner('ES256K', keys.privKey).sign(tokenPayload)
      return token
  }

  async authenticateResponse({token, secretExchangeParty} :
    {token : string, secretExchangeParty?: any}) : Promise<any> {

    const tokenData = decodeToken(token)
    const isTokenVerified = new TokenVerifier('ES256k', tokenData.payload.pubKeySub).verify(token)
    const isDataEncrypted = tokenData.payload.encryptPrime && tokenData.payload.encryptPubKeyIss

    if(isTokenVerified) {
      if(isDataEncrypted !== 'undefined' && isDataEncrypted.length > 1) {
        const claims = this.handleDecryption({
          tokenData: tokenData,
          secretExchangeParty: secretExchangeParty
        })
        return claims
      }
      return tokenData.payload.claims

    } else {
      return new Error('Web Token Not Valid')
    }
  }

  private handleDecryption({tokenData, secretExchangeParty} :
    {tokenData: any, secretExchangeParty: any}) {

    const secret = getEncryptionSecret({
      party: secretExchangeParty,
      pubKey: tokenData.payload.encryptPubKeySub
    })

    const plainText = decrypt({key: secret, cipherText: tokenData.payload.claims})
    return plainText
  }

  private handleEncryption({tokenData, claims} : {tokenData :any, claims: any}) {
    const encryptOptions = respondSecretExchange({prime: tokenData.payload.encryptPrime})
    const secret = getEncryptionSecret({
      party: encryptOptions.responder,
      pubKey: tokenData.payload.encryptPubKeyIss
    })
    const cipherText = encrypt({key: secret, plainText: claims})
    const result = {
      encryptPubKeySub: encryptOptions.responderKey,
      cipherText: cipherText
    }
    return result
  }

  private async createQRCode({token} : {token: string}) : Promise<any> {
    return new Promise((resolve, reject) => {
      QRCode.toDataURL(token, (err, url) => {
        if(err) { reject(err) }
        resolve(url)
      })
    })
  }
}