const jwt = require('jsonwebtoken');
var crypto = require('crypto');
const fs = require('fs');
var path = require('path');
const util = require('util');

var Fabric_Client = require('fabric-client');
var Fabric_CA_Client = require('fabric-ca-client');
var os = require('os');

const config = require('./configuration').config;

/***************  ***************/
const STRING_ENCODING = config.Crypto.TextEncoding;
const SIGN_FORMAT = config.Crypto.Format; // 'ecdsa-with-SHA1', 'RSA-SHA256', 'SHA256', 'RS256'
/***************  ***************/

/***************  ***************/
const _LOCALHOST = config.Blockchain.IP;

const _ordererAddress = _LOCALHOST + ':' + config.Blockchain.OrdererPort;
const _peerAddress = _LOCALHOST + ':' + config.Blockchain.PeerPort;
const _eventPeerAddress = _LOCALHOST + ':' + config.Blockchain.EventPeerPort;
const _channel = config.Blockchain.Channel;
const _chainId = config.Blockchain.Channel;
const _chaincodeId = config.Blockchain.ChainCode;
const _mspid = config.Blockchain.MSPID;
const _storePath = config.Blockchain.KeyStorePath;
/***************  ***************/

var signupUser = async function (newUsername = '', baseUser = 'admin', affiliation = 'org1.department1', role = 'client') {
    var fabric_client = new Fabric_Client();
    var fabric_ca_client = null;
    var admin_user = null;
    var member_user = null;
    var store_path = path.join(__dirname, _storePath);
    // create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
    const state_store = await Fabric_Client.newDefaultKeyValueStore({ path: store_path });
    try {
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);
        var tlsOptions = {
            trustedRoots: [],
            verify: false
        };
        // be sure to change the http to https when the CA is running TLS enabled
        fabric_ca_client = new Fabric_CA_Client(config.Blockchain.CAServer, null, '', crypto_suite);
        // first check to see if the admin is already enrolled
        const user_from_store = await fabric_client.getUserContext(baseUser, true);

        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded ' + baseUser + ' from persistence');
            admin_user = user_from_store;
        } else {
            throw new Error('Failed to get ' + baseUser + '.... please enrol');
        }

        // at this point we should have the admin user
        // first need to register the user with the CA server
        const secret = await fabric_ca_client.register({ enrollmentID: newUsername, affiliation: affiliation, role: role }, admin_user);
        console.log('Successfully registered ' + newUsername + ' - secret:' + secret);
        const enrollment = await fabric_ca_client.enroll({ enrollmentID: newUsername, enrollmentSecret: secret });

        console.log('Successfully enrolled member user "' + newUsername + '" ');
        var user = await fabric_client.createUser(
            {
                username: newUsername,
                mspid: _mspid,
                cryptoContent: { privateKeyPEM: enrollment.key.toBytes(), signedCertPEM: enrollment.certificate }
            });

        member_user = user;
        await fabric_client.setUserContext(member_user);
        console.log(newUsername + ' was successfully registered and enrolled and is ready to intreact with the fabric network');
        return secret;
    } catch (err) {
        console.error('Failed to register: ' + err);
        if (err.toString().indexOf('Authorization') > -1) {
            console.error('Authorization failures may be caused by having ' + baseUser + ' credentials from a previous CA instance.\n' +
                'Try again after deleting the contents of the store directory ' + store_path);
        }

        throw new Error('Failed to register: ' + err);
    }
};

/************* ChainCode START *************/
class ChainCodeConfig {

}
class ChainCode {
    get role() {
        return this.claims.role;
    }
    get org() {
        return this.claims.org;
    }
    get user() {
        return this.claims.user.toLowerCase();
    }

    /**
     * Creates chaincode instance for signed user
     * @param {ARNESTSigner} blockToken blockToken object
     */
    constructor(_ARNESTToken) {
        if (_ARNESTToken) {
            this.claims = _ARNESTToken;
            this.assert();
        }
    }

