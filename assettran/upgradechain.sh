set -e

# don't rewrite paths for Windows Git Bash users
export MSYS_NO_PATHCONV=1
starttime=$(date +%s)
CC_SRC_LANGUAGE="node"
CC_RUNTIME_LANGUAGE=node # chaincode runtime language is node.js
CC_SRC_PATH=/opt/gopath/src/github.com/ccassettran1.0/javascript
CC_REVISION="1.1" # TBD

cd ../basic-network

docker-compose -f ./docker-compose.yml up -d cli

docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/atran.arnest.in/users/Admin@atran.arnest.in/msp" cli peer chaincode install -n atrancc -v "$CC_REVISION" -p "$CC_SRC_PATH" -l "$CC_RUNTIME_LANGUAGE"
docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/atran.arnest.in/users/Admin@atran.arnest.in/msp" cli peer chaincode upgrade -n atrancc -v "$CC_REVISION" -p "$CC_SRC_PATH" -C atranchannel -l "$CC_RUNTIME_LANGUAGE" -c '{"Args":[]}'
docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/atran.arnest.in/users/Admin@atran.arnest.in/msp" cli peer chaincode instantiate -o orderer.arnest.in:7050 -C atranchannel -n atrancc -l "$CC_RUNTIME_LANGUAGE" -v 1.0 -c '{"Args":[]}' -P "OR ('atranMSP.member', 'arMSP.member' )"
sleep 10
docker exec -e "CORE_PEER_LOCALMSPID=Org1MSP" -e "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/atran.arnest.in/users/Admin@atran.arnest.in/msp" cli peer chaincode invoke -o orderer.arnest.in:7050 -C atranchannel -n atrancc -c '{"function":"initLedger","Args":[]}'

printf "\nTotal setup (chaincode 'atrancc' upgrade $CC_REVISION) execution time : $(($(date +%s) - starttime)) secs ...\n\n\n"
