var ARNESTToken = require('./blockchain').ARNESTToken;
var attrancode = require('./attrancode');

var token = new ARNESTToken(null);
token.Init('contactus@arnest.in', '1', 'admin');
var sysConf = new attrancode.SystemOperations(token);

sysConf.BlockChainSignUpOrgUser('testb1@arnest.in').then(r => {
    console.log(r);
}, e => {
    console.log(e);
});
sysConf.BlockChainRegisterUser(99, 'system', 'testb2@arnest.in', 'Site', 'Admin', 0).then(r => {
    console.log(r);
}, e => {
    console.log(e);
});

sysConf.BlockChainSignUpOrgUser('testb3@arnest.in').then(r => {
    console.log(r);
}, e => {
    console.log(e);
});
sysConf.BlockChainRegisterUser(1, 'system', 'testb5@arnest.in', 'App', 'Admin', 0).then(r => {
    console.log(r);
}, e => {
    console.log(e);
});
