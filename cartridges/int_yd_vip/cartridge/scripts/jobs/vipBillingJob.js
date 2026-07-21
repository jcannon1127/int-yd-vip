'use strict';

/**
 * Monthly VIP billing job (Administration > Operations > Jobs).
 * Iterates ACTIVE members due for billing, charges their stored Cybersource token,
 * marks PAST_DUE on failure. Run daily; each member is billed when their
 * anniversary day arrives.
 */
var CustomerMgr = require('dw/customer/CustomerMgr');
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger').getLogger('vip', 'billing');

exports.execute = function () {
    var membershipService = require('*/cartridge/scripts/vip/membershipService');
    var cybersource = require('*/cartridge/scripts/payments/cybersourceRecurring');
    var price = Site.getCurrent().getCustomPreferenceValue('vipMonthlyPrice') || 12.0;
    var billed = 0;
    var failed = 0;

    CustomerMgr.processProfiles(function (profile) {
        try {
            var last = profile.custom.vipLastBilledOn;
            var now = new Date();
            // bill if never billed or last bill > 30 days ago
            if (last && (now.getTime() - last.getTime()) < 30 * 24 * 60 * 60 * 1000) { return; }
            var tokenId = profile.custom.vipPaymentInstrumentId;
            if (!tokenId) {
                Logger.warn('ACTIVE member {0} has no payment token; marking past due', profile.customerNo);
                membershipService.markPastDue(profile, 'missing_token');
                failed++;
                return;
            }
            var ref = profile.customerNo + '-' + now.toISOString().slice(0, 7);
            var charge = cybersource.chargeToken(tokenId, price, 'USD', ref);
            if (charge.success) {
                Transaction.wrap(function () {
                    profile.custom.vipLastBilledOn = now;
                });
                billed++;
            } else {
                membershipService.markPastDue(profile, charge.error);
                failed++;
            }
        } catch (e) {
            Logger.error('Billing error for {0}: {1}', profile.customerNo, e.message);
            failed++;
        }
    }, 'custom.vipStatus = {0}', 'ACTIVE');

    Logger.info('VIP billing run complete. Billed: {0}, Failed: {1}', billed, failed);
    return new Status(Status.OK, 'OK', 'Billed ' + billed + ', failed ' + failed);
};
