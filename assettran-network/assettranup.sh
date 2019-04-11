# Exit on first error, print all commands.
set -ev

# don't rewrite paths for Windows Git Bash users
export MSYS_NO_PATHCONV=1

docker-compose -f docker-compose.yml down

docker-compose -f docker-compose.yml up -d orderer.arnest.in ca.atran.arnest.in peer0.atran.arnest.in atran.arnest.couchdb

# wait for Hyperledger Fabric to start
# incase of errors when running later commands, issue export FABRIC_START_TIMEOUT=<larger number>
export FABRIC_START_TIMEOUT=15
#echo ${FABRIC_START_TIMEOUT}
sleep ${FABRIC_START_TIMEOUT}

# Create the channel
docker exec -e "CORE_PEER_LOCALMSPID=atranMSP" -e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@atran.arnest.in/msp" peer0.atran.arnest.in peer channel create -o orderer.arnest.in:7050 -c atranchannel -f /etc/hyperledger/configtx/atran.tx
# Join peer0.ccm.c-log.com to the channel.
docker exec -e "CORE_PEER_LOCALMSPID=atranMSP" -e "CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/users/Admin@atran.arnest.in/msp" peer0.atran.arnest.in peer channel join -b atranchannel.block