    Init(user, org, role) {
        this.claims = {
            user: user,
            org: org,
            role: role
        };

        this.assert();
    }

    assert() {
        return true;
    }

    async ExecuteQueryAsync(functionName, args, donotParseJson = false) {
        var fabric_client = new Fabric_Client();

        // setup the fabric network
        var channel = fabric_client.newChannel(_channel);
        var peer = fabric_client.newPeer(_peerAddress);
        channel.addPeer(peer);

        //
        var member_user = null;
        var user_id = this.user;
        var store_path = path.join(__dirname, _storePath);
        var tx_id = null;

        try {
            var state_store = await Fabric_Client.newDefaultKeyValueStore({ path: store_path });
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            try {
                // get the enrolled user from persistence, this user will sign all requests
                var user_from_store = await fabric_client.getUserContext(user_id, true);

                if (user_from_store && user_from_store.isEnrolled()) {
                    console.log('Successfully loaded ' + user_id + ' from persistence');
                    member_user = user_from_store;
                } else {
                    throw new Error('Failed to get ' + user_id + '.... run registerUser.js');
                }

                const request = {
                    //targets : --- letting this default to the peers assigned to the channel
                    chaincodeId: _chaincodeId,
                    fcn: functionName,
                    args: args
                };

                try {
                    // send the query proposal to the peer
                    var query_responses = await channel.queryByChaincode(request);
                    console.log("Query has completed, checking results");
                    // query_responses could have more than one  results if there multiple peers were used as targets
                    if (query_responses && query_responses.length == 1) {
                        if (query_responses[0] instanceof Error) {
                            console.error("error from query = ", query_responses[0]);
                        } else {
                            // console.log(JSON.parse(query_responses[0].toString('utf8')));
                            return (donotParseJson === true) ? JSON.parse(query_responses[0].toString('utf8')) : JSON.parse(query_responses[0].toString());
                            //return JSON.parse(query_responses[0].toString());
                        }
                    } else {
                        console.log("No payloads were returned from query");
                        return null;
                    }
                } catch (err) {
                    throw new Error(err);
                }
            } catch (err) {
                throw new Error(err);
            }
        } catch (err) {
            console.error('Failed to query successfully :: ' + err);
            throw new Error('Failed to query successfully :: ' + err);
        }
    }

    async ExecuteSearchQueryAsync(functionName, args) {
        var fabric_client = new Fabric_Client();

        // setup the fabric network
        var channel = fabric_client.newChannel(_channel);
        var peer = fabric_client.newPeer(_peerAddress);
        channel.addPeer(peer);

        //
        var member_user = null;
        var user_id = this.user;
        var store_path = path.join(__dirname, _storePath);
        var tx_id = null;

        try {
            var state_store = await Fabric_Client.newDefaultKeyValueStore({ path: store_path });
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            try {
                // get the enrolled user from persistence, this user will sign all requests
                var user_from_store = await fabric_client.getUserContext(user_id, true);

                if (user_from_store && user_from_store.isEnrolled()) {
                    console.log('Successfully loaded ' + user_id + ' from persistence');
                    member_user = user_from_store;
                } else {
                    throw new Error('Failed to get ' + user_id + '.... run registerUser.js');
                }

                const request = {
                    //targets : --- letting this default to the peers assigned to the channel
                    chaincodeId: _chaincodeId,
                    fcn: functionName,
                    args: args
                };

                try {
                    // send the query proposal to the peer
                    var query_responses = await channel.queryByChaincode(request);
                    console.log("Query has completed, checking results");
                    // query_responses could have more than one  results if there multiple peers were used as targets
                    if (query_responses && query_responses.length == 1) {
                        if (query_responses[0] instanceof Error) {
                            console.error("error from query = ", query_responses[0]);
                        } else {
                            // console.log("Response is ", query_responses[0].toString());
                            var jresult = [];
                            jresult = JSON.parse(query_responses[0].toString());
                            // console.log(jresult);
                            // console.log(jresult.length);
                            // return jresult;
                            var resultArray = [];
                            if (jresult && jresult.length > 0) {
                                for (var i = 0; i < jresult.length; i++) {
                                    resultArray.push(jresult[i].Record);
                                }
                            }

                            return resultArray;
                        }
                    } else {
                        console.log("No payloads were returned from query");
                        return null;
                    }
                } catch (err) {
                    throw new Error(err);
                }
            } catch (err) {
                throw new Error(err);
            }
        } catch (err) {
            console.error('Failed to query successfully :: ' + err);
            throw new Error('Failed to query successfully :: ' + err);
        }
    }

