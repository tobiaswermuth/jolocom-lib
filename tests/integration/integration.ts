import * as chai from 'chai'
import * as sinonChai from 'sinon-chai'
import * as integrationHelper from './provision'
import { IpfsStorageAgent } from '../../ts/ipfs/ipfs'
import { EthResolver } from '../../ts/ethereum/ethereum'
import { IdentityWallet } from '../../ts/identityWallet/identityWallet'
import { createJolocomRegistry } from '../../ts/registries/jolocomRegistry'
import { KeyTypes } from '../../ts/vaultedKeyProvider/types'
import { SignedCredential } from '../../ts/credentials/signedCredential/signedCredential'
import { publicProfileCredJSON } from '../data/identity.data'
import { testEthereumConfig, testIpfsConfig, userVault, userPass, serviceVault, servicePass } from './integration.data'
import { SoftwareKeyProvider } from '../../ts/vaultedKeyProvider/softwareProvider'
import { testSeed } from '../data/keys.data'

chai.use(sinonChai)
const expect = chai.expect

describe('Integration Test - Create, Resolve, Public Profile', () => {
  let jolocomRegistry = createJolocomRegistry({
    ipfsConnector: new IpfsStorageAgent(testIpfsConfig),
    ethereumConnector: new EthResolver(testEthereumConfig)
  })

  let userIdentityWallet: IdentityWallet
  let serviceIdentityWallet: IdentityWallet

  before(async () => {
    await integrationHelper.init()
  })

  after(() => {
    process.exit(0)
  })

  it('should correctly create user and service identities', async () => {
    userIdentityWallet = await jolocomRegistry.create(userVault, userPass)
    const remoteUserIdentity = await jolocomRegistry.resolve(userIdentityWallet.getDid())

    serviceIdentityWallet = await jolocomRegistry.create(serviceVault, servicePass)
    const remoteServiceIdentity = await jolocomRegistry.resolve(serviceIdentityWallet.getDid())

    expect(remoteUserIdentity.getDidDocument()).to.deep.eq(userIdentityWallet.getDidDocument())
    expect(remoteServiceIdentity.getDidDocument()).to.deep.eq(remoteServiceIdentity.getDidDocument())
  })

  it('should correctly add and commit public profile', async () => {
    const servicePublicProfile = SignedCredential.fromJSON(publicProfileCredJSON)
    serviceIdentityWallet.getIdentity().publicProfile.set(servicePublicProfile)

    await jolocomRegistry.commit({
      vaultedKeyProvider: serviceVault,
      identityWallet: serviceIdentityWallet,
      keyMetadata: {
        derivationPath: KeyTypes.ethereumKey,
        encryptionPass: servicePass
      }
    })

    const remoteServiceIdentity = await jolocomRegistry.resolve(serviceIdentityWallet.getDid())

    expect(remoteServiceIdentity.publicProfile.get()).to.deep.eq(servicePublicProfile)
    expect(remoteServiceIdentity.getDidDocument()).to.deep.eq(remoteServiceIdentity.getDidDocument())
  })

  it('should correctly implement authenticate with no public profile', async () => {
    const wallet = await jolocomRegistry.authenticate(userVault, {
      derivationPath: KeyTypes.jolocomIdentityKey,
      encryptionPass: userPass
    })
    expect(wallet.getIdentity().getDidDocument()).to.deep.eq(userIdentityWallet.getIdentity().getDidDocument())
    expect(wallet.getIdentity().publicProfile.get()).to.deep.eq(userIdentityWallet.getIdentity().publicProfile.get())
  })

  it('should correctly implement authenticate with public profile', async () => {
    const wallet = await jolocomRegistry.authenticate(serviceVault, {
      derivationPath: KeyTypes.jolocomIdentityKey,
      encryptionPass: servicePass
    })

    const remoteDidDoc = wallet.getDidDocument().toJSON()
    const localDidDoc = serviceIdentityWallet.getDidDocument().toJSON()

    const remotePubProf = wallet
      .getIdentity()
      .publicProfile.get()
      .toJSON()

    const localPubProf = serviceIdentityWallet
      .getIdentity()
      .publicProfile.get()
      .toJSON()

    expect(remoteDidDoc).to.deep.eq(localDidDoc)
    expect(remotePubProf).to.deep.eq(localPubProf)
  })

  it('should correctly fail to authenticate as non existing did', async () => {
    const mockVault = new SoftwareKeyProvider(testSeed, 'pass')

    try {
      await jolocomRegistry.authenticate(mockVault, {
        derivationPath: KeyTypes.jolocomIdentityKey,
        encryptionPass: 'pass'
      })
    } catch (err) {
      expect(err.message).to.eq('Could not retrieve DID Document. No record for DID found.')
    }
  })
})
