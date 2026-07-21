'use strict';

/**
 * Cybersource recurring charge wrapper.
 * Charges a stored TMS (Token Management Service) payment token for the monthly VIP fee.
 *
 * PREREQUISITES (configure in BM, no secrets in code):
 *  - Service credential 'cybersource.rest.vip' (Administration > Operations > Services)
 *    pointing at https://api.cybersource.com (or apitest.cybersource.com on sandbox)
 *  - Site prefs: vipMerchantId; HTTP Signature key pair stored in service credential
 *  - Customer's token: created during a normal storefront card save via the existing
 *    int_cybersource cartridge (TMS customer/payment-instrument token)
 */
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger').getLogger('vip', 'cybersource');

var service = LocalServiceRegistry.createService('cybersource.rest.vip', {
    createRequest: function (svc, payload) {
        svc.setRequestMethod('POST');
        svc.addHeader('Content-Type', 'application/json');
        // TODO: add Cybersource HTTP Signature auth headers (v-c-merchant-id, Date,
        // Digest, Signature). Implement per Cybersource REST auth spec using the
        // key id/secret from the service credential. DO NOT hardcode keys.
        return JSON.stringify(payload);
    },
    parseResponse: function (svc, client) {
        return JSON.parse(client.text);
    },
    mockCall: function () {
        // Sandbox-friendly mock so the billing job can be tested end to end
        // before Cybersource credentials are configured.
        return {
            statusCode: 201,
            statusMessage: 'OK',
            object: { status: 'AUTHORIZED', id: 'MOCK-' + Date.now() }
        };
    }
});

/**
 * @param {string} tokenId - Cybersource TMS payment instrument token
 * @param {number} amount - charge amount, e.g. 12.00
 * @param {string} currency - e.g. 'USD'
 * @param {string} reference - merchant reference (customerNo + period)
 * @returns {{success: boolean, transactionId: string, error: string}}
 */
exports.chargeToken = function (tokenId, amount, currency, reference) {
    var payload = {
        clientReferenceInformation: { code: reference },
        paymentInformation: { paymentInstrument: { id: tokenId } },
        orderInformation: {
            amountDetails: { totalAmount: amount.toFixed(2), currency: currency }
        },
        processingInformation: { capture: true }
    };
    var result = service.call(payload);
    if (result.ok && result.object && result.object.status === 'AUTHORIZED') {
        return { success: true, transactionId: result.object.id, error: null };
    }
    Logger.error('VIP charge failed for ref {0}: {1}', reference, result.errorMessage || (result.object && result.object.status));
    return { success: false, transactionId: null, error: result.errorMessage || 'declined' };
};