    async ExecuteCommandAsync(functionName, args) {
        var fabric_client = new Fabric_Client();
        console.log('invoke: ' + functionName);
        console.log(args);

        // setup the fabric network
        var channel = fabric_client.newChannel(_channel);
        var peer = fabric_client.newPeer(_peerAddress);
        channel.addPeer(peer);
        var order = fabric_client.newOrderer(_ordererAddress)
        channel.addOrderer(order);

        console.log(this.user);
        //
        var member_user = null;
        var user_id = this.user;
        var store_path = path.join(__dirname, _storePath);
        var tx_id = null;

        // create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
        const state_store = await Fabric_Client.newDefaultKeyValueStore({ path: store_path });
        try {
            // assign the store to the fabric client
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            // get the enrolled user from persistence, this user will sign all requests
            const user_from_store = await fabric_client.getUserContext(user_id, true);

            try {
                if (user_from_store && user_from_store.isEnrolled()) {
                    console.log('Successfully loaded ' + user_id + ' from persistence');
                    member_user = user_from_store;
                } else {
                    throw new Error('Failed to get ' + user_id + '.... run registerUser.js');
                }

                // get a transaction id object based on the current user assigned to fabric client
                tx_id = fabric_client.newTransactionID();
                console.log("Assigning transaction_id: ", tx_id._transaction_id);

                // id, bargeid, terminalid, labid, initiatedBy / cargooperator, qty, unitPrice
                var request = {
                    //targets: let default to the peer assigned to the client
                    chaincodeId: _chaincodeId,
                    chainId: _chainId,
                    fcn: functionName,
                    args: args,
                    txId: tx_id
                };

                // send the transaction proposal to the peers
                var results1 = await channel.sendTransactionProposal(request);
                var results = [];
                try {
                    var proposalResponses = results1[0];
                    var proposal = results1[1];
                    let isProposalGood = false;
                    if (proposalResponses && proposalResponses[0].response &&
                        proposalResponses[0].response.status === 200) {
                        isProposalGood = true;
                        console.log('Transaction proposal was good');
                    } else {
                        console.error('Transaction proposal was bad');
                    }
                    if (isProposalGood) {
                        console.log(util.format(
                            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                            proposalResponses[0].response.status, proposalResponses[0].response.message));

                        // build up the request for the orderer to have the transaction committed
                        var request = {
                            proposalResponses: proposalResponses,
                            proposal: proposal
                        };

                        // set the transaction listener and set a timeout of 30 sec
                        // if the transaction did not get committed within the timeout period,
                        // report a TIMEOUT status
                        var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                        var promises = [];

                        var sendPromise = channel.sendTransaction(request);
                        promises.push(sendPromise); //we want the send transaction first, so that we know where to check status
  
                        // get an eventhub once the fabric client has a user assigned. The user
                        // is required bacause the event registration must be signed
                        let event_hub = channel.newChannelEventHub(peer);

                        //SHI// // get an eventhub once the fabric client has a user assigned. The user
                        //SHI// // is required bacause the event registration must be signed
                        //SHI// let event_hub = fabric_client.newEventHub();
                        //SHI// event_hub.setPeerAddr(_eventPeerAddress);

                        // using resolve the promise so that result status may be processed
                        // under the then clause rather than having the catch clause process
                        // the status
                        //let txPromise = new Promise((resolve, reject) => {
                        //    let handle = setTimeout(() => {
                        //        event_hub.disconnect();
                        //        resolve({ event_status: 'TIMEOUT' }); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                        //    }, 3000);
                        //        //SHI// event_hub.connect();
                        //        event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                        //        // this is the callback for transaction event status
                        //        // first some clean up of event listener
                        //        clearTimeout(handle);
                        //        //event_hub.unregisterTxEvent(transaction_id_string);
                        //        //event_hub.disconnect();

                        //        // now let the application know what happened
                        //        var return_status = { event_status: code, tx_id: transaction_id_string };
                        //        if (code !== 'VALID') {
                        //            console.error('The transaction was invalid, code = ' + code);
                        //            resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                        //        } else {
                        //            console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                        //            resolve(return_status);
                        //        }
                        //    }, (err) => {
                        //        //this is the callback if something goes wrong with the event registration or processing
                        //        reject(new Error('There was a problem with the eventhub ::'+err));
                        //    },
                        //        {disconnect: true} //disconnect when complete
                        //    );
                        //    //SHI// , (err) => {
                        //    //SHI//     //this is the callback if something goes wrong with the event registration or processing
                        //    //SHI//     reject(new Error('There was a problem with the eventhub ::' + err));
                        //    //SHI// });
                        //});
                        //promises.push(txPromise);
                        let txPromise = new Promise((resolve, reject) => {
                            let handle = setTimeout(() => {
                                event_hub.unregisterTxEvent(transaction_id_string);
                                event_hub.disconnect();
                                resolve({ event_status: 'TIMEOUT' }); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                            }, 3000);
                            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                                // this is the callback for transaction event status
                                // first some clean up of event listener
                                clearTimeout(handle);

                                // now let the application know what happened
                                var return_status = { event_status: code, tx_id: transaction_id_string };
                                if (code !== 'VALID') {
                                    console.error('The transaction was invalid, code = ' + code);
                                    resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                                } else {
                                    console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
                                    resolve(return_status);
                                }
                            }, (err) => {
                                //this is the callback if something goes wrong with the event registration or processing
                                reject(new Error('There was a problem with the eventhub ::' + err));
                            },
                                { disconnect: true } //disconnect when complete
                            );
                            event_hub.connect();

                        });
                        promises.push(txPromise);

                        results = await Promise.all(promises);
                    } else {
                        console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                        throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                    }

                    //////////////////////////
                    console.log('Send transaction promise and event listener promise have completed');
                    // check the results in the order the promises were added to the promise all list
                    if (results && results[0] && results[0].status === 'SUCCESS') {
                        console.log('Successfully sent transaction to the orderer.');
                    } else {
                        console.error('Failed to order the transaction. Error code: ' + response.status);
                    }

                    if (results && results[1] && results[1].event_status === 'VALID') {
                        console.log('Successfully committed the change to the ledger by the peer' + results[1].tx_id);
                        return await this.GetTransactionByID(results[1].tx_id);
                        // return results[1].tx_id;
                    } else {
                        console.log('Transaction failed to be committed to the ledger due to ::' + results[1].event_status);
                        return null;
                    }
                    //////////////////////////
                } catch (err) {
                    throw new Error(err);
                }
            } catch (err) {
                throw new Error(err);
            }
        }
        catch (err) {
            console.error('Failed to invoke successfully :: ' + err);
            throw new Error('Failed to invoke successfully :: ' + err);
        }
    }

    async GetTransactionByID(trxnID) {
        var fabric_client = new Fabric_Client();

        // setup the fabric network
        var channel = fabric_client.newChannel(_channel);
        var peer = fabric_client.newPeer(_peerAddress);
        channel.addPeer(peer);

        //
        var member_user = null;
        var user_id = this.user;
        var store_path = path.join(__dirname, _storePath);
        var tx_id = null;

        try {
            var state_store = await Fabric_Client.newDefaultKeyValueStore({ path: store_path });
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            try {
                // get the enrolled user from persistence, this user will sign all requests
                var user_from_store = await fabric_client.getUserContext(user_id, true);

                if (user_from_store && user_from_store.isEnrolled()) {
                    console.log('Successfully loaded ' + user_id + ' from persistence');
                    member_user = user_from_store;
                } else {
                    throw new Error('Failed to get ' + user_id + '.... run registerUser.js');
                }

                try {
                    // send the query proposal to the peer
                    var query_responses = await channel.queryTransaction(trxnID, peer);

                    console.log("Query has completed, checking results");
                    // query_responses could have more than one  results if there multiple peers were used as targets
                    return query_responses.transactionEnvelope.payload.data.actions[0].payload.action.proposal_response_payload.extension.response.payload;
                    // if (query_responses && query_responses.length == 1) {
                    //     if (query_responses[0] instanceof Error) {
                    //         console.error("error from query = ", query_responses[0]);
                    //     } else {
                    //         console.log("Response is ", query_responses[0].toString());
                    //         return JSON.parse(query_responses[0].toString());
                    //     }
                    // } else {
                    //     console.log("No payloads were returned from query");
                    //     return null;
                    // }
                } catch (err) {
                    throw new Error(err);
                }
            } catch (err) {
                throw new Error(err);
            }
        } catch (err) {
            console.error('Failed to query successfully :: ' + err);
            throw new Error('Failed to query successfully :: ' + err);
        }
    };

    async GetCompleteTransactionByID(trxnID) {
        var fabric_client = new Fabric_Client();

        // setup the fabric network
        var channel = fabric_client.newChannel(_channel);
        var peer = fabric_client.newPeer(_peerAddress);
        channel.addPeer(peer);

        //
        var member_user = null;
        var user_id = this.user;
        var store_path = path.join(__dirname, _storePath);
        var tx_id = null;

        try {
            var state_store = await Fabric_Client.newDefaultKeyValueStore({ path: store_path });
            fabric_client.setStateStore(state_store);
            var crypto_suite = Fabric_Client.newCryptoSuite();
            // use the same location for the state store (where the users' certificate are kept)
            // and the crypto store (where the users' keys are kept)
            var crypto_store = Fabric_Client.newCryptoKeyStore({ path: store_path });
            crypto_suite.setCryptoKeyStore(crypto_store);
            fabric_client.setCryptoSuite(crypto_suite);

            try {
                // get the enrolled user from persistence, this user will sign all requests
                var user_from_store = await fabric_client.getUserContext(user_id, true);

                if (user_from_store && user_from_store.isEnrolled()) {
                    console.log('Successfully loaded ' + user_id + ' from persistence');
                    member_user = user_from_store;
                } else {
                    throw new Error('Failed to get ' + user_id + '.... run registerUser.js');
                }

                try {
                    // send the query proposal to the peer
                    var query_responses = await channel.queryTransaction(trxnID, peer);

                    console.log("Query has completed, checking results");
                    // query_responses could have more than one  results if there multiple peers were used as targets
                    return {
                        signature: query_responses.transactionEnvelope.signature.toString('base64'),
                        payload: query_responses.transactionEnvelope.payload
                    }; // .transactionEnvelope.payload.data.actions[0].payload.action.proposal_response_payload.extension.response.payload;
                    // if (query_responses && query_responses.length == 1) {
                    //     if (query_responses[0] instanceof Error) {
                    //         console.error("error from query = ", query_responses[0]);
                    //     } else {
                    //         console.log("Response is ", query_responses[0].toString());
                    //         return JSON.parse(query_responses[0].toString());
                    //     }
                    // } else {
                    //     console.log("No payloads were returned from query");
                    //     return null;
                    // }
                } catch (err) {
                    throw new Error(err);
                }
            } catch (err) {
                throw new Error(err);
            }
        } catch (err) {
            console.error('Failed to query successfully :: ' + err);
            throw new Error('Failed to query successfully :: ' + err);
        }
    };
}
/************* ChainCode END *************/

