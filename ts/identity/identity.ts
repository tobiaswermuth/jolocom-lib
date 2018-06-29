import { DidDocument } from './didDocument'
import { SignedCredential } from '../credentials/signedCredential/signedCredential'
import { IIdentityCreateArgs } from './types'

export class Identity {
  public didDocument: DidDocument
  private profile?: SignedCredential

  public publicProfile = {
    get: this.getPublicProfile.bind(this),
    add: this.addPublicProfile.bind(this),
    delete: this.deletePublicProfile.bind(this),
    update: this.updatePublicProfile.bind(this)
  }

  public static create({didDocument, profile}: IIdentityCreateArgs): Identity {
    const identity = new Identity()
    identity.didDocument = DidDocument.fromJSON(didDocument)
    if (profile) {
      identity.profile = profile
    }

    return identity
  }

  private getPublicProfile() {
    if ( !this.profile ) { throw new Error('No public Profile available') }
    return this.profile.getCredentialSection()
  }

  private addPublicProfile(publicProfile: SignedCredential) {
    if ( !this.profile ) { throw new Error('Public Profile already added') }
    this.profile = publicProfile

    return this
  }

  private updatePublicProfile(publicProfile: SignedCredential) {
    this.profile = publicProfile

    return this
  }

  private deletePublicProfile() {
    if ( !this.profile ) { throw new Error('Public Profile already added') }
    this.profile = undefined

    return this
  }

  public getDID() {
    return this.didDocument.getDID()
  }

  public getServiceEndpoints() {
    return this.didDocument.getServiceEndpoints()
  }

  public getPublicKeySection() {
    this.didDocument.getPublicKeySection()
  }
}
