export PATH=$GOPATH/src/github.com/hyperledger/fabric/build/bin:${PWD}/../bin:${PWD}:$PATH
export FABRIC_CFG_PATH=${PWD}
CHANNEL_NAME=atranchannel

# remove previous crypto material and config transactions
rm -fr config/*
rm -fr crypto-config/*

# generate crypto material
cryptogen generate --config=./crypto-config.yaml
if [ "$?" -ne 0 ]; then
  echo "Failed to generate crypto material..."
  exit 1
fi

# generate genesis block for orderer
configtxgen -profile ATranOrgOrdererGenesis -outputBlock ./config/atran.block
if [ "$?" -ne 0 ]; then
  echo "Failed to generate orderer genesis block..."
  exit 1
fi

# generate channel configuration transaction
configtxgen -profile ATranOrgChannel -outputCreateChannelTx ./config/atran.tx -channelID $CHANNEL_NAME
if [ "$?" -ne 0 ]; then
  echo "Failed to generate channel configuration transaction..."
  exit 1
fi

# generate anchor peer transaction
configtxgen -profile ATranOrgChannel -outputAnchorPeersUpdate ./config/atranMSPanchors.tx -channelID $CHANNEL_NAME -asOrg atranMSP
if [ "$?" -ne 0 ]; then
  echo "Failed to generate anchor peer update for atranMSP..."
  exit 1
fi
