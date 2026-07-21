'use strict';

/**
 * VIP membership lifecycle - now TWO TIERS:
 *   silver -> YD-Silver group ($15/mo, 30% off)
 *   gold   -> YD-Gold group  ($30/mo, 40% off + monthly free item)
 *
 * Membership state on customer.profile.custom:
 *   vipStatus ('ACTIVE'|'PAST_DUE'|'CANCELED'|null), vipTier ('silver'|'gold'),
 *   vipMemberSince, vipCanceledOn, vipLastBilledOn, vipPaymentInstrumentId, rewardsEnrolled
 * Audit trail: VIPBillingLedger custom objects.
 */
var Transaction = require('dw/system/Transaction');
var CustomerMgr = require('dw/customer/CustomerMgr');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Logger = require('dw/system/Logger').getLogger('vip', 'membership');

var TIER_GROUP = { silver: 'YD-Silver', gold: 'YD-Gold' };

function normalizeTier(tier) {
    return (tier === 'gold') ? 'gold' : 'silver';
}

function setGroup(profile, groupId, assign) {
    var group = CustomerMgr.getCustomerGroup(groupId);
    if (!group) { Logger.error('Customer group {0} missing', groupId); return false; }
    if (assign) { group.assignCustomer(profile.customer); }
    else { group.unassignCustomer(profile.customer); }
    return true;
}

function writeLedger(profile, eventType, detail) {
    var UUIDUtils = require('dw/util/UUIDUtils');
    var e = CustomObjectMgr.createCustomObject('VIPBillingLedger', UUIDUtils.createUUID());
    e.custom.customerNo = profile.customerNo;
    e.custom.eventType = eventType;
    e.custom.detail = detail || '';
    e.custom.eventDate = new Date();
}

function enrollInRewards(profile) {
    // VIP and Rewards are SEPARATE; joining VIP auto-enrolls in Rewards.
    // TODO (prod): call the YD Rewards enrollment API.
    try { profile.custom.rewardsEnrolled = true; } catch (e) { Logger.warn(e.message); }
}

exports.getStatus = function (customer) {
    if (!customer || !customer.profile) { return { status: null, isMember: false, tier: null }; }
    var p = customer.profile;
    return {
        status: p.custom.vipStatus || null,
        isMember: p.custom.vipStatus === 'ACTIVE',
        tier: p.custom.vipTier || null,
        memberSince: p.custom.vipMemberSince || null
    };
};

exports.join = function (customer, tier) {
    if (!customer || !customer.profile) { return { success: false, error: 'not_logged_in' }; }
    var t = normalizeTier(tier);
    var p = customer.profile;
    var result = { success: false, tier: t };
    Transaction.wrap(function () {
        // if switching tiers, remove the other group
        var otherGroup = (t === 'silver') ? TIER_GROUP.gold : TIER_GROUP.silver;
        setGroup(p, otherGroup, false);
        if (!setGroup(p, TIER_GROUP[t], true)) { result.error = 'group_missing'; return; }
        p.custom.vipStatus = 'ACTIVE';
        p.custom.vipTier = t;
        if (!p.custom.vipMemberSince) { p.custom.vipMemberSince = new Date(); }
        p.custom.vipCanceledOn = null;
        writeLedger(p, 'JOIN', 'Joined ' + t + ' via storefront');
        enrollInRewards(p);
        result.success = true;
    });
    return result;
};

exports.cancel = function (customer, reason) {
    if (!customer || !customer.profile) { return { success: false, error: 'not_logged_in' }; }
    var p = customer.profile;
    var result = { success: false };
    Transaction.wrap(function () {
        setGroup(p, TIER_GROUP.silver, false);
        setGroup(p, TIER_GROUP.gold, false);
        p.custom.vipStatus = 'CANCELED';
        p.custom.vipCanceledOn = new Date();
        writeLedger(p, 'CANCEL', reason || '');
        result.success = true;
    });
    return result;
};

exports.markPastDue = function (profile, detail) {
    var t = profile.custom.vipTier === 'gold' ? TIER_GROUP.gold : TIER_GROUP.silver;
    Transaction.wrap(function () {
        setGroup(profile, t, false); // member pricing pauses until payment recovers
        profile.custom.vipStatus = 'PAST_DUE';
        writeLedger(profile, 'PAYMENT_FAILED', detail || '');
    });
};

exports.TIER_GROUP = TIER_GROUP;
