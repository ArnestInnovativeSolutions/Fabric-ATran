/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class AssetTran extends Contract {

    async instantiateLedger(ctx) {
        console.info('============= START : instantiate Ledger JS NODE ===========');
        await ctx.stub.putState("__revision", Buffer.from("v01"));
        console.info('============= END : instantiate Ledger successfull ===========');
    }

    async transfer(ctx, trxReference, to, value) {
        console.info(`============= START : save ===========`);
        const ClientIdentity = require('fabric-shim').ClientIdentity;
        let cid = new ClientIdentity(ctx.stub);
        let mspid = cid.getMSPID();
        let my_id = cid.getID();
        let startIndex = my_id.indexOf("CN=") + 3;
        let lastIndex = my_id.indexOf("::", startIndex);
        let userEmail = my_id.substring(startIndex, lastIndex).toLowerCase();

        var trnKey = ctx.stub.createCompositeKey('user~ref', [userEmail, trxReference]);
        // Validate document type:: exclude transactional
        var dataBytes = await ctx.stub.getState(trnKey);
        // 0:create,1:update,3:approve,4:cancel,5:reject
        if (!dataBytes || dataBytes.length === 0) {
            console.info(`============= save - exists ${trnKey} ===========`);
            var trnJson = {
                org: mspid,
                ref: trxReference,
                from: userEmail,
                to: to,
                value: value,
                status: 1,
            };
            await ctx.stub.putState(trnKey, Buffer.from(JSON.stringify(trnJson)));
            console.info(`============= saved ===========`);
        }
        else {
            console.info(`============= save - do not exist ${trnKey} ===========`);
            const trnJson = JSON.parse(carAsBytes.toString());
            if(trnJson.from == userEmail && (trnJson.status == 0 || trnJson.status == 1)){
                trnJson.to = to;
                trnJson.value = value;
                trnJson.status = 1;
                await ctx.stub.putState(trnKey, Buffer.from(JSON.stringify(trnJson)));
            }else{
                throw new Error(`${trnKey} cant modify in this state`);
            }
        }
     }

    async cancel(ctx, from, trxReference, message) {
        console.info(`============= START : save ===========`);
        const ClientIdentity = require('fabric-shim').ClientIdentity;
        let cid = new ClientIdentity(ctx.stub);
        let mspid = cid.getMSPID();
        let my_id = cid.getID();
        let startIndex = my_id.indexOf("CN=") + 3;
        let lastIndex = my_id.indexOf("::", startIndex);
        let userEmail = my_id.substring(startIndex, lastIndex).toLowerCase();

        var trnKey = ctx.stub.createCompositeKey('user~ref', [from, trxReference]);
        // Validate document type:: exclude transactional
        var dataBytes = await ctx.stub.getState(trnKey);
        // 0:create,1:update,3:approve,4:cancel,5:reject
        if (dataBytes && dataBytes.length > 0) {
            const trnJson = JSON.parse(carAsBytes.toString());
            if(trnJson.to == userEmail && (trnJson.status == 0 || trnJson.status == 1)){
                trnJson.cancelMessage = message;
                trnJson.status = 4; // rejected
                await ctx.stub.putState(trnKey, Buffer.from(JSON.stringify(trnJson)));
                return;
            }
        }

        throw new Error(`${trnKey} not exists`);
    }

    async approve(ctx, from, trxReference, message) {
        console.info(`============= START : save ===========`);
        const ClientIdentity = require('fabric-shim').ClientIdentity;
        let cid = new ClientIdentity(ctx.stub);
        let mspid = cid.getMSPID();
        let my_id = cid.getID();
        let startIndex = my_id.indexOf("CN=") + 3;
        let lastIndex = my_id.indexOf("::", startIndex);
        let userEmail = my_id.substring(startIndex, lastIndex).toLowerCase();

        var trnKey = ctx.stub.createCompositeKey('user~ref', [from, trxReference]);
        // Validate document type:: exclude transactional
        var dataBytes = await ctx.stub.getState(trnKey);
        // 0:create,1:update,3:approve,4:cancel,5:reject
        if (dataBytes && dataBytes.length > 0) {
            const trnJson = JSON.parse(carAsBytes.toString());
            if(trnJson.to == userEmail && (trnJson.status == 0 || trnJson.status == 1)){
                trnJson.signMessage = message;
                trnJson.status = 3;
                await ctx.stub.putState(trnKey, Buffer.from(JSON.stringify(trnJson)));
                return;
            }
        }

        throw new Error(`${trnKey} not exists`);
    }

    async reject(ctx, from, trxReference, message) {
        console.info(`============= START : save ===========`);
        const ClientIdentity = require('fabric-shim').ClientIdentity;
        let cid = new ClientIdentity(ctx.stub);
        let mspid = cid.getMSPID();
        let my_id = cid.getID();
        let startIndex = my_id.indexOf("CN=") + 3;
        let lastIndex = my_id.indexOf("::", startIndex);
        let userEmail = my_id.substring(startIndex, lastIndex).toLowerCase();

        var trnKey = ctx.stub.createCompositeKey('user~ref', [from, trxReference]);
        // Validate document type:: exclude transactional
        var dataBytes = await ctx.stub.getState(trnKey);
        // 0:create,1:update,3:approve,4:cancel,5:reject
        if (dataBytes && dataBytes.length > 0) {
            const trnJson = JSON.parse(carAsBytes.toString());
            if(trnJson.to == userEmail && (trnJson.status == 0 || trnJson.status == 1)){
                trnJson.signMessage = message;
                trnJson.status = 5; // rejected
                await ctx.stub.putState(trnKey, Buffer.from(JSON.stringify(trnJson)));
                return;
            }
        }

        throw new Error(`${trnKey} not exists`);
    }

    async getQueryResultForQueryString(ctx, queryString, _pageSize, bookmark) {
        console.info(`============= START : getQueryResultForQueryString ===========`);
        const pageSize = parseInt(_pageSize, 10);

        const { iterator, metadata } = await ctx.stub.getQueryResultWithPagination(queryString, pageSize, bookmark);
        try {
            let allResults = [];
            let max = 250;
            let index = 0;
            while (true && index < max) {
                index++;
                let res = await iterator.next();

                console.log(res.value.key);
                if (res.value && res.value.value.toString()) {
                    try {
                        let jRecord = JSON.parse(res.value.value.toString('utf8'));
                        jRecord.meta = {};
                        jRecord.meta.Key = res.value.key;
                        // jRecord.meta.TxId = res.value.tx_id;
                        // jRecord.meta.Timestamp = res.value.timestamp;
                        allResults.push(jRecord);
                    } catch (err) {
                        console.log(err);
                        // jsonRes.Record = res.value.value.toString('utf8');
                        allResults.push(res.value.value.toString('utf8'));
                    }

                    // allResults.push(jsonRes);
                }
                if (res.done) {
                    console.log('end of data');
                    await iterator.close();
                    console.info('found: ' + allResults.length);
                    const resp = {
                        results: allResults,
                        metadata: {
                            RecordsCount: metadata.fetched_records_count,
                            Bookmark: metadata.bookmark,
                        }
                    };

                    return resp; // Buffer.from(JSON.stringify(results));
                    // return JSON.stringify(allResults);
                    // return Buffer.from(JSON.stringify(allResults));
                    // break;
                }
            }
        } catch (err) {
            console.log(err);
            throw new Error(`does not exist`);
        }
    }
}

module.exports = AssetTran;
