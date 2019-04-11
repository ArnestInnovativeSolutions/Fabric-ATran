exports.config = {
  Settings: {
      WebUrl: 'http://localhost:4200/#/' // TODO: 
  },
  Crypto: {
    TextEncoding: 'base64',
    Format: 'ecdsa-with-SHA1'
  },
  Blockchain: {
    Channel: 'mychannel',
    ChainCode: 'sv10',
    MSPID: 'Org1MSP',
    // IP: 'grpc://localhost',
    IP: 'grpc://127.0.0.1', // TODO: localhost
    CAServer: 'http://localhost:7054', // this ,maynot need to change now
    OrdererPort: '7050',
    PeerPort: '7051',
    EventPeerPort: '7053',
    KeyStorePath: 'hfc-key-store'
  }
};