/************* CRYPTO START *************/
class ARNESTToken {
    get claims() { return this._claims; }
    get user() { return this.claims.user; }
    get userid() { return this.claims.userid; }
    get role() { return this.claims.role; }
    get org() { return this.claims.org; }
    get email() { return this.claims.email; }
    get phone() { return this.claims.phone; }
    get token() { return this._token }

    constructor(apiToken) {
        if (apiToken != null) {
            this._token = apiToken;
            this._claims = new ARNESTJwtProvider().Decode(apiToken);
        }
    }

    Init(user, org, role) {
        this._claims = {
            user: user,
            org: org,
            role: role
        };
    }
}
class ARNESTSigner {
    //set priKeyFile(keyFilePath) {
    //    this._priKeyFile = keyFilePath;
    //}
    //get priKeyFile() {
    //    return this._priKeyFile;
    //}

    //set pubKeyFile(keyFilePath) {
    //    this._pubKeyFile = keyFilePath;
    //}
    //get pubKeyFile() {
    //    return this._pubKeyFile;
    //}

    /**
     * Creates signer object to sign and/or verify data or document
     * @param {ARNESTSigner} blockToken blockToken object
     */
    constructor(_ARNESTToken) {
        if (_ARNESTToken) {
            this.Init(_ARNESTToken.user.toLowerCase());
        }
    }

