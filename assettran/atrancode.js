var path = require('path');
const util = require('util');
var blockchain = require('./blockchain');
var ARNESTToken = blockchain.ARNESTToken;
var ChainCode = blockchain.ChainCode;
var ARNESTSigner = blockchain.ARNESTSigner;

const resourceBase = 'arnest:atran';
const personDocType = resourceBase + '.participant';
const roleDocType = resourceBase + '.standard';

class  AssetOperations{
    get claims() { return this._claims; }

    constructor(blockToken) {
        this._claims = blockToken;
    }

    async transfer(to = '', value = 0) {
        try {
            var resultData = await new ChainCode(this.claims).ExecuteCommandAsync('assetTransfer', [to, value]);
            if (resultData) {
                if (resultData && resultData.length > 0) {
                    return { status: 200, data: resultData, status: { success: true } };
                }
            }

            return null;
        } catch (err) {
            return { status: 500, data: { message: 'Failed to transfer ' + err } };
        }
    }

    async cancel(tranId = '', reason = '') {
        try {
            var resultData = await new ChainCode(this.claims).ExecuteCommandAsync('cancelTransaction', [tranId, reason]);
            if (resultData) {
                if (resultData && resultData.length > 0) {
                    return { status: 200, data: resultData, status: { success: true } };
                }
            }

            return null;
        } catch (err) {
            return { status: 500, data: { message: 'Failed to transfer ' + err } };
        }
    }

    async approve(tranId = '', reason = '') {
        try {
            var resultData = await new ChainCode(this.claims).ExecuteCommandAsync('approveTransaction', [tranId, reason]);
            if (resultData) {
                if (resultData && resultData.length > 0) {
                    return { status: 200, data: resultData, status: { success: true } };
                }
            }

            return null;
        } catch (err) {
            return { status: 500, data: { message: 'Failed to transfer ' + err } };
        }
    }

    async reject(tranId = '', reason = '') {
        try {
            var resultData = await new ChainCode(this.claims).ExecuteCommandAsync('rejectTransaction', [tranId, reason]);
            if (resultData) {
                if (resultData && resultData.length > 0) {
                    return { status: 200, data: resultData, status: { success: true } };
                }
            }

            return null;
        } catch (err) {
            return { status: 500, data: { message: 'Failed to transfer ' + err } };
        }
    }

    async transactions(limit = 10, bookmark = '') {
        try {
            var resultData = await new ChainCode(this.claims).ExecuteQueryAsync('getTransactions', [limit, bookmark]);
            if (resultData && resultData.results.length > 0) {
                return { status: 200, data: resultData };
            }

            return { status: 500, data: { message: 'Not Found', Error: err } };
        } catch (err) {
            return { status: 500, data: { message: 'Couldnot fetch history/not found: ' + err } };
        }
    }

    async transactionHsitory(key = '') {
        try {
            var historyRes = [];
            var chainCode = new ChainCode(this.claims);
            let history = await chainCode.ExecuteQueryAsync('getHistory', [key], true);
            if (history) {
                for (var i = 0; i < history.length; i++) {
                    var transDetails = await this.GetHistoryData(history[i], chainCode);
                    historyRes.push(transDetails);
                }


                return { status: 200, items: historyRes };
            }
            else {
                return { status: 404, data: { message: 'Not found' } };
            }
        } catch (err) {
            return { status: 500, data: { message: 'Couldnot fetch history/not found: ' + err } };
        }
    }

    async GetHistoryData(hisData, chainCode) {
        var hisFullData =
            {
                TxId: '',
                Timestamp: { seconds: null, nanos: 0 },
                IsDelete: 'false',
                Value: hisData.Value,
                signature: ''
            };

        hisFullData.TxId = hisData.metadata.TxId;
        hisFullData.Timestamp = hisData.metadata.Timestamp;
        hisFullData.IsDelete = hisData.metadata.IsDelete;
        hisFullData.Value = hisData.Value;

        var transDetails = await chainCode.GetCompleteTransactionByID(hisFullData.TxId);
        hisFullData.signature = transDetails.signature;
        // hisFullData.payload = transDetails.payload;
        return hisFullData;
    }
}

class  SystemOperations {
    get claims() { return this._claims; }

    constructor(blockToken) {
        this._claims = blockToken;
        // console.log(util.inspect(_claims, { showHidden: false, depth: null }));
    }

    async BlockChainRegisterUser(email = '', firstName = '', lastName = '', phone = '') {
        email = email.toLowerCase();
        var roleClass = roleDocType;
        
        let newUser1 = {
            docType: personDocType,
            identity: personDocType + '#' + email,
            role: roleClass,
            id: email,
            email: email,
            phone: phone,
            firstName: firstName,
            lastName: lastName
        };
        
        try {
            var resultData = await new ChainCode(this.claims).ExecuteCommandAsync('addUser', [JSON.stringify(newUser1)]);
            if (resultData) {
                var idData = resultData;
                if (idData && idData.length > 0) {
                    idData = idData.split('#')[1];
                    return { status: 200, data: { id: idData } };
                }
            }
        
            return null;
        } catch (err) {
            return { status: 500, data: { message: 'Failed to invoke successfully (REGUSER) :: ' + err } };
        }
    }

    async BlockChainSignUpOrgUser(newUsername = '') {
        return await blockchain.signupUser(newUsername);
    }
}

function  extractId(key = '') {
    return Number.parseInt(key.substr(key.indexOf("#") + 1));
};

exports.extractId = extractId;
exports.SystemOperations = SystemOperations;
exports.AssetOperations = AssetOperations;
