# Exit on first error
set -e

# don't rewrite paths for Windows Git Bash users
export MSYS_NO_PATHCONV=1
starttime=$(date +%s)
CC_SRC_LANGUAGE="node"
CC_RUNTIME_LANGUAGE=node # chaincode runtime language is node.js
CC_SRC_PATH=/opt/gopath/src/github.com/ccassettran1.0/javascript

echo $CC_SRC_LANGUAGE

# clean the keystore
#rm -rf ./hfc-key-store

# launch network; create channel and join peer to channel
cd ../assettran-network
./assettranup.sh

# Now launch the CLI container in order to install, instantiate chaincode
# and prime the ledger with our 10 cars
docker-compose -f ./docker-compose.yml up -d cli

docker exec -e "CORE_PEER_LOCALMSPID=atranMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/atran.arnest.in/users/Admin@atran.arnest.in/msp" cli peer chaincode install -n atrancc -v 1.0 -p "$CC_SRC_PATH" -l "$CC_RUNTIME_LANGUAGE"
docker exec -e "CORE_PEER_LOCALMSPID=atranMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/atran.arnest.in/users/Admin@atran.arnest.in/msp" cli peer chaincode instantiate -o orderer.arnest.in:7050 -C atranchannel -n atrancc -l "$CC_RUNTIME_LANGUAGE" -v 1.0 -c '{"Args":[]}' -P "OR ('atranMSP.member', 'arMSP.member' )"
sleep 10
docker exec -e "CORE_PEER_LOCALMSPID=atranMSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/atran.arnest.in/users/Admin@atran.arnest.in/msp" cli peer chaincode invoke -o orderer.arnest.in:7050 -C atranchannel -n atrancc -c '{"function":"initLedger","Args":[]}'

cat <<EOF

Total setup execution time : $(($(date +%s) - starttime)) secs ...
  Start by changing into the "assettran" directory:
    cd assettran

  Next, install all required packages:
    npm install
EOF

