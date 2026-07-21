'use strict';

function post(url, onDone) {
    $.ajax({
        url: url,
        method: 'POST',
        dataType: 'json',
        data: { csrf_token: $('input[name="csrf_token"]').val() },
        success: onDone,
        error: function () { window.location.reload(); }
    });
}

module.exports = {
    init: function () {
        $('.vip-join-btn').on('click', function () {
            post($(this).data('url'), function () { window.location.reload(); });
        });
        $('.vip-cancel-btn').on('click', function () {
            if (window.confirm('Cancel your VIP membership? Billing stops immediately.')) {
                post($(this).data('url'), function () { window.location.reload(); });
            }
        });
    }
};
