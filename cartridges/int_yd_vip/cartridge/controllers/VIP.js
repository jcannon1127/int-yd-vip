'use strict';

/**
 * VIP Membership controller (SFRA) - two tiers (silver / gold).
 *
 * VIP-Show      : join page (two plans, from vip-join-content) OR member view
 * VIP-Join?tier=: login-gated confirm/payment step for the chosen tier
 * VIP-Process   : activates membership for the posted tier
 * VIP-Confirm   : welcome page with the tier's welcome code
 */
var server = require('server');
var URLUtils = require('dw/web/URLUtils');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');

function assetMarkup(id) {
    var ContentMgr = require('dw/content/ContentMgr');
    var a = ContentMgr.getContent(id);
    return (a && a.custom && a.custom.body) ? a.custom.body.markup : null;
}

// tier config (price label + welcome code) - Site prefs override the defaults
function tierInfo(tier) {
    var Site = require('dw/system/Site').getCurrent();
    if (tier === 'gold') {
        return {
            id: 'gold',
            name: 'Gold',
            priceLabel: Site.getCustomPreferenceValue('vipGoldPriceLabel') || '$30/month',
            welcomeCode: Site.getCustomPreferenceValue('vipGoldWelcomeCode') || 'WELCOME80',
            welcomePct: '80%'
        };
    }
    return {
        id: 'silver',
        name: 'Silver',
        priceLabel: Site.getCustomPreferenceValue('vipSilverPriceLabel') || '$15/month',
        welcomeCode: Site.getCustomPreferenceValue('vipSilverWelcomeCode') || 'WELCOME60',
        welcomePct: '60%'
    };
}

server.get('Show', server.middleware.https, function (req, res, next) {
    var membershipService = require('*/cartridge/scripts/vip/membershipService');
    res.render('vip/join', {
        vip: membershipService.getStatus(req.currentCustomer.raw),
        joinBody: assetMarkup('vip-join-content'),
        memberBody: assetMarkup('vip-member-content')
    });
    next();
});

server.get('Join', server.middleware.https, userLoggedIn.validateLoggedIn, csrfProtection.generateToken, function (req, res, next) {
    var membershipService = require('*/cartridge/scripts/vip/membershipService');
    if (membershipService.getStatus(req.currentCustomer.raw).isMember) {
        res.redirect(URLUtils.url('VIP-Show'));
        return next();
    }
    var tier = tierInfo(req.querystring.tier);
    res.render('vip/checkout', {
        checkoutBody: assetMarkup('vip-checkout-content'),
        tier: tier
    });
    next();
});

server.post('Process', server.middleware.https, userLoggedIn.validateLoggedIn, csrfProtection.validateRequest, function (req, res, next) {
    var membershipService = require('*/cartridge/scripts/vip/membershipService');
    var tier = (req.form && req.form.tier === 'gold') ? 'gold' : 'silver';
    // TODO (payment phase): capture Cybersource token before activating.
    membershipService.join(req.currentCustomer.raw, tier);
    res.redirect(URLUtils.url('VIP-Confirm', 'tier', tier));
    next();
});

server.get('Confirm', server.middleware.https, userLoggedIn.validateLoggedIn, function (req, res, next) {
    res.render('vip/confirm', {
        welcomeBody: assetMarkup('vip-welcome-content'),
        tier: tierInfo(req.querystring.tier)
    });
    next();
});

server.post('Cancel', server.middleware.https, userLoggedIn.validateLoggedIn, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var membershipService = require('*/cartridge/scripts/vip/membershipService');
    res.json(membershipService.cancel(req.currentCustomer.raw, 'customer_request'));
    next();
});

module.exports = server.exports();