    Init(userName) {
        let store_path = path.join(__dirname, _storePath);
        let usercertpath = path.join(store_path, userName);
        let rawdata = fs.readFileSync(usercertpath);
        let certFileJSON = JSON.parse(rawdata);
        this.priKeyFile = path.join(store_path, certFileJSON.enrollment.signingIdentity + '-priv');
        this.pubKeyFile = path.join(store_path, certFileJSON.enrollment.signingIdentity + '-pub');
    }

    GetPubKey() {
        let pub_keydata = this.pub_keydata ? this.pub_keydata : fs.readFileSync(this.pubKeyFile).toString();
        return pub_keydata;
    }

    GetPrivKey() {
        let priv_keydata = this.priv_keydata ? this.priv_keydata : fs.readFileSync(this.priKeyFile).toString();
        return priv_keydata;
    }

    Sign(data) {
        let priv_keydata = this.priv_keydata ? this.priv_keydata : fs.readFileSync(this.priKeyFile).toString();

        var sign = crypto.createSign(SIGN_FORMAT);
        sign.update(data);
        var signature = sign.sign(priv_keydata);

        let signatureBase64 = signature.toString(STRING_ENCODING);
        return signatureBase64;
    }

    Validate(data, signature) {
        let pub_keydata = this.GetPubKey();

        var verify = crypto.createVerify(SIGN_FORMAT);
        verify.update(data);

        let buffSignature = Buffer.from(signature, STRING_ENCODING);
        return verify.verify(pub_keydata, buffSignature);
    }

    SignFile(fileName) {
        let data = fs.readFileSync(fileName).toString();
        return this.Sign(data);
    }

    ValidateFile(fileName, signature) {
        let data = fs.readFileSync(fileName).toString();
        return this.Validate(data, signature);
    }
}
/************* CRYPTO END *************/

class ARNESTJwtProvider {
    Sign(name = '', jclaims = {}) {
        var signer = new ARNESTSigner(null);
        signer.Init(name.toLocaleLowerCase());
        var signature = jwt.sign(jclaims, signer.GetPrivKey(), { algorithm: 'RS256' })
        return signature;
    }
    Verify(apiToken = '') {
        var signer = new ARNESTSigner(new ARNESTToken(apiToken));
        return jwt.verify(apiToken, signer.GetPubKey());
    }
    Decode(apiToken = '') {
        return jwt.decode(apiToken);
    }
}


exports.ARNESTToken = ARNESTToken;
exports.ARNESTJwtProvider = ARNESTJwtProvider;
exports.ARNESTSigner = ARNESTSigner;
exports.ChainCode = ChainCode;
exports.signupUser = signupUser;
